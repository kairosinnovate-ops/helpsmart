import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { badRequest, forbidden, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import { getPublicProfile } from "./providers";
import { notify } from "./notifications";

/**
 * Conversations are created and written only by the server (authorisation, blocking, rate limits).
 * Participants read them in realtime through the Firestore client SDK; rules restrict reads to participants.
 */

export function conversationId(a: string, b: string) {
  return [a, b].sort().join("__");
}

async function isBlocked(a: string, b: string) {
  const db = adminDb();
  const [x, y] = await Promise.all([
    db.collection(C.userBlocks).doc(`${a}_${b}`).get(),
    db.collection(C.userBlocks).doc(`${b}_${a}`).get(),
  ]);
  return x.exists || y.exists;
}

/**
 * Customers may start a conversation with an approved provider. Providers may only message a customer
 * when they already share a booking — this prevents unsolicited contact and spam.
 */
export async function openConversation(user: { uid: string; displayName: string }, otherUid: string, bookingId?: string | null) {
  if (otherUid === user.uid) throw badRequest("You cannot message yourself");
  if (await isBlocked(user.uid, otherUid)) throw forbidden("Messaging is not available with this person", "blocked");
  const db = adminDb();
  let shared = false;
  if (bookingId) {
    const b = await db.collection(C.bookings).doc(bookingId).get();
    const parts = (b.get("participants") as string[] | undefined) ?? [];
    shared = b.exists && parts.includes(user.uid) && parts.includes(otherUid);
    if (!shared) throw notFound("Booking not found");
  }
  const otherProfile = await getPublicProfile(otherUid);
  if (!shared && !otherProfile) throw forbidden("You can message professionals, or customers you have a booking with", "contact_not_allowed");

  const id = conversationId(user.uid, otherUid);
  const ref = db.collection(C.conversations).doc(id);
  const other = await db.collection(C.users).doc(otherUid).get();
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) {
      tx.set(ref, {
        participantIds: [user.uid, otherUid].sort(),
        names: { [user.uid]: user.displayName, [otherUid]: other.get("displayName") ?? "HelpSmart user" },
        bookingIds: bookingId ? [bookingId] : [],
        lastMessage: null,
        lastMessageAt: FieldValue.serverTimestamp(),
        unread: { [user.uid]: 0, [otherUid]: 0 },
        createdAt: FieldValue.serverTimestamp(),
      });
    } else if (bookingId) {
      tx.update(ref, { bookingIds: FieldValue.arrayUnion(bookingId) });
    }
  });
  return id;
}

export const MessageInput = z.object({ text: z.string().trim().min(1).max(2000) });

export async function sendMessage(user: { uid: string; displayName: string }, convId: string, input: unknown) {
  const { text } = MessageInput.parse(input);
  await rateLimit(`msg_${user.uid}`, 30, 60);
  const db = adminDb();
  const ref = db.collection(C.conversations).doc(convId);
  const s = await ref.get();
  if (!s.exists) throw notFound("Conversation not found");
  const parts = s.get("participantIds") as string[];
  if (!parts.includes(user.uid)) throw notFound("Conversation not found");
  const other = parts.find((p) => p !== user.uid)!;
  if (await isBlocked(user.uid, other)) throw forbidden("Messaging is not available with this person", "blocked");
  // Light spam control: strip control chars; links are allowed but flagged for moderation.
  const clean = text.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  const hasLink = /https?:\/\//i.test(clean);
  const batch = db.batch();
  batch.set(ref.collection(C.messages).doc(), {
    senderId: user.uid,
    text: clean,
    flagged: hasLink,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(ref, {
    lastMessage: { text: clean.slice(0, 120), senderId: user.uid },
    lastMessageAt: FieldValue.serverTimestamp(),
    [`unread.${other}`]: FieldValue.increment(1),
  });
  await batch.commit();
  await notify(other, { type: "message", title: `Message from ${user.displayName}`, body: clean.slice(0, 100), link: `/messages/${convId}` });
}

export async function markConversationRead(uid: string, convId: string) {
  const ref = adminDb().collection(C.conversations).doc(convId);
  const s = await ref.get();
  if (!s.exists || !(s.get("participantIds") as string[]).includes(uid)) throw notFound("Conversation not found");
  await ref.update({ [`unread.${uid}`]: 0, [`readAt.${uid}`]: FieldValue.serverTimestamp() });
}

export async function listConversations(uid: string) {
  const s = await adminDb()
    .collection(C.conversations)
    .where("participantIds", "array-contains", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(50)
    .get();
  return s.docs.map((d) => {
    const other = (d.get("participantIds") as string[]).find((p) => p !== uid)!;
    return {
      id: d.id,
      otherUid: other,
      otherName: (d.get("names")?.[other] as string) ?? "HelpSmart user",
      lastMessage: (d.get("lastMessage")?.text as string) ?? null,
      lastMessageAt: d.get("lastMessageAt")?.toMillis?.() ?? 0,
      unread: (d.get("unread")?.[uid] as number) ?? 0,
    };
  });
}

export async function getConversation(uid: string, convId: string) {
  const s = await adminDb().collection(C.conversations).doc(convId).get();
  if (!s.exists || !(s.get("participantIds") as string[]).includes(uid)) throw notFound("Conversation not found");
  const other = (s.get("participantIds") as string[]).find((p) => p !== uid)!;
  return { id: s.id, otherUid: other, otherName: (s.get("names")?.[other] as string) ?? "HelpSmart user", bookingIds: (s.get("bookingIds") as string[]) ?? [] };
}

export async function blockUser(uid: string, otherUid: string, block: boolean) {
  const ref = adminDb().collection(C.userBlocks).doc(`${uid}_${otherUid}`);
  if (block) await ref.set({ blockerId: uid, blockedId: otherUid, createdAt: FieldValue.serverTimestamp() });
  else await ref.delete();
}

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";

export type NotificationType =
  | "booking_request"
  | "booking_update"
  | "quote_received"
  | "service_request"
  | "message"
  | "payment_update"
  | "identity_update"
  | "provider_approval"
  | "review_reminder"
  | "review_received"
  | "dispute_update"
  | "announcement"
  | "security";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

/**
 * Writes an in-app notification. A Cloud Function (functions/src/index.ts) fans it out to
 * FCM push for devices the user registered, respecting their preferences.
 */
export async function notify(uid: string, n: NotificationInput) {
  await adminDb()
    .collection(C.notifications)
    .add({ uid, ...n, link: n.link ?? null, read: false, createdAt: FieldValue.serverTimestamp() });
}

export async function markNotificationsRead(uid: string, ids: string[]) {
  const db = adminDb();
  const batch = db.batch();
  for (const id of ids.slice(0, 100)) {
    const ref = db.collection(C.notifications).doc(id);
    const s = await ref.get();
    if (s.exists && s.get("uid") === uid) batch.update(ref, { read: true });
  }
  await batch.commit();
}

export async function listNotifications(uid: string, limit = 30) {
  const snap = await adminDb()
    .collection(C.notifications)
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    type: d.get("type") as string,
    title: d.get("title") as string,
    body: d.get("body") as string,
    link: (d.get("link") as string | null) ?? null,
    read: d.get("read") as boolean,
    createdAt: d.get("createdAt")?.toMillis?.() ?? Date.now(),
  }));
}

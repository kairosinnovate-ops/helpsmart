import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import { notify } from "./notifications";

export const TicketInput = z.object({
  type: z.enum(["general", "booking", "payment", "account", "verification", "account_deletion"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(3000),
  bookingId: z.string().max(60).nullable().optional(),
});

export async function createTicket(uid: string, input: unknown) {
  const d = TicketInput.parse(input);
  await rateLimit(`ticket_${uid}`, 10, 24 * 3600);
  const ref = await adminDb().collection(C.supportTickets).add({ uid, ...d, bookingId: d.bookingId ?? null, status: "open", createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export const ReportInput = z.object({
  type: z.enum(["profile", "user", "message", "safety"]),
  subjectId: z.string().min(1).max(128),
  bookingId: z.string().max(60).nullable().optional(),
  description: z.string().trim().min(10).max(3000),
});

/** Safety and abuse reports. HelpSmart is not an emergency service — the UI shows emergency numbers. */
export async function createReport(uid: string, input: unknown) {
  const d = ReportInput.parse(input);
  await rateLimit(`report_${uid}`, 10, 24 * 3600);
  await adminDb().collection(C.incidentReports).add({
    reporterId: uid,
    ...d,
    bookingId: d.bookingId ?? null,
    status: "open",
    priority: d.type === "safety" ? "high" : "normal",
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function resolveCase(
  admin: { uid: string; role: string },
  collection: "supportTickets" | "incidentReports" | "reviewReports",
  id: string,
  status: "in_progress" | "resolved" | "dismissed",
  note: string,
) {
  const ref = adminDb().collection(C[collection]).doc(id);
  const s = await ref.get();
  if (!s.exists) throw notFound();
  await ref.update({ status, resolutionNote: note.slice(0, 1000), handledBy: admin.uid, updatedAt: FieldValue.serverTimestamp() });
  await audit({ actorId: admin.uid, actorRole: admin.role, action: `${collection}.${status}`, targetType: collection, targetId: id });
  const uid = (s.get("uid") ?? s.get("reporterId")) as string | undefined;
  if (uid && status !== "in_progress") {
    await notify(uid, { type: "announcement", title: "Your case was updated", body: `Status: ${status.replace("_", " ")}.`, link: "/account" });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/firebase/admin";
import { C } from "@/server/collections";
import { gateway } from "@/server/payments/gateways";

/**
 * Payment partner webhooks. Fail closed: unknown or unconfigured gateways and invalid signatures are rejected.
 * Idempotent: each partner event id is processed once. Amount and booking are reconciled before any status change.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ gateway: string }> }) {
  const g = gateway((await ctx.params).gateway);
  if (!g) return NextResponse.json({ error: "unknown_gateway" }, { status: 404 });
  if (!g.configured) return NextResponse.json({ error: "gateway_not_configured" }, { status: 503 });
  const raw = await req.text();
  const event = g.verifyWebhook(raw, req.headers);
  if (!event) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const db = adminDb();
  const evRef = db.collection("paymentEvents").doc(`${g.id}_${event.eventId}`);
  const pRef = db.collection(C.payments).doc(event.bookingId);
  const result = await db.runTransaction(async (tx) => {
    const [ev, p] = await Promise.all([tx.get(evRef), tx.get(pRef)]);
    if (ev.exists) return "duplicate";
    tx.set(evRef, { gateway: g.id, eventId: event.eventId, bookingId: event.bookingId, status: event.status, receivedAt: FieldValue.serverTimestamp() });
    if (!p.exists || p.get("amountMinor") !== event.amountMinor || event.currency !== "ETB") {
      tx.set(db.collection("reconciliationIssues").doc(), { gateway: g.id, eventId: event.eventId, bookingId: event.bookingId, reason: "amount_or_booking_mismatch", at: FieldValue.serverTimestamp() });
      return "mismatch";
    }
    const status = event.status === "paid" ? "paid" : event.status === "refunded" ? "refunded" : event.status === "failed" ? "failed" : "pending";
    tx.update(pRef, { status, gateway: g.id, gatewayRef: event.gatewayRef, updatedAt: FieldValue.serverTimestamp() });
    tx.update(db.collection(C.bookings).doc(event.bookingId), { paymentStatus: status });
    return "applied";
  });
  return NextResponse.json({ result });
}

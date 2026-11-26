import "server-only";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { badRequest, forbidden, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import {
  availableActions,
  bookingReference,
  BOOKING_ACTIONS,
  DISPUTE_WINDOW_MS,
  nextStatus,
  type BookingAction,
  type BookingActor,
} from "@/domain/booking";
import { calculateBreakdown, estimateAmount, type PriceBreakdown } from "@/domain/pricing";
import type { BookingStatus, PaymentMethod, PaymentStatus, PriceModel } from "@/domain/types";
import { getPublicProfile } from "./providers";
import { getSettings, requireCategory, resolveArea } from "./reference";
import { notify } from "./notifications";

export const CreateBookingInput = z.object({
  providerId: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().trim().min(10).max(2000),
  urgency: z.enum(["now", "scheduled"]),
  scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
  recurrence: z
    .object({ frequency: z.enum(["daily", "weekly", "monthly"]), interval: z.number().int().min(1).max(4), occurrences: z.number().int().min(2).max(52) })
    .nullable()
    .optional(),
  /** Hours or days, when the provider uses hourly/daily pricing. */
  quantity: z.number().min(0.5).max(200).default(1),
  /** Customer asks for a custom quote instead of the listed rate. */
  requestQuote: z.boolean().default(false),
  paymentMethod: z.enum(["cash", "bank_transfer"]).default("cash"),
  address: z.object({
    addressId: z.string().nullable().optional(),
    subCityId: z.string(),
    neighborhoodId: z.string().nullable().optional(),
    landmark: z.string().trim().max(120).default(""),
    directions: z.string().trim().max(400).default(""),
    pin: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  }),
  photoPaths: z.array(z.string().max(300)).max(5).default([]),
});

export interface BookingView {
  id: string;
  reference: string;
  status: BookingStatus;
  customerId: string;
  providerId: string;
  customerName: string;
  providerName: string;
  categoryId: string;
  description: string;
  urgency: "now" | "scheduled";
  scheduledFor: number | null;
  recurrence: { frequency: string; interval: number; occurrences: number } | null;
  priceModel: PriceModel;
  quantity: number;
  rateMinor: number | null;
  quote: { amountMinor: number; note: string; estimatedDuration: string } | null;
  breakdown: PriceBreakdown | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  area: { subCityName: string; neighborhoodName: string | null };
  /** Only populated for the customer, or for the provider once confirmed. */
  exactAddress: { landmark: string; directions: string; pin: { lat: number; lng: number } | null } | null;
  createdAt: number;
  completedAt: number | null;
  reviewId: string | null;
  events: { type: string; to: string; actorRole: string; at: number; note: string | null }[];
  viewerRole: BookingActor;
  actions: BookingAction[];
  cancelReason: string | null;
}

const ADDRESS_VISIBLE_TO_PROVIDER: BookingStatus[] = ["confirmed", "provider_en_route", "in_progress", "completed", "disputed"];

export async function createBooking(customer: { uid: string; displayName: string }, input: unknown) {
  const d = CreateBookingInput.parse(input);
  await rateLimit(`booking_create_${customer.uid}`, 20, 3600);
  if (d.providerId === customer.uid) throw badRequest("You cannot book yourself", "self_booking");
  const provider = await getPublicProfile(d.providerId);
  if (!provider) throw notFound("This professional is not available");
  const category = await requireCategory(d.categoryId);
  if (!provider.categoryIds.includes(category.id)) throw badRequest("This professional does not offer that service", "category_mismatch");
  if (d.urgency === "scheduled") {
    if (!d.scheduledFor) throw badRequest("Choose a date and time", "schedule_required");
    const t = Date.parse(d.scheduledFor);
    if (t < Date.now() + 30 * 60 * 1000) throw badRequest("Choose a time at least 30 minutes from now", "schedule_too_soon");
    if (t > Date.now() + 180 * 24 * 3600 * 1000) throw badRequest("Choose a time within 6 months", "schedule_too_far");
  } else if (!provider.availableNow) {
    throw badRequest("This professional is not available right now. Schedule a time instead.", "not_available_now");
  }
  const area = await resolveArea(d.address.subCityId, d.address.neighborhoodId ?? null);
  const settings = await getSettings();
  const { model, rateMinor } = provider.pricing;
  const fixedRate = (model === "hourly" || model === "daily" || model === "fixed") && rateMinor != null;
  const hasAgreedPrice = fixedRate && !d.requestQuote;
  const quantity = model === "fixed" ? 1 : d.quantity;
  const serviceAmount = hasAgreedPrice ? estimateAmount(rateMinor!, quantity) + (provider.pricing.callOutFeeMinor ?? 0) : null;
  const breakdown = serviceAmount != null ? calculateBreakdown(serviceAmount, settings) : null;

  for (const p of d.photoPaths) if (!p.startsWith(`bookings/${customer.uid}/`)) throw forbidden("Invalid photo path");

  const db = adminDb();
  const ref = db.collection(C.bookings).doc();
  const status = nextStatus("draft", "submit", "customer", { hasAgreedPrice });
  const batch = db.batch();
  batch.set(ref, {
    reference: bookingReference(ref.id),
    customerId: customer.uid,
    customerName: customer.displayName,
    providerId: provider.id,
    providerName: provider.displayName,
    participants: [customer.uid, provider.id],
    categoryId: category.id,
    description: d.description,
    urgency: d.urgency,
    scheduledFor: d.scheduledFor ? Timestamp.fromMillis(Date.parse(d.scheduledFor)) : null,
    recurrence: d.recurrence ?? null,
    priceModel: model,
    quantity,
    rateMinor: rateMinor ?? null,
    quote: null,
    breakdown,
    commissionRate: settings.commissionRate,
    paymentMethod: d.paymentMethod,
    paymentStatus: "unpaid",
    area: { cityId: area.cityId, subCityId: area.subCity.id, subCityName: area.subCity.names.en, neighborhoodId: area.neighborhood?.id ?? null, neighborhoodName: area.neighborhood?.names.en ?? null },
    // Exact location kept in a private field that is projected only to permitted viewers.
    privateAddress: { landmark: d.address.landmark, directions: d.address.directions, pin: d.address.pin ?? null },
    photoPaths: d.photoPaths,
    status,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    completedAt: null,
    reviewId: null,
  });
  batch.set(ref.collection(C.bookingEvents).doc(), { type: "requested", from: "draft", to: "requested", actorId: customer.uid, actorRole: "customer", at: FieldValue.serverTimestamp(), note: null });
  batch.set(ref.collection(C.bookingEvents).doc(), { type: "submit", from: "requested", to: status, actorId: customer.uid, actorRole: "customer", at: FieldValue.serverTimestamp(), note: null });
  await batch.commit();
  await notify(provider.id, {
    type: "booking_request",
    title: hasAgreedPrice ? "New booking request" : "New quote request",
    body: `${customer.displayName} needs ${category.names.en.toLowerCase()} in ${area.subCity.names.en}.`,
    link: `/bookings/${ref.id}`,
  });
  return ref.id;
}

function actorFor(uid: string, b: FirebaseFirestore.DocumentData): BookingActor | null {
  if (uid === b.customerId) return "customer";
  if (uid === b.providerId) return "provider";
  return null;
}

export function toView(id: string, b: FirebaseFirestore.DocumentData, viewer: BookingActor, events: FirebaseFirestore.QueryDocumentSnapshot[] = []): BookingView {
  const showAddress = viewer === "customer" || viewer === "admin" || ADDRESS_VISIBLE_TO_PROVIDER.includes(b.status);
  const ctx = { hasAgreedPrice: !!b.breakdown };
  return {
    id,
    reference: b.reference,
    status: b.status,
    customerId: b.customerId,
    providerId: b.providerId,
    customerName: b.customerName,
    providerName: b.providerName,
    categoryId: b.categoryId,
    description: b.description,
    urgency: b.urgency,
    scheduledFor: b.scheduledFor?.toMillis?.() ?? null,
    recurrence: b.recurrence ?? null,
    priceModel: b.priceModel,
    quantity: b.quantity,
    rateMinor: b.rateMinor,
    quote: b.quote ? { amountMinor: b.quote.amountMinor, note: b.quote.note, estimatedDuration: b.quote.estimatedDuration } : null,
    breakdown: b.breakdown ?? null,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    area: { subCityName: b.area?.subCityName, neighborhoodName: b.area?.neighborhoodName ?? null },
    exactAddress: showAddress ? b.privateAddress : null,
    createdAt: b.createdAt?.toMillis?.() ?? Date.now(),
    completedAt: b.completedAt?.toMillis?.() ?? null,
    reviewId: b.reviewId ?? null,
    events: events.map((e) => ({ type: e.get("type"), to: e.get("to"), actorRole: e.get("actorRole"), at: e.get("at")?.toMillis?.() ?? 0, note: e.get("note") ?? null })),
    viewerRole: viewer,
    actions: viewer === "system" ? [] : availableActions(b.status, viewer, ctx).filter((a) => viewer !== "admin" || a.startsWith("resolve") || a === "mark_refunded" || a === "cancel"),
    cancelReason: b.cancelReason ?? null,
  };
}

export async function getBookingForUser(uid: string, id: string, isAdmin = false): Promise<BookingView> {
  const ref = adminDb().collection(C.bookings).doc(id);
  const s = await ref.get();
  if (!s.exists) throw notFound("Booking not found");
  const b = s.data()!;
  const actor = actorFor(uid, b) ?? (isAdmin ? "admin" : null);
  if (!actor) throw notFound("Booking not found"); // don't reveal existence
  const ev = await ref.collection(C.bookingEvents).orderBy("at", "asc").get();
  return toView(s.id, b, actor, ev.docs);
}

export async function listBookings(uid: string, as: "customer" | "provider", opts: { statuses?: BookingStatus[]; limit?: number } = {}) {
  let q: FirebaseFirestore.Query = adminDb()
    .collection(C.bookings)
    .where(as === "customer" ? "customerId" : "providerId", "==", uid);
  if (opts.statuses?.length) q = q.where("status", "in", opts.statuses.slice(0, 30));
  const s = await q.orderBy("createdAt", "desc").limit(opts.limit ?? 50).get();
  return s.docs.map((d) => toView(d.id, d.data(), as));
}

export const TransitionInput = z.object({
  action: z.enum(BOOKING_ACTIONS),
  note: z.string().trim().max(500).optional(),
  quote: z
    .object({
      amountMinor: z.number().int().min(100).max(100_000_00),
      note: z.string().trim().max(500).default(""),
      estimatedDuration: z.string().trim().max(60).default(""),
    })
    .optional(),
});

function writeEvent(tx: Transaction, ref: FirebaseFirestore.DocumentReference, e: { type: string; from: string; to: string; actorId: string; actorRole: string; note?: string | null }) {
  tx.set(ref.collection(C.bookingEvents).doc(), { ...e, note: e.note ?? null, at: FieldValue.serverTimestamp() });
}

/**
 * The only way a booking status changes. Validates actor + state on the server inside a transaction.
 */
export async function transitionBooking(actorUid: string, bookingId: string, input: unknown, admin?: { role: string }) {
  const d = TransitionInput.parse(input);
  const db = adminDb();
  const ref = db.collection(C.bookings).doc(bookingId);
  const settings = await getSettings();
  const result = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw notFound("Booking not found");
    const b = s.data()!;
    const actor: BookingActor | null = admin ? "admin" : actorFor(actorUid, b);
    if (!actor) throw notFound("Booking not found");
    const to = nextStatus(b.status, d.action, actor, { hasAgreedPrice: !!b.breakdown });
    const update: Record<string, unknown> = { status: to, updatedAt: FieldValue.serverTimestamp() };

    if (d.action === "submit_quote") {
      if (!d.quote) throw badRequest("Quote amount required", "quote_required");
      update.quote = { ...d.quote, submittedAt: Timestamp.now() };
      update.breakdown = null;
    }
    if (d.action === "confirm") {
      if (!b.quote) throw badRequest("No quote to confirm");
      update.breakdown = calculateBreakdown(b.quote.amountMinor, { ...settings, commissionRate: b.commissionRate ?? settings.commissionRate });
    }
    if (d.action === "complete") {
      update.completedAt = FieldValue.serverTimestamp();
      tx.set(db.collection(C.providerProfiles).doc(b.providerId), { stats: { completedJobs: FieldValue.increment(1) } }, { merge: true });
    }
    if (d.action === "cancel" || d.action === "decline" || d.action === "reject_quote") {
      update.cancelledBy = actor;
      update.cancelReason = d.note ?? null;
    }
    if (d.action === "dispute") {
      const completedAt = b.completedAt?.toMillis?.();
      if (b.status === "completed" && completedAt && Date.now() - completedAt > DISPUTE_WINDOW_MS) {
        throw badRequest("The dispute window for this booking has closed. Contact support.", "dispute_window_closed");
      }
      tx.set(db.collection(C.disputes).doc(bookingId), {
        bookingId,
        openedBy: actorUid,
        openedByRole: actor,
        reason: d.note ?? "",
        status: "open",
        participants: b.participants,
        createdAt: FieldValue.serverTimestamp(),
      });
      update.paymentStatus = b.paymentStatus === "paid" ? "disputed" : b.paymentStatus;
    }
    if (d.action === "resolve_refund") update.paymentStatus = "refund_pending";
    if (d.action === "mark_refunded") update.paymentStatus = "refunded";
    if (d.action === "resolve_completed" || d.action === "resolve_refund") {
      tx.set(db.collection(C.disputes).doc(bookingId), { status: "resolved", resolution: d.action, resolvedBy: actorUid, resolvedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    tx.update(ref, update);
    writeEvent(tx, ref, { type: d.action, from: b.status, to, actorId: actorUid, actorRole: admin?.role ?? actor, note: d.note });

    // Payment record is created when the job is confirmed (price now agreed).
    if (to === "confirmed") {
      const bd = (update.breakdown as PriceBreakdown | undefined) ?? b.breakdown;
      tx.set(db.collection(C.payments).doc(bookingId), {
        bookingId,
        customerId: b.customerId,
        providerId: b.providerId,
        method: b.paymentMethod,
        amountMinor: bd.customerTotalMinor,
        breakdown: bd,
        status: "unpaid",
        confirmations: { customer: null, provider: null },
        gateway: null,
        gatewayRef: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { b, to, actor };
  });

  if (admin) {
    await audit({ actorId: actorUid, actorRole: admin.role, action: `booking.${d.action}`, targetType: "booking", targetId: bookingId });
  }
  const other = result.actor === "customer" ? result.b.providerId : result.b.customerId;
  const recipients = result.actor === "admin" ? [result.b.customerId, result.b.providerId] : [other];
  const labels: Partial<Record<BookingAction, string>> = {
    accept: "Your booking was accepted",
    decline: "Your booking was declined",
    submit_quote: "You received a quote",
    confirm: "Booking confirmed",
    reject_quote: "Quote declined",
    start_travel: "Your professional is on the way",
    start: "Service started",
    complete: "Service completed",
    cancel: "Booking cancelled",
    dispute: "A dispute was opened",
  };
  for (const r of recipients) {
    await notify(r, {
      type: d.action === "submit_quote" ? "quote_received" : d.action === "dispute" ? "dispute_update" : "booking_update",
      title: labels[d.action] ?? "Booking update",
      body: `Booking ${result.b.reference} is now ${result.to.replace(/_/g, " ")}.`,
      link: `/bookings/${bookingId}`,
    });
  }
  if (d.action === "complete") {
    await notify(result.b.customerId, { type: "review_reminder", title: "How did it go?", body: "Rate your service to help other customers.", link: `/bookings/${bookingId}` });
  }
  return result.to;
}

/* ------------------------------------------------------------------ */
/* Payment tracking (MVP: cash / bank transfer, two-sided confirmation) */
/* ------------------------------------------------------------------ */

/**
 * Off-platform payments are recorded, not processed. Status becomes `paid` only when BOTH parties
 * confirm; one-sided confirmation is `pending`. Gateway payments (Telebirr, CBE Birr, Chapa) will be
 * confirmed exclusively by verified webhooks — see src/server/payments.
 */
export async function confirmOffPlatformPayment(uid: string, bookingId: string) {
  const db = adminDb();
  const pRef = db.collection(C.payments).doc(bookingId);
  const bRef = db.collection(C.bookings).doc(bookingId);
  const status = await db.runTransaction(async (tx) => {
    const [p, b] = await Promise.all([tx.get(pRef), tx.get(bRef)]);
    if (!p.exists || !b.exists) throw notFound("Payment not found");
    const role = actorFor(uid, b.data()!);
    if (!role) throw notFound("Payment not found");
    if (!["cash", "bank_transfer"].includes(p.get("method"))) throw forbidden("This payment is confirmed by the payment provider", "gateway_payment");
    if (!["in_progress", "completed"].includes(b.get("status"))) throw badRequest("Payment can be recorded once the service has started");
    if (["paid", "refunded", "refund_pending", "disputed"].includes(p.get("status"))) return p.get("status") as PaymentStatus;
    const confirmations = { ...(p.get("confirmations") ?? {}), [role]: Timestamp.now() };
    const both = !!confirmations.customer && !!confirmations.provider;
    const next: PaymentStatus = both ? "paid" : "pending";
    tx.update(pRef, { confirmations, status: next, updatedAt: FieldValue.serverTimestamp(), ...(both ? { paidAt: FieldValue.serverTimestamp() } : {}) });
    tx.update(bRef, { paymentStatus: next });
    if (both) {
      const bd = p.get("breakdown") as PriceBreakdown;
      const base = { bookingId, providerId: p.get("providerId"), customerId: p.get("customerId"), method: p.get("method"), at: FieldValue.serverTimestamp() };
      tx.set(db.collection(C.transactions).doc(`${bookingId}_gmv`), { ...base, type: "service_value", amountMinor: bd.serviceAmountMinor });
      tx.set(db.collection(C.transactions).doc(`${bookingId}_commission`), { ...base, type: "commission", amountMinor: bd.commissionMinor, settlement: "owed_by_provider" });
      if (bd.customerServiceFeeMinor > 0) tx.set(db.collection(C.transactions).doc(`${bookingId}_fee`), { ...base, type: "customer_fee", amountMinor: bd.customerServiceFeeMinor, settlement: "owed_by_provider" });
    }
    return next;
  });
  return status;
}

export async function providerEarnings(providerId: string) {
  const s = await adminDb().collection(C.payments).where("providerId", "==", providerId).orderBy("createdAt", "desc").limit(200).get();
  let confirmedGross = 0,
    confirmedCommission = 0,
    pendingNet = 0;
  const history = s.docs.map((d) => {
    const bd = d.get("breakdown") as PriceBreakdown;
    const status = d.get("status") as PaymentStatus;
    if (status === "paid") {
      confirmedGross += bd.serviceAmountMinor;
      confirmedCommission += bd.commissionMinor;
    } else if (status === "unpaid" || status === "pending") {
      pendingNet += bd.providerNetMinor;
    }
    return { bookingId: d.id, status, method: d.get("method") as string, serviceAmountMinor: bd.serviceAmountMinor, commissionMinor: bd.commissionMinor, netMinor: bd.providerNetMinor, createdAt: d.get("createdAt")?.toMillis?.() ?? 0 };
  });
  return { confirmedGross, confirmedCommission, confirmedNet: confirmedGross - confirmedCommission, pendingNet, history };
}

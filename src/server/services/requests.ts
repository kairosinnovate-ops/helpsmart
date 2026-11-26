import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { rateLimit } from "../rate-limit";
import { haversineKm } from "@/domain/geo";
import { bookingReference } from "@/domain/booking";
import { calculateBreakdown } from "@/domain/pricing";
import { approximate } from "@/domain/geo";
import { getPublicProfile } from "./providers";
import { getSettings, requireCategory, resolveArea } from "./reference";
import { notify } from "./notifications";

/**
 * Open service requests ("I need an electrician in Bole…") that nearby approved providers can quote on.
 * Customer identity and precise location stay hidden until a quote is accepted.
 */

export const ServiceRequestInput = z.object({
  categoryId: z.string(),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(20).max(2000),
  subCityId: z.string(),
  neighborhoodId: z.string().nullable().optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  budgetMinor: z.number().int().min(0).max(100_000_00).nullable().optional(),
  photoPaths: z.array(z.string().max(300)).max(5).default([]),
});

const MAX_QUOTES_PER_REQUEST = 10;

export async function createServiceRequest(customer: { uid: string }, input: unknown) {
  const d = ServiceRequestInput.parse(input);
  await rateLimit(`sr_create_${customer.uid}`, 5, 24 * 3600);
  await requireCategory(d.categoryId);
  const area = await resolveArea(d.subCityId, d.neighborhoodId ?? null);
  for (const p of d.photoPaths) if (!p.startsWith(`requests/${customer.uid}/`)) throw forbidden("Invalid photo path");
  const ref = await adminDb().collection(C.serviceRequests).add({
    customerId: customer.uid,
    categoryId: d.categoryId,
    title: d.title,
    description: d.description,
    cityId: area.cityId,
    subCityId: area.subCity.id,
    subCityName: area.subCity.names.en,
    neighborhoodId: area.neighborhood?.id ?? null,
    neighborhoodName: area.neighborhood?.names.en ?? null,
    approxCenter: approximate(area.center),
    preferredDate: d.preferredDate ?? null,
    budgetMinor: d.budgetMinor ?? null,
    photoPaths: d.photoPaths,
    status: "open",
    quoteCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 3600 * 1000),
  });
  return ref.id;
}

export interface RequestView {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  subCityName: string;
  neighborhoodName: string | null;
  preferredDate: string | null;
  budgetMinor: number | null;
  status: string;
  quoteCount: number;
  createdAt: number;
  distanceKm?: number | null;
  myQuote?: { amountMinor: number; status: string } | null;
}

const view = (id: string, d: FirebaseFirestore.DocumentData): RequestView => ({
  id,
  categoryId: d.categoryId,
  title: d.title,
  description: d.description,
  subCityName: d.subCityName,
  neighborhoodName: d.neighborhoodName,
  preferredDate: d.preferredDate,
  budgetMinor: d.budgetMinor,
  status: d.status,
  quoteCount: d.quoteCount ?? 0,
  createdAt: d.createdAt?.toMillis?.() ?? 0,
});

export async function listMyRequests(uid: string) {
  const s = await adminDb().collection(C.serviceRequests).where("customerId", "==", uid).orderBy("createdAt", "desc").limit(30).get();
  return s.docs.map((d) => view(d.id, d.data()));
}

/** Requests visible to an approved provider: matching categories, inside their service radius. */
export async function listOpenRequestsForProvider(providerId: string) {
  const p = await getPublicProfile(providerId);
  if (!p) throw forbidden("Only approved, verified professionals can see open requests", "provider_not_approved");
  const s = await adminDb()
    .collection(C.serviceRequests)
    .where("status", "==", "open")
    .where("categoryId", "in", p.categoryIds.slice(0, 30))
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const now = Date.now();
  const mine = await adminDb().collection(C.quotations).where("providerId", "==", providerId).limit(200).get();
  const myQuotes = new Map(mine.docs.map((q) => [q.get("serviceRequestId") as string, { amountMinor: q.get("amountMinor") as number, status: q.get("status") as string }]));
  return s.docs
    .filter((d) => d.get("customerId") !== providerId && (d.get("expiresAt")?.toMillis?.() ?? 0) > now)
    .map((d) => {
      const km = haversineKm(p.serviceCenter, d.get("approxCenter"));
      return { ...view(d.id, d.data()), distanceKm: km, myQuote: myQuotes.get(d.id) ?? null };
    })
    .filter((r) => (r.distanceKm ?? 0) <= p.serviceRadiusKm);
}

export const QuotationInput = z.object({
  amountMinor: z.number().int().min(100).max(100_000_00),
  note: z.string().trim().min(5).max(800),
  estimatedDuration: z.string().trim().max(60).default(""),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function submitQuotation(providerId: string, requestId: string, input: unknown) {
  const d = QuotationInput.parse(input);
  await rateLimit(`quote_${providerId}`, 30, 24 * 3600);
  const p = await getPublicProfile(providerId);
  if (!p) throw forbidden("Only approved, verified professionals can quote", "provider_not_approved");
  const db = adminDb();
  const rRef = db.collection(C.serviceRequests).doc(requestId);
  const qRef = db.collection(C.quotations).doc(`${requestId}_${providerId}`);
  await db.runTransaction(async (tx) => {
    const [r, q] = await Promise.all([tx.get(rRef), tx.get(qRef)]);
    if (!r.exists) throw notFound("Request not found");
    if (r.get("status") !== "open") throw badRequest("This request is closed", "request_closed");
    if (r.get("customerId") === providerId) throw badRequest("You cannot quote on your own request");
    if (!p.categoryIds.includes(r.get("categoryId"))) throw forbidden("Outside your service categories");
    if (haversineKm(p.serviceCenter, r.get("approxCenter")) > p.serviceRadiusKm) throw forbidden("Outside your service area");
    if (q.exists) throw conflict("You already quoted on this request", "already_quoted");
    if ((r.get("quoteCount") ?? 0) >= MAX_QUOTES_PER_REQUEST) throw badRequest("This request has enough quotes", "quote_limit");
    tx.set(qRef, {
      serviceRequestId: requestId,
      providerId,
      providerName: p.displayName,
      customerId: r.get("customerId"),
      ...d,
      availableFrom: d.availableFrom ?? null,
      status: "submitted",
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(rRef, { quoteCount: FieldValue.increment(1) });
  });
  const r = await rRef.get();
  await notify(r.get("customerId"), { type: "quote_received", title: "New quote", body: `${p.displayName} sent a quote for “${r.get("title")}”.`, link: `/requests/${requestId}` });
}

export async function getRequestWithQuotes(customerId: string, requestId: string) {
  const r = await adminDb().collection(C.serviceRequests).doc(requestId).get();
  if (!r.exists || r.get("customerId") !== customerId) throw notFound("Request not found");
  const qs = await adminDb().collection(C.quotations).where("serviceRequestId", "==", requestId).get();
  const quotes = await Promise.all(
    qs.docs.map(async (q) => {
      const prof = await getPublicProfile(q.get("providerId"));
      return {
        id: q.id,
        providerId: q.get("providerId") as string,
        providerName: q.get("providerName") as string,
        amountMinor: q.get("amountMinor") as number,
        note: q.get("note") as string,
        estimatedDuration: q.get("estimatedDuration") as string,
        availableFrom: (q.get("availableFrom") as string | null) ?? null,
        status: q.get("status") as string,
        ratingAverage: prof?.ratingAverage ?? 0,
        ratingCount: prof?.ratingCount ?? 0,
        completedJobs: prof?.completedJobs ?? 0,
        badges: prof?.badges ?? [],
        stillAvailable: !!prof,
      };
    }),
  );
  return { request: view(r.id, r.data()!), quotes: quotes.sort((a, b) => a.amountMinor - b.amountMinor) };
}

export const AcceptQuoteInput = z.object({
  landmark: z.string().trim().max(120).default(""),
  directions: z.string().trim().max(400).default(""),
  scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
  paymentMethod: z.enum(["cash", "bank_transfer"]).default("cash"),
});

/** Accepting a quote awards the request and creates a confirmed booking at the quoted price. */
export async function acceptQuotation(customer: { uid: string; displayName: string }, quotationId: string, input: unknown) {
  const d = AcceptQuoteInput.parse(input);
  const db = adminDb();
  const qRef = db.collection(C.quotations).doc(quotationId);
  const settings = await getSettings();
  const bookingRef = db.collection(C.bookings).doc();
  const res = await db.runTransaction(async (tx) => {
    const q = await tx.get(qRef);
    if (!q.exists || q.get("customerId") !== customer.uid) throw notFound("Quote not found");
    const rRef = db.collection(C.serviceRequests).doc(q.get("serviceRequestId"));
    const r = await tx.get(rRef);
    if (r.get("status") !== "open") throw badRequest("This request is no longer open", "request_closed");
    if (q.get("status") !== "submitted") throw badRequest("This quote is no longer available");
    const others = await tx.get(db.collection(C.quotations).where("serviceRequestId", "==", rRef.id));
    const prov = await tx.get(db.collection(C.publicProfiles).doc(q.get("providerId")));
    if (!prov.exists) throw badRequest("This professional is no longer available", "provider_unavailable");
    const breakdown = calculateBreakdown(q.get("amountMinor"), settings);
    for (const o of others.docs) tx.update(o.ref, { status: o.id === q.id ? "accepted" : "declined" });
    tx.update(rRef, { status: "awarded", awardedQuotationId: q.id, bookingId: bookingRef.id });
    tx.set(bookingRef, {
      reference: bookingReference(bookingRef.id),
      customerId: customer.uid,
      customerName: customer.displayName,
      providerId: q.get("providerId"),
      providerName: q.get("providerName"),
      participants: [customer.uid, q.get("providerId")],
      categoryId: r.get("categoryId"),
      description: `${r.get("title")}\n\n${r.get("description")}`,
      urgency: d.scheduledFor ? "scheduled" : "now",
      scheduledFor: d.scheduledFor ? Timestamp.fromMillis(Date.parse(d.scheduledFor)) : null,
      recurrence: null,
      priceModel: "quote",
      quantity: 1,
      rateMinor: null,
      quote: { amountMinor: q.get("amountMinor"), note: q.get("note"), estimatedDuration: q.get("estimatedDuration"), submittedAt: q.get("createdAt") },
      breakdown,
      commissionRate: settings.commissionRate,
      paymentMethod: d.paymentMethod,
      paymentStatus: "unpaid",
      area: { cityId: r.get("cityId"), subCityId: r.get("subCityId"), subCityName: r.get("subCityName"), neighborhoodId: r.get("neighborhoodId"), neighborhoodName: r.get("neighborhoodName") },
      privateAddress: { landmark: d.landmark, directions: d.directions, pin: null },
      photoPaths: r.get("photoPaths") ?? [],
      serviceRequestId: rRef.id,
      status: "confirmed",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      reviewId: null,
    });
    tx.set(bookingRef.collection(C.bookingEvents).doc(), { type: "quote_accepted", from: "awaiting_customer_confirmation", to: "confirmed", actorId: customer.uid, actorRole: "customer", at: FieldValue.serverTimestamp(), note: null });
    tx.set(db.collection(C.payments).doc(bookingRef.id), {
      bookingId: bookingRef.id,
      customerId: customer.uid,
      providerId: q.get("providerId"),
      method: d.paymentMethod,
      amountMinor: breakdown.customerTotalMinor,
      breakdown,
      status: "unpaid",
      confirmations: { customer: null, provider: null },
      gateway: null,
      gatewayRef: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { providerId: q.get("providerId") as string, declined: others.docs.filter((o) => o.id !== q.id).map((o) => o.get("providerId") as string) };
  });
  await notify(res.providerId, { type: "booking_update", title: "Your quote was accepted", body: "A new confirmed job is waiting in HelpSmart Pro.", link: `/bookings/${bookingRef.id}` });
  for (const pid of res.declined) await notify(pid, { type: "service_request", title: "Request awarded", body: "The customer chose another quote this time.", link: "/pro/requests" });
  return bookingRef.id;
}

export async function closeServiceRequest(customerId: string, requestId: string) {
  const ref = adminDb().collection(C.serviceRequests).doc(requestId);
  const r = await ref.get();
  if (!r.exists || r.get("customerId") !== customerId) throw notFound("Request not found");
  if (r.get("status") !== "open") throw badRequest("Request is not open");
  await ref.update({ status: "closed", closedAt: FieldValue.serverTimestamp() });
}

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { badRequest, forbidden, notFound } from "../errors";
import { applyReview, emptyAggregate, reviewEligibility, validateRatings, type DimensionRatings, type RatingAggregate } from "@/domain/reviews";
import { refreshPublicProfile } from "./providers";
import { notify } from "./notifications";

export const ReviewInput = z.object({
  ratings: z.record(z.string(), z.number()),
  comment: z.string().trim().max(1500).default(""),
});

const REASON_MESSAGES = {
  not_customer: "Only the customer on this booking can review it",
  self_review: "You cannot review yourself",
  not_completed: "You can review once the service is completed",
  already_reviewed: "You already reviewed this booking",
  window_closed: "The review window for this booking has closed",
} as const;

function aggregateFrom(stats: Record<string, unknown> | undefined): RatingAggregate {
  const base = emptyAggregate();
  if (!stats?.ratingSums) return base;
  return { count: (stats.ratingCount as number) ?? 0, sums: stats.ratingSums as DimensionRatings, average: (stats.ratingAverage as number) ?? 0 };
}

/** Review id == booking id → at most one review per booking, enforced by the database too. */
export async function createReview(uid: string, bookingId: string, input: unknown) {
  const d = ReviewInput.parse(input);
  const ratings = validateRatings(d.ratings);
  const db = adminDb();
  const bRef = db.collection(C.bookings).doc(bookingId);
  const rRef = db.collection(C.reviews).doc(bookingId);
  const providerId = await db.runTransaction(async (tx) => {
    const [b, r] = await Promise.all([tx.get(bRef), tx.get(rRef)]);
    if (!b.exists) throw notFound("Booking not found");
    const bd = b.data()!;
    const pRef = db.collection(C.providerProfiles).doc(bd.providerId);
    const p = await tx.get(pRef);
    const elig = reviewEligibility({
      reviewerUid: uid,
      booking: { customerId: bd.customerId, providerId: bd.providerId, status: bd.status, completedAt: bd.completedAt?.toMillis?.() ?? null },
      alreadyReviewed: r.exists,
      now: Date.now(),
    });
    if (!elig.ok) {
      if (elig.reason === "not_customer") throw notFound("Booking not found");
      throw badRequest(REASON_MESSAGES[elig.reason], elig.reason);
    }
    const agg = applyReview(aggregateFrom(p.get("stats")), ratings, 1);
    tx.set(rRef, {
      bookingId,
      providerId: bd.providerId,
      customerId: uid,
      customerName: bd.customerName,
      categoryId: bd.categoryId,
      ratings,
      comment: d.comment,
      verifiedBooking: true,
      status: "published",
      providerResponse: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(pRef, { stats: { ratingCount: agg.count, ratingSums: agg.sums, ratingAverage: agg.average } }, { merge: true });
    tx.update(bRef, { reviewId: bookingId });
    return bd.providerId as string;
  });
  await refreshPublicProfile(providerId);
  await notify(providerId, { type: "review_received", title: "New review", body: `You received a ${ratings.overall}-star review.`, link: "/pro/profile" });
}

export async function respondToReview(providerId: string, reviewId: string, text: string) {
  const t = z.string().trim().min(2).max(800).parse(text);
  const ref = adminDb().collection(C.reviews).doc(reviewId);
  const s = await ref.get();
  if (!s.exists || s.get("providerId") !== providerId) throw notFound("Review not found");
  if (s.get("providerResponse")) throw badRequest("You already responded to this review");
  await ref.update({ providerResponse: { text: t, at: FieldValue.serverTimestamp() } });
}

export async function reportReview(uid: string, reviewId: string, reason: string) {
  const r = z.string().trim().min(5).max(500).parse(reason);
  const s = await adminDb().collection(C.reviews).doc(reviewId).get();
  if (!s.exists) throw notFound("Review not found");
  await adminDb().collection(C.reviewReports).add({ reviewId, reporterId: uid, reason: r, status: "open", createdAt: FieldValue.serverTimestamp() });
}

/** Moderation removes a review from public view AND from the rating aggregate (and can restore it). */
export async function moderateReview(admin: { uid: string; role: string }, reviewId: string, action: "hide" | "restore", note: string) {
  const db = adminDb();
  const ref = db.collection(C.reviews).doc(reviewId);
  const providerId = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw notFound("Review not found");
    const cur = s.get("status");
    if ((action === "hide" && cur !== "published") || (action === "restore" && cur !== "hidden")) throw badRequest("Nothing to change");
    const pRef = db.collection(C.providerProfiles).doc(s.get("providerId"));
    const p = await tx.get(pRef);
    const agg = applyReview(aggregateFrom(p.get("stats")), s.get("ratings"), action === "hide" ? -1 : 1);
    tx.update(ref, {
      status: action === "hide" ? "hidden" : "published",
      moderationHistory: FieldValue.arrayUnion({ action, by: admin.uid, at: Date.now(), noteLength: note.length }),
    });
    tx.set(pRef, { stats: { ratingCount: agg.count, ratingSums: agg.sums, ratingAverage: agg.average } }, { merge: true });
    return s.get("providerId") as string;
  });
  await audit({ actorId: admin.uid, actorRole: admin.role, action: `review.${action}`, targetType: "review", targetId: reviewId });
  await refreshPublicProfile(providerId);
}

export async function listProviderReviews(providerId: string, limit = 20) {
  const s = await adminDb()
    .collection(C.reviews)
    .where("providerId", "==", providerId)
    .where("status", "==", "published")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return s.docs.map((d) => ({
    id: d.id,
    // First name only — protects reviewer privacy.
    customerName: String(d.get("customerName") ?? "Customer").split(" ")[0],
    ratings: d.get("ratings") as DimensionRatings,
    comment: d.get("comment") as string,
    providerResponse: (d.get("providerResponse")?.text as string) ?? null,
    createdAt: d.get("createdAt")?.toMillis?.() ?? 0,
    verifiedBooking: true,
  }));
}

/** Private provider → customer feedback. Visible to HelpSmart staff only, never public (anti-retaliation). */
export const ProviderFeedbackInput = z.object({
  communication: z.number().int().min(1).max(5),
  paymentReliability: z.number().int().min(1).max(5),
  environment: z.number().int().min(1).max(5),
  safetyConcern: z.boolean().default(false),
  comment: z.string().trim().max(1000).default(""),
});

export async function submitProviderFeedback(providerId: string, bookingId: string, input: unknown) {
  const d = ProviderFeedbackInput.parse(input);
  const db = adminDb();
  const b = await db.collection(C.bookings).doc(bookingId).get();
  if (!b.exists || b.get("providerId") !== providerId) throw notFound("Booking not found");
  if (b.get("status") !== "completed") throw forbidden("Feedback is available after completion");
  const ref = db.collection("providerFeedback").doc(bookingId);
  if ((await ref.get()).exists) throw badRequest("Feedback already submitted");
  await ref.set({ bookingId, providerId, customerId: b.get("customerId"), ...d, createdAt: FieldValue.serverTimestamp() });
  if (d.safetyConcern) {
    await db.collection(C.incidentReports).add({ type: "safety", reporterId: providerId, subjectId: b.get("customerId"), bookingId, description: d.comment, status: "open", priority: "high", createdAt: FieldValue.serverTimestamp() });
  }
}

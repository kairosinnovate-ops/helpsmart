import { REVIEW_WINDOW_MS } from "./booking";
import type { BookingStatus } from "./types";

export const RATING_DIMENSIONS = [
  "quality",
  "professionalism",
  "communication",
  "punctuality",
  "value",
  "overall",
] as const;
export type RatingDimension = (typeof RATING_DIMENSIONS)[number];
export type DimensionRatings = Record<RatingDimension, number>;

export interface ReviewEligibilityInput {
  reviewerUid: string;
  booking: {
    customerId: string;
    providerId: string;
    status: BookingStatus;
    completedAt: number | null; // epoch ms
  };
  alreadyReviewed: boolean;
  now: number;
}

export type ReviewIneligibleReason =
  | "not_customer"
  | "self_review"
  | "not_completed"
  | "already_reviewed"
  | "window_closed";

export function reviewEligibility(input: ReviewEligibilityInput): { ok: true } | { ok: false; reason: ReviewIneligibleReason } {
  const { reviewerUid, booking, alreadyReviewed, now } = input;
  if (reviewerUid !== booking.customerId) return { ok: false, reason: "not_customer" };
  if (booking.customerId === booking.providerId) return { ok: false, reason: "self_review" };
  if (booking.status !== "completed" || booking.completedAt == null) return { ok: false, reason: "not_completed" };
  if (alreadyReviewed) return { ok: false, reason: "already_reviewed" };
  if (now - booking.completedAt > REVIEW_WINDOW_MS) return { ok: false, reason: "window_closed" };
  return { ok: true };
}

export function validateRatings(r: Partial<Record<string, unknown>>): DimensionRatings {
  const out = {} as DimensionRatings;
  for (const d of RATING_DIMENSIONS) {
    const v = r[d];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
      throw new Error(`Rating ${d} must be an integer from 1 to 5`);
    }
    out[d] = v;
  }
  return out;
}

export interface RatingAggregate {
  count: number;
  sums: DimensionRatings;
  average: number; // overall average, 0 when no reviews
}

export function emptyAggregate(): RatingAggregate {
  const sums = {} as DimensionRatings;
  for (const d of RATING_DIMENSIONS) sums[d] = 0;
  return { count: 0, sums, average: 0 };
}

/** Add (sign=1) or remove (sign=-1, e.g. moderation takedown) a review from an aggregate. */
export function applyReview(agg: RatingAggregate, ratings: DimensionRatings, sign: 1 | -1 = 1): RatingAggregate {
  const sums = { ...agg.sums };
  for (const d of RATING_DIMENSIONS) sums[d] = Math.max(0, sums[d] + sign * ratings[d]);
  const count = Math.max(0, agg.count + sign);
  const average = count === 0 ? 0 : Math.round((sums.overall / count) * 100) / 100;
  return { count, sums, average };
}

import { describe, expect, it } from "vitest";
import { applyReview, emptyAggregate, reviewEligibility, validateRatings } from "@/domain/reviews";
import { REVIEW_WINDOW_MS } from "@/domain/booking";
import { computeBadges, type BadgeEvidence } from "@/domain/badges";

const now = Date.now();
const booking = { customerId: "c", providerId: "p", status: "completed" as const, completedAt: now - 1000 };
const five = { quality: 5, professionalism: 5, communication: 5, punctuality: 5, value: 5, overall: 5 };

describe("review eligibility", () => {
  it("allows only the customer of a completed booking, once, inside the window", () => {
    expect(reviewEligibility({ reviewerUid: "c", booking, alreadyReviewed: false, now })).toEqual({ ok: true });
    expect(reviewEligibility({ reviewerUid: "p", booking, alreadyReviewed: false, now })).toMatchObject({ reason: "not_customer" });
    expect(reviewEligibility({ reviewerUid: "x", booking, alreadyReviewed: false, now })).toMatchObject({ reason: "not_customer" });
    expect(reviewEligibility({ reviewerUid: "c", booking: { ...booking, status: "confirmed" }, alreadyReviewed: false, now })).toMatchObject({ reason: "not_completed" });
    expect(reviewEligibility({ reviewerUid: "c", booking, alreadyReviewed: true, now })).toMatchObject({ reason: "already_reviewed" });
    expect(reviewEligibility({ reviewerUid: "c", booking, alreadyReviewed: false, now: now + REVIEW_WINDOW_MS + 5000 })).toMatchObject({ reason: "window_closed" });
    expect(reviewEligibility({ reviewerUid: "c", booking: { ...booking, providerId: "c" }, alreadyReviewed: false, now })).toMatchObject({ reason: "self_review" });
  });

  it("validates every dimension as an integer 1-5", () => {
    expect(validateRatings(five)).toEqual(five);
    expect(() => validateRatings({ ...five, value: 6 })).toThrow();
    expect(() => validateRatings({ ...five, overall: 4.5 })).toThrow();
    expect(() => validateRatings({ quality: 5 })).toThrow();
  });

  it("adds and removes reviews from the aggregate", () => {
    const a = applyReview(applyReview(emptyAggregate(), five), { ...five, overall: 3 });
    expect(a.count).toBe(2);
    expect(a.average).toBe(4);
    const b = applyReview(a, { ...five, overall: 3 }, -1);
    expect(b).toMatchObject({ count: 1, average: 5 });
  });
});

const base: BadgeEvidence = {
  identityStatus: "fayda_verified",
  identitySource: "fayda_oidc",
  approvalStatus: "approved",
  verifiedCredentialCount: 0,
  verifiedCareCredentialCount: 0,
  safeguardingTrainingVerified: false,
  verifiedReferenceCount: 0,
  yearsExperience: 1,
  ratingCount: 0,
  ratingAverage: 0,
  completedJobs: 0,
  appEnv: "production",
};

describe("badges", () => {
  it("grants Fayda Verified only for an official Fayda OIDC result", () => {
    expect(computeBadges(base)).toContain("fayda_verified");
    expect(computeBadges({ ...base, identitySource: "dev_fixture" })).not.toContain("fayda_verified");
    expect(computeBadges({ ...base, identityStatus: "additional_review" })).not.toContain("fayda_verified");
  });

  it("never shows the development fixture badge outside development", () => {
    expect(computeBadges({ ...base, identitySource: "dev_fixture", appEnv: "production" })).not.toContain("dev_identity_fixture");
    expect(computeBadges({ ...base, identitySource: "dev_fixture", appEnv: "development" })).toContain("dev_identity_fixture");
  });

  it("requires evidence for earned badges", () => {
    expect(computeBadges(base)).not.toContain("top_rated");
    expect(computeBadges({ ...base, ratingCount: 10, ratingAverage: 4.8, completedJobs: 20 })).toContain("top_rated");
    expect(computeBadges({ ...base, ratingCount: 9, ratingAverage: 5, completedJobs: 50 })).not.toContain("top_rated");
    expect(computeBadges({ ...base, verifiedCredentialCount: 1 })).toContain("certified_professional");
    expect(computeBadges({ ...base, yearsExperience: 6 })).not.toContain("experienced_professional");
    expect(computeBadges({ ...base, yearsExperience: 6, verifiedReferenceCount: 1 })).toContain("experienced_professional");
    expect(computeBadges({ ...base, verifiedCareCredentialCount: 1 })).not.toContain("care_qualified");
  });
});

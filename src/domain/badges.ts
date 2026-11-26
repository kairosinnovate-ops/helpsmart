import type { IdentitySource, IdentityStatus, ProviderApprovalStatus } from "./types";

/**
 * Badges are *computed* from evidence, never stored as editable flags.
 * This guarantees an administrator cannot hand out a Fayda Verified badge without
 * a validated official verification result.
 */

export type BadgeId =
  | "fayda_verified"
  | "dev_identity_fixture"
  | "helpsmart_approved"
  | "certified_professional"
  | "top_rated"
  | "care_qualified"
  | "experienced_professional";

export interface BadgeEvidence {
  identityStatus: IdentityStatus;
  identitySource: IdentitySource | null;
  approvalStatus: ProviderApprovalStatus | null;
  verifiedCredentialCount: number;
  verifiedCareCredentialCount: number;
  safeguardingTrainingVerified: boolean;
  verifiedReferenceCount: number;
  yearsExperience: number;
  ratingCount: number;
  ratingAverage: number;
  completedJobs: number;
  appEnv: string;
}

export const BADGE_RULES: Record<BadgeId, { description: string; eligible: (e: BadgeEvidence) => boolean }> = {
  fayda_verified: {
    description: "Identity verified through the official Fayda integration.",
    eligible: (e) => e.identityStatus === "fayda_verified" && e.identitySource === "fayda_oidc",
  },
  dev_identity_fixture: {
    description: "Development fixture identity. Not a real verification. Never shown outside development.",
    eligible: (e) =>
      e.appEnv === "development" && e.identityStatus === "fayda_verified" && e.identitySource === "dev_fixture",
  },
  helpsmart_approved: {
    description: "Completed HelpSmart screening and administrative approval.",
    eligible: (e) => e.approvalStatus === "approved",
  },
  certified_professional: {
    description: "At least one professional qualification independently reviewed and verified.",
    eligible: (e) => e.approvalStatus === "approved" && e.verifiedCredentialCount >= 1,
  },
  top_rated: {
    description: "Average rating of 4.7 or higher across at least 10 verified reviews and 20 completed jobs.",
    eligible: (e) => e.ratingCount >= 10 && e.ratingAverage >= 4.7 && e.completedJobs >= 20,
  },
  care_qualified: {
    description: "Verified caregiving qualification plus verified safeguarding training.",
    eligible: (e) =>
      e.approvalStatus === "approved" && e.verifiedCareCredentialCount >= 1 && e.safeguardingTrainingVerified,
  },
  experienced_professional: {
    description: "5+ years of declared experience supported by at least one verified reference.",
    eligible: (e) => e.yearsExperience >= 5 && e.verifiedReferenceCount >= 1,
  },
};

export function computeBadges(e: BadgeEvidence): BadgeId[] {
  return (Object.keys(BADGE_RULES) as BadgeId[]).filter((id) => BADGE_RULES[id].eligible(e));
}

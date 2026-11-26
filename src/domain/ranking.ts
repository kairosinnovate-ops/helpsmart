import { haversineKm } from "./geo";
import type { GeoPoint } from "./types";

/**
 * Deterministic provider ranking (spec §15). Inputs are limited to service-related signals.
 * Protected characteristics (ethnicity, religion, gender, age, language of origin, etc.) are
 * deliberately NOT part of RankableProvider, so they cannot influence ranking.
 * Paid subscriptions are also not an input: verification and safety are never pay-to-rank.
 */
export interface RankableProvider {
  id: string;
  categoryIds: string[];
  serviceCenter: GeoPoint | null;
  serviceRadiusKm: number;
  availableNow: boolean;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  yearsExperience: number;
  startingPriceMinor: number | null;
  identityVerified: boolean;
  approved: boolean;
  isBusiness: boolean;
  languages: string[];
  verifiedCredentialCount: number;
}

export type SortKey =
  | "recommended"
  | "nearest"
  | "rating"
  | "price_asc"
  | "price_desc"
  | "experience"
  | "jobs";

export interface SearchFilters {
  categoryId?: string;
  origin?: GeoPoint | null;
  maxDistanceKm?: number;
  availableNow?: boolean;
  minRating?: number;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  minYears?: number;
  verifiedQualificationsOnly?: boolean;
  language?: string;
  providerType?: "individual" | "business";
  sort?: SortKey;
}

export interface RankedProvider<T extends RankableProvider> {
  provider: T;
  distanceKm: number | null;
  score: number;
}

const PRIOR_MEAN = 4.0;
const PRIOR_WEIGHT = 5;

function bayesianRating(p: RankableProvider): number {
  return (p.ratingAverage * p.ratingCount + PRIOR_MEAN * PRIOR_WEIGHT) / (p.ratingCount + PRIOR_WEIGHT);
}

export function rankProviders<T extends RankableProvider>(providers: T[], f: SearchFilters): RankedProvider<T>[] {
  const out: RankedProvider<T>[] = [];
  for (const p of providers) {
    // Hard gates: only approved AND identity-verified providers are discoverable.
    if (!p.approved || !p.identityVerified) continue;
    if (f.categoryId && !p.categoryIds.includes(f.categoryId)) continue;
    let distanceKm: number | null = null;
    if (f.origin && p.serviceCenter) {
      distanceKm = haversineKm(f.origin, p.serviceCenter);
      // Provider must cover the customer's location.
      if (distanceKm > p.serviceRadiusKm) continue;
      if (f.maxDistanceKm != null && distanceKm > f.maxDistanceKm) continue;
    }
    if (f.availableNow && !p.availableNow) continue;
    if (f.minRating != null && p.ratingAverage < f.minRating) continue;
    if (f.minYears != null && p.yearsExperience < f.minYears) continue;
    if (f.verifiedQualificationsOnly && p.verifiedCredentialCount < 1) continue;
    if (f.language && !p.languages.includes(f.language)) continue;
    if (f.providerType === "business" && !p.isBusiness) continue;
    if (f.providerType === "individual" && p.isBusiness) continue;
    if (f.minPriceMinor != null && (p.startingPriceMinor ?? Infinity) < f.minPriceMinor) continue;
    if (f.maxPriceMinor != null && (p.startingPriceMinor ?? Infinity) > f.maxPriceMinor) continue;

    const ratingScore = bayesianRating(p) / 5; // 0..1
    const jobsScore = Math.min(1, Math.log10(1 + p.completedJobs) / 2); // saturates ~100 jobs
    const proximityScore = distanceKm == null ? 0.5 : Math.max(0, 1 - distanceKm / Math.max(1, p.serviceRadiusKm));
    const availabilityScore = p.availableNow ? 1 : 0;
    const credentialScore = Math.min(1, p.verifiedCredentialCount / 2);
    const score =
      0.35 * ratingScore + 0.2 * jobsScore + 0.25 * proximityScore + 0.1 * availabilityScore + 0.1 * credentialScore;
    out.push({ provider: p, distanceKm, score });
  }

  const sort = f.sort ?? "recommended";
  const cmp: Record<SortKey, (a: RankedProvider<T>, b: RankedProvider<T>) => number> = {
    recommended: (a, b) => b.score - a.score,
    nearest: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
    rating: (a, b) => bayesianRating(b.provider) - bayesianRating(a.provider),
    price_asc: (a, b) => (a.provider.startingPriceMinor ?? Infinity) - (b.provider.startingPriceMinor ?? Infinity),
    price_desc: (a, b) => (b.provider.startingPriceMinor ?? -1) - (a.provider.startingPriceMinor ?? -1),
    experience: (a, b) => b.provider.yearsExperience - a.provider.yearsExperience,
    jobs: (a, b) => b.provider.completedJobs - a.provider.completedJobs,
  };
  // Stable tie-break on id keeps results deterministic.
  return out.sort((a, b) => cmp[sort](a, b) || a.provider.id.localeCompare(b.provider.id));
}

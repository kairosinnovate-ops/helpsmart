import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { badRequest, forbidden, notFound } from "../errors";
import { env } from "../env";
import { computeBadges, type BadgeId } from "@/domain/badges";
import { approximate, geohash } from "@/domain/geo";
import { rankProviders, type SearchFilters, type SortKey } from "@/domain/ranking";
import type { IdentitySource, IdentityStatus, PriceModel, ProviderApprovalStatus } from "@/domain/types";
import { listCategories, resolveArea } from "./reference";
import { notify } from "./notifications";

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

export const ProviderProfileInput = z.object({
  title: z.string().trim().min(3).max(80),
  bio: z.string().trim().min(30).max(1500),
  yearsExperience: z.number().int().min(0).max(60),
  languages: z.array(z.enum(["en", "am", "om", "ti", "so", "other"])).min(1).max(6),
  providerType: z.enum(["individual", "business"]),
  businessName: z.string().trim().max(120).optional(),
  employmentPreferences: z.array(z.enum(["on_demand", "scheduled", "recurring", "long_term"])).min(1),
  photoPath: z.string().max(300).nullable().optional(),
});

export const ProviderCategoriesInput = z.object({ categoryIds: z.array(z.string()).min(1).max(5) });

export const ProviderAreaInput = z.object({
  subCityId: z.string(),
  neighborhoodId: z.string().nullable().optional(),
  radiusKm: z.number().min(1).max(40),
  travelPreference: z.enum(["neighbourhood_only", "within_radius", "anywhere_in_city"]),
});

export const ProviderPricingInput = z.object({
  model: z.enum(["hourly", "daily", "fixed", "negotiable", "quote"]),
  rateMinor: z.number().int().min(0).max(100_000_00).nullable(),
  callOutFeeMinor: z.number().int().min(0).max(10_000_00).default(0),
  cancellationPolicy: z.enum(["flexible", "moderate", "strict"]).default("moderate"),
});

export const ProviderAvailabilityInput = z.object({
  availableNow: z.boolean(),
  workingDays: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  acceptsRecurring: z.boolean().default(true),
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).default([]),
});

export const ReferenceInput = z.object({
  name: z.string().trim().min(2).max(80),
  relationship: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(9).max(20),
});

export const CredentialInput = z.object({
  type: z.enum(["certificate", "trade_license", "training", "care", "safeguarding", "portfolio"]),
  title: z.string().trim().min(2).max(120),
  issuer: z.string().trim().max(120).default(""),
  storagePath: z.string().max(300),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const EDITABLE: ProviderApprovalStatus[] = ["draft", "info_required", "approved", "rejected"];

async function assertEditable(uid: string) {
  const app = await adminDb().collection(C.providerApplications).doc(uid).get();
  if (!app.exists) throw notFound("Provider application not found");
  const status = app.get("status") as ProviderApprovalStatus;
  if (!EDITABLE.includes(status)) throw forbidden("Your application is being reviewed. Edits are paused.", "application_locked");
  return status;
}

export async function saveProviderSection(
  uid: string,
  section: "profile" | "categories" | "area" | "pricing" | "availability",
  input: unknown,
) {
  const status = await assertEditable(uid);
  const db = adminDb();
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (section === "profile") {
    const d = ProviderProfileInput.parse(input);
    if (d.photoPath && !d.photoPath.startsWith(`providers/${uid}/`)) throw forbidden("Invalid photo path");
    Object.assign(update, d);
  } else if (section === "categories") {
    const d = ProviderCategoriesInput.parse(input);
    const active = new Set((await listCategories()).map((c) => c.id));
    for (const id of d.categoryIds) if (!active.has(id)) throw badRequest(`Category ${id} is not available`, "category_inactive");
    update.categoryIds = d.categoryIds;
  } else if (section === "area") {
    const d = ProviderAreaInput.parse(input);
    const area = await resolveArea(d.subCityId, d.neighborhoodId ?? null);
    update.serviceArea = {
      cityId: area.cityId,
      subCityId: area.subCity.id,
      subCityName: area.subCity.names.en,
      neighborhoodId: area.neighborhood?.id ?? null,
      neighborhoodName: area.neighborhood?.names.en ?? null,
      // Neighbourhood centroid, never the provider's home.
      center: approximate(area.center),
      geohash: geohash(area.center, 6),
      radiusKm: d.travelPreference === "anywhere_in_city" ? 40 : d.travelPreference === "neighbourhood_only" ? Math.min(d.radiusKm, 3) : d.radiusKm,
      travelPreference: d.travelPreference,
    };
  } else if (section === "pricing") {
    const d = ProviderPricingInput.parse(input);
    if ((d.model === "hourly" || d.model === "daily" || d.model === "fixed") && !d.rateMinor) {
      throw badRequest("Set a rate for this pricing model", "rate_required");
    }
    update.pricing = d;
  } else if (section === "availability") {
    update.availability = ProviderAvailabilityInput.parse(input);
  }
  await db.collection(C.providerProfiles).doc(uid).set(update, { merge: true });
  if (status === "approved") await refreshPublicProfile(uid);
}

export async function addReference(uid: string, input: unknown) {
  await assertEditable(uid);
  const d = ReferenceInput.parse(input);
  const { normalizeEthiopianPhone } = await import("@/domain/phone");
  const phone = normalizeEthiopianPhone(d.phone);
  if (!phone) throw badRequest("Enter a valid Ethiopian phone number", "invalid_phone");
  const col = adminDb().collection(C.providerReferences);
  const existing = await col.where("providerId", "==", uid).count().get();
  if (existing.data().count >= 5) throw badRequest("Up to 5 references");
  await col.add({ providerId: uid, name: d.name, relationship: d.relationship, phoneE164: phone, status: "pending", createdAt: FieldValue.serverTimestamp() });
}

export async function addCredential(uid: string, input: unknown) {
  await assertEditable(uid);
  const d = CredentialInput.parse(input);
  if (!d.storagePath.startsWith(`credentials/${uid}/`)) throw forbidden("Invalid file path");
  const col = adminDb().collection(C.professionalCredentials);
  const existing = await col.where("providerId", "==", uid).count().get();
  if (existing.data().count >= 15) throw badRequest("Up to 15 documents");
  await col.add({ providerId: uid, ...d, expiresAt: d.expiresAt ?? null, status: "pending", createdAt: FieldValue.serverTimestamp() });
}

export interface ProviderWorkspace {
  profile: Record<string, unknown> | null;
  application: { status: ProviderApprovalStatus; notes: string | null; submittedAt: number | null };
  credentials: { id: string; type: string; title: string; status: string; expiresAt: string | null }[];
  references: { id: string; name: string; relationship: string; status: string }[];
  completion: { percent: number; missing: string[] };
}

export function profileCompletion(p: Record<string, unknown> | null, identityOk: boolean) {
  const checks: [string, boolean][] = [
    ["identity", identityOk],
    ["profile", !!(p?.title && p?.bio)],
    ["categories", Array.isArray(p?.categoryIds) && (p!.categoryIds as unknown[]).length > 0],
    ["area", !!p?.serviceArea],
    ["pricing", !!p?.pricing],
    ["availability", !!p?.availability],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { percent: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
}

export async function getProviderWorkspace(uid: string, identityOk: boolean): Promise<ProviderWorkspace> {
  const db = adminDb();
  const [p, a, creds, refs] = await Promise.all([
    db.collection(C.providerProfiles).doc(uid).get(),
    db.collection(C.providerApplications).doc(uid).get(),
    db.collection(C.professionalCredentials).where("providerId", "==", uid).get(),
    db.collection(C.providerReferences).where("providerId", "==", uid).get(),
  ]);
  const profile = p.exists ? (p.data() as Record<string, unknown>) : null;
  return {
    profile,
    application: {
      status: (a.get("status") as ProviderApprovalStatus) ?? "draft",
      notes: (a.get("reviewNotes") as string) ?? null,
      submittedAt: a.get("submittedAt")?.toMillis?.() ?? null,
    },
    credentials: creds.docs.map((d) => ({ id: d.id, type: d.get("type"), title: d.get("title"), status: d.get("status"), expiresAt: d.get("expiresAt") ?? null })),
    references: refs.docs.map((d) => ({ id: d.id, name: d.get("name"), relationship: d.get("relationship"), status: d.get("status") })),
    completion: profileCompletion(profile, identityOk),
  };
}

export async function submitApplication(uid: string, identityOk: boolean) {
  const status = await assertEditable(uid);
  if (status === "approved") throw badRequest("Your application is already approved");
  const p = await adminDb().collection(C.providerProfiles).doc(uid).get();
  const c = profileCompletion(p.exists ? (p.data() as Record<string, unknown>) : null, identityOk);
  if (c.missing.length) throw badRequest(`Complete these steps first: ${c.missing.join(", ")}`, "application_incomplete");
  await adminDb()
    .collection(C.providerApplications)
    .doc(uid)
    .update({
      status: "submitted",
      submittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion({ status: "submitted", at: Date.now(), by: uid }),
    });
  await audit({ actorId: uid, actorRole: "provider", action: "provider.application_submitted", targetType: "providerApplication", targetId: uid });
}

/* ------------------------------------------------------------------ */
/* Admin review                                                        */
/* ------------------------------------------------------------------ */

export const ReviewDecisionInput = z.object({
  decision: z.enum(["start_review", "approve", "reject", "request_info", "suspend", "reinstate"]),
  notes: z.string().trim().max(1000).default(""),
});

export async function decideApplication(admin: { uid: string; role: string }, providerId: string, input: unknown) {
  const { decision, notes } = ReviewDecisionInput.parse(input);
  const db = adminDb();
  const ref = db.collection(C.providerApplications).doc(providerId);
  const allowed: Record<string, ProviderApprovalStatus[]> = {
    start_review: ["submitted"],
    approve: ["submitted", "under_review"],
    reject: ["submitted", "under_review", "info_required"],
    request_info: ["submitted", "under_review"],
    suspend: ["approved"],
    reinstate: ["suspended"],
  };
  const to: Record<string, ProviderApprovalStatus> = {
    start_review: "under_review",
    approve: "approved",
    reject: "rejected",
    request_info: "info_required",
    suspend: "suspended",
    reinstate: "approved",
  };
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) throw notFound("Application not found");
    const cur = s.get("status") as ProviderApprovalStatus;
    if (!allowed[decision].includes(cur)) throw badRequest(`Cannot ${decision} an application that is ${cur}`, "invalid_state");
    if (decision === "approve") {
      const u = await tx.get(db.collection(C.users).doc(providerId));
      if (u.get("identityStatus") !== "fayda_verified") {
        throw forbidden("Provider identity must be verified before approval", "identity_not_verified");
      }
    }
    tx.update(ref, {
      status: to[decision],
      reviewNotes: notes || null,
      reviewedBy: admin.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion({ status: to[decision], at: Date.now(), by: admin.uid }),
    });
  });
  await audit({ actorId: admin.uid, actorRole: admin.role, action: `provider.${decision}`, targetType: "providerApplication", targetId: providerId });
  await notify(providerId, {
    type: "provider_approval",
    title:
      decision === "approve" ? "You're approved on HelpSmart Pro" : decision === "request_info" ? "We need more information" : "Application update",
    body:
      decision === "approve"
        ? "Your profile is now visible to customers in your service area."
        : notes || "Your application status has changed. Open HelpSmart Pro for details.",
    link: "/pro",
  });
  await refreshPublicProfile(providerId);
}

export async function verifyCredential(admin: { uid: string; role: string }, credentialId: string, status: "verified" | "rejected") {
  const ref = adminDb().collection(C.professionalCredentials).doc(credentialId);
  const s = await ref.get();
  if (!s.exists) throw notFound("Credential not found");
  await ref.update({ status, reviewedBy: admin.uid, reviewedAt: FieldValue.serverTimestamp() });
  await audit({ actorId: admin.uid, actorRole: admin.role, action: `credential.${status}`, targetType: "credential", targetId: credentialId });
  await refreshPublicProfile(s.get("providerId"));
}

export async function verifyReference(admin: { uid: string; role: string }, referenceId: string, status: "verified" | "rejected") {
  const ref = adminDb().collection(C.providerReferences).doc(referenceId);
  const s = await ref.get();
  if (!s.exists) throw notFound("Reference not found");
  await ref.update({ status, reviewedBy: admin.uid, reviewedAt: FieldValue.serverTimestamp() });
  await audit({ actorId: admin.uid, actorRole: admin.role, action: `reference.${status}`, targetType: "reference", targetId: referenceId });
  await refreshPublicProfile(s.get("providerId"));
}

/* ------------------------------------------------------------------ */
/* Public profile projection                                           */
/* ------------------------------------------------------------------ */

export interface PublicProfile {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  photoPath: string | null;
  categoryIds: string[];
  languages: string[];
  yearsExperience: number;
  providerType: "individual" | "business";
  businessName: string | null;
  cityId: string;
  subCityName: string;
  neighborhoodName: string | null;
  serviceCenter: { lat: number; lng: number };
  serviceRadiusKm: number;
  geohash: string;
  pricing: { model: PriceModel; rateMinor: number | null; callOutFeeMinor: number; cancellationPolicy: string };
  availableNow: boolean;
  workingDays: number[];
  hours: { start: string; end: string };
  acceptsRecurring: boolean;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  verifiedCredentialCount: number;
  badges: BadgeId[];
  isDemo: boolean;
  identityVerified: boolean;
  approved: boolean;
}

function identityCounts(status: IdentityStatus, source: IdentitySource | null): boolean {
  if (status !== "fayda_verified") return false;
  if (source === "fayda_oidc") return true;
  const e = env();
  return source === "dev_fixture" && (e.APP_ENV === "development" || e.APP_ENV === "test") && e.IDENTITY_MODE === "dev_fixture";
}

/**
 * Rebuilds the publicly readable projection of a provider. It exists only while the provider is
 * approved, identity-verified and active. It never contains phone numbers, ID data or exact locations.
 */
export async function refreshPublicProfile(uid: string) {
  const db = adminDb();
  const [u, p, a, creds, refs] = await Promise.all([
    db.collection(C.users).doc(uid).get(),
    db.collection(C.providerProfiles).doc(uid).get(),
    db.collection(C.providerApplications).doc(uid).get(),
    db.collection(C.professionalCredentials).where("providerId", "==", uid).where("status", "==", "verified").get(),
    db.collection(C.providerReferences).where("providerId", "==", uid).where("status", "==", "verified").get(),
  ]);
  const pubRef = db.collection(C.publicProfiles).doc(uid);
  if (!u.exists || !p.exists || !a.exists) {
    await pubRef.delete();
    return;
  }
  const identityStatus = u.get("identityStatus") as IdentityStatus;
  const identitySource = (u.get("identitySource") as IdentitySource) ?? null;
  const approvalStatus = a.get("status") as ProviderApprovalStatus;
  const prof = p.data()!;
  const identityVerified = identityCounts(identityStatus, identitySource);
  const discoverable =
    identityVerified &&
    approvalStatus === "approved" &&
    u.get("accountStatus") === "active" &&
    !!prof.serviceArea &&
    !!prof.pricing &&
    Array.isArray(prof.categoryIds) &&
    prof.categoryIds.length > 0;
  if (!discoverable) {
    await pubRef.delete();
    return;
  }
  const stats = prof.stats ?? {};
  const verifiedCreds = creds.docs.map((d) => d.get("type") as string);
  const badges = computeBadges({
    identityStatus,
    identitySource,
    approvalStatus,
    verifiedCredentialCount: verifiedCreds.filter((t) => t !== "portfolio").length,
    verifiedCareCredentialCount: verifiedCreds.filter((t) => t === "care").length,
    safeguardingTrainingVerified: verifiedCreds.includes("safeguarding"),
    verifiedReferenceCount: refs.size,
    yearsExperience: prof.yearsExperience ?? 0,
    ratingCount: stats.ratingCount ?? 0,
    ratingAverage: stats.ratingAverage ?? 0,
    completedJobs: stats.completedJobs ?? 0,
    appEnv: env().APP_ENV,
  });
  const doc: Omit<PublicProfile, "id"> & { updatedAt: FirebaseFirestore.FieldValue } = {
    displayName: u.get("displayName"),
    title: prof.title,
    bio: prof.bio,
    photoPath: prof.photoPath ?? null,
    categoryIds: prof.categoryIds,
    languages: prof.languages ?? [],
    yearsExperience: prof.yearsExperience ?? 0,
    providerType: prof.providerType ?? "individual",
    businessName: prof.businessName ?? null,
    cityId: prof.serviceArea.cityId,
    subCityName: prof.serviceArea.subCityName,
    neighborhoodName: prof.serviceArea.neighborhoodName ?? null,
    serviceCenter: prof.serviceArea.center,
    serviceRadiusKm: prof.serviceArea.radiusKm,
    geohash: prof.serviceArea.geohash,
    pricing: {
      model: prof.pricing.model,
      rateMinor: prof.pricing.rateMinor ?? null,
      callOutFeeMinor: prof.pricing.callOutFeeMinor ?? 0,
      cancellationPolicy: prof.pricing.cancellationPolicy ?? "moderate",
    },
    availableNow: !!prof.availability?.availableNow,
    workingDays: prof.availability?.workingDays ?? [],
    hours: { start: prof.availability?.startTime ?? "08:00", end: prof.availability?.endTime ?? "18:00" },
    acceptsRecurring: prof.availability?.acceptsRecurring ?? false,
    ratingAverage: stats.ratingAverage ?? 0,
    ratingCount: stats.ratingCount ?? 0,
    completedJobs: stats.completedJobs ?? 0,
    verifiedCredentialCount: verifiedCreds.length,
    badges,
    isDemo: !!u.get("isDemo"),
    identityVerified,
    approved: true,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await pubRef.set(doc);
}

export async function setAvailableNow(uid: string, availableNow: boolean) {
  await adminDb().collection(C.providerProfiles).doc(uid).set({ availability: { availableNow } }, { merge: true });
  await refreshPublicProfile(uid);
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const s = await adminDb().collection(C.publicProfiles).doc(id).get();
  if (!s.exists) return null;
  const d = s.data() as PublicProfile;
  // Demo profiles never leak into staging/production views.
  if (d.isDemo && env().APP_ENV !== "development" && env().APP_ENV !== "test") return null;
  return { ...d, id: s.id };
}

export async function searchProviders(
  f: SearchFilters & { q?: string; cityId?: string; page?: number; pageSize?: number },
) {
  let q: FirebaseFirestore.Query = adminDb()
    .collection(C.publicProfiles)
    .where("cityId", "==", f.cityId ?? "addis-ababa");
  if (f.categoryId) q = q.where("categoryIds", "array-contains", f.categoryId);
  // MVP scale: fetch the city's candidates (bounded) and rank in memory. At scale, switch to
  // geohash-prefix range queries per covering cell (geohash already stored on each profile).
  const snap = await q.limit(500).get();
  const allowDemo = env().APP_ENV === "development" || env().APP_ENV === "test";
  let candidates = snap.docs
    .map((d) => ({ ...(d.data() as PublicProfile), id: d.id }))
    .filter((p) => allowDemo || !p.isDemo)
    .map((p) => ({ ...p, serviceCenter: p.serviceCenter, startingPriceMinor: p.pricing.rateMinor, isBusiness: p.providerType === "business" }));
  if (f.q) {
    const needle = f.q.toLowerCase();
    candidates = candidates.filter((p) => `${p.displayName} ${p.title} ${p.bio} ${p.businessName ?? ""}`.toLowerCase().includes(needle));
  }
  const ranked = rankProviders(candidates, f);
  const pageSize = Math.min(f.pageSize ?? 20, 50);
  const page = Math.max(1, f.page ?? 1);
  return {
    total: ranked.length,
    page,
    pageSize,
    results: ranked.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ ...r.provider, distanceKm: r.distanceKm })),
  };
}

export const SearchQuery = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(40).optional(),
  subCity: z.string().max(40).optional(),
  neighborhood: z.string().max(40).optional(),
  maxKm: z.coerce.number().min(1).max(50).optional(),
  availableNow: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minYears: z.coerce.number().min(0).max(60).optional(),
  certified: z.coerce.boolean().optional(),
  language: z.string().max(10).optional(),
  type: z.enum(["individual", "business"]).optional(),
  sort: z.enum(["recommended", "nearest", "rating", "price_asc", "price_desc", "experience", "jobs"]).optional(),
  lat: z.coerce.number().min(3).max(15).optional(),
  lng: z.coerce.number().min(33).max(48).optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
});

export async function searchFromQuery(raw: Record<string, string | undefined>) {
  const s = SearchQuery.parse(raw);
  let origin: { lat: number; lng: number } | null = null;
  if (s.lat != null && s.lng != null) origin = { lat: s.lat, lng: s.lng };
  else if (s.subCity) origin = (await resolveArea(s.subCity, s.neighborhood ?? null)).center;
  return searchProviders({
    q: s.q,
    categoryId: s.category,
    origin,
    maxDistanceKm: s.maxKm,
    availableNow: s.availableNow,
    minRating: s.minRating,
    minPriceMinor: s.minPrice != null ? s.minPrice * 100 : undefined,
    maxPriceMinor: s.maxPrice != null ? s.maxPrice * 100 : undefined,
    minYears: s.minYears,
    verifiedQualificationsOnly: s.certified,
    language: s.language,
    providerType: s.type,
    sort: s.sort as SortKey | undefined,
    page: s.page,
  });
}

/* ------------------------------------------------------------------ */
/* Saved providers                                                     */
/* ------------------------------------------------------------------ */

export async function toggleSavedProvider(uid: string, providerId: string, save: boolean) {
  const ref = adminDb().collection(C.savedProviders).doc(`${uid}_${providerId}`);
  if (save) {
    const p = await getPublicProfile(providerId);
    if (!p) throw notFound("Provider not found");
    await ref.set({ uid, providerId, createdAt: FieldValue.serverTimestamp() });
  } else {
    await ref.delete();
  }
}

export async function listSavedProviders(uid: string): Promise<PublicProfile[]> {
  const s = await adminDb().collection(C.savedProviders).where("uid", "==", uid).limit(50).get();
  const profiles = await Promise.all(s.docs.map((d) => getPublicProfile(d.get("providerId"))));
  return profiles.filter((p): p is PublicProfile => !!p);
}

export async function isSaved(uid: string, providerId: string) {
  return (await adminDb().collection(C.savedProviders).doc(`${uid}_${providerId}`).get()).exists;
}

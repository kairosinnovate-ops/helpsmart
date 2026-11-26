import "./setup-env";
import { beforeAll, describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { CATEGORY_SEED, DEFAULT_PLATFORM_SETTINGS, REGION_SEED } from "@/data/reference";
import { adminDb } from "@/server/firebase/admin";
import { C } from "@/server/collections";
import { createAccount } from "@/server/services/accounts";
import { decideApplication, getPublicProfile, saveProviderSection, submitApplication } from "@/server/services/providers";
import { startVerification, completeVerification } from "@/server/identity/service";
import { confirmOffPlatformPayment, createBooking, transitionBooking } from "@/server/services/bookings";
import { createReview } from "@/server/services/reviews";

const run = Date.now().toString(36);
const customer = { uid: `cust-${run}`, displayName: "Test Customer" };
const provider = { uid: `prov-${run}`, displayName: "Test Provider" };
const other = { uid: `other-${run}`, displayName: "Other Customer" };
const admin = { uid: "admin-test", role: "super_admin" };
const five = { quality: 5, professionalism: 5, communication: 4, punctuality: 5, value: 4, overall: 5 };

/** Runs the real verification flow with the development fixture (never Fayda). */
async function verify(uid: string, seed: string) {
  const { redirectUrl } = await startVerification(uid, { accepted: true });
  const state = new URL(redirectUrl).searchParams.get("state")!;
  return { state, outcome: await completeVerification({ currentUid: uid, state, code: `fixture.success.${seed}`, error: null }) };
}

beforeAll(async () => {
  const db = adminDb();
  const b = db.batch();
  for (const c of CATEGORY_SEED) b.set(db.collection(C.serviceCategories).doc(c.id), c);
  for (const r of REGION_SEED) b.set(db.collection(C.geographicRegions).doc(r.id), r);
  b.set(db.collection(C.platformSettings).doc("marketplace"), DEFAULT_PLATFORM_SETTINGS);
  await b.commit();
  const base = { phone: "0911000000", locale: "en", acceptTerms: true, acceptPrivacy: true };
  await createAccount(customer.uid, `${customer.uid}@example.invalid`, { ...base, accountType: "customer", displayName: customer.displayName });
  await createAccount(other.uid, `${other.uid}@example.invalid`, { ...base, accountType: "customer", displayName: other.displayName });
  await createAccount(provider.uid, `${provider.uid}@example.invalid`, { ...base, accountType: "provider", displayName: provider.displayName, providerType: "individual" });
});

describe("identity verification (development fixture)", () => {
  it("verifies once and blocks a replayed callback", async () => {
    const { state, outcome } = await verify(customer.uid, `c-${run}`);
    expect(outcome).toBe("verified");
    const u = await adminDb().collection(C.users).doc(customer.uid).get();
    expect(u.get("identityStatus")).toBe("fayda_verified");
    expect(u.get("identitySource")).toBe("dev_fixture");
    const replay = await completeVerification({ currentUid: customer.uid, state, code: `fixture.success.c-${run}`, error: null });
    expect(replay).toBe("replay");
  });

  it("never stores the raw subject, only an HMAC", async () => {
    const recs = await adminDb().collection(C.identityVerificationRecords).where("uid", "==", customer.uid).get();
    const raw = JSON.stringify(recs.docs.map((d) => d.data()));
    expect(raw).not.toContain(`dev-c-${run}`);
    const priv = await adminDb().collection(C.privateIdentityRecords).doc(customer.uid).get();
    expect(typeof priv.get("claims")).toBe("string"); // encrypted blob
    expect(priv.get("claims")).not.toContain("Dev Fixture Person");
  });

  it("sends a duplicate identity to additional review", async () => {
    const { outcome } = await verify(other.uid, `c-${run}`);
    expect(outcome).toBe("additional_review");
    expect((await adminDb().collection(C.users).doc(other.uid).get()).get("identityStatus")).toBe("additional_review");
  });

  it("rejects a callback that arrives in a different account", async () => {
    const { redirectUrl } = await startVerification(provider.uid, { accepted: true });
    const state = new URL(redirectUrl).searchParams.get("state")!;
    expect(await completeVerification({ currentUid: customer.uid, state, code: `fixture.success.p-${run}`, error: null })).toBe("failed");
  });

  it("treats a bad signature as failed and an outage as unavailable", async () => {
    const s1 = new URL((await startVerification(provider.uid, { accepted: true })).redirectUrl).searchParams.get("state")!;
    expect(await completeVerification({ currentUid: provider.uid, state: s1, code: "fixture.invalid_signature.x", error: null })).toBe("failed");
    const s2 = new URL((await startVerification(provider.uid, { accepted: true })).redirectUrl).searchParams.get("state")!;
    expect(await completeVerification({ currentUid: provider.uid, state: s2, code: "fixture.unavailable.x", error: null })).toBe("unavailable");
  });

  it("records a cancellation", async () => {
    const s = new URL((await startVerification(provider.uid, { accepted: true })).redirectUrl).searchParams.get("state")!;
    expect(await completeVerification({ currentUid: provider.uid, state: s, code: null, error: "access_denied" })).toBe("cancelled");
  });
});

describe("provider approval and booking lifecycle", () => {
  it("cannot approve a provider whose identity is not verified", async () => {
    await saveProviderSection(provider.uid, "profile", { title: "Licensed plumber", bio: "Fixes leaks, drains and water tanks across Bole and Yeka.", yearsExperience: 6, languages: ["am", "en"], providerType: "individual", employmentPreferences: ["on_demand"] });
    await saveProviderSection(provider.uid, "categories", { categoryIds: ["plumbing"] });
    await saveProviderSection(provider.uid, "area", { subCityId: "bole", neighborhoodId: null, radiusKm: 10, travelPreference: "within_radius" });
    await saveProviderSection(provider.uid, "pricing", { model: "hourly", rateMinor: 300_00, callOutFeeMinor: 0, cancellationPolicy: "moderate" });
    await saveProviderSection(provider.uid, "availability", { availableNow: true, workingDays: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "18:00", acceptsRecurring: true, blockedDates: [] });
    await submitApplication(provider.uid, true);
    await expect(decideApplication(admin, provider.uid, { decision: "approve" })).rejects.toMatchObject({ code: "identity_not_verified" });
    expect(await getPublicProfile(provider.uid)).toBeNull();
  });

  it("publishes the profile only after verification and approval", async () => {
    expect((await verify(provider.uid, `p-${run}`)).outcome).toBe("verified");
    await decideApplication(admin, provider.uid, { decision: "approve" });
    const pub = await getPublicProfile(provider.uid);
    expect(pub).not.toBeNull();
    expect(pub!.badges).toContain("helpsmart_approved");
    expect(pub!.badges).not.toContain("fayda_verified"); // fixture identity never earns the Fayda badge
    expect(JSON.stringify(pub)).not.toMatch(/phone|email/i);
  });

  let bookingId = "";
  it("books, hides the address until confirmed, completes, pays and reviews", async () => {
    const b = await createBooking(customer, {
      providerId: provider.uid,
      categoryId: "plumbing",
      description: "Kitchen sink is leaking under the cabinet.",
      urgency: "now",
      quantity: 2,
      paymentMethod: "cash",
      address: { subCityId: "bole", landmark: "Near Edna Mall", directions: "Blue gate, 3rd floor" },
    });
    bookingId = b;
    const snap = await adminDb().collection(C.bookings).doc(bookingId).get();
    expect(snap.get("status")).toBe("awaiting_provider_response");
    expect(snap.get("breakdown.commissionMinor")).toBe(72_00);

    await expect(createReview(customer.uid, bookingId, { ratings: five })).rejects.toBeTruthy();
    await expect(transitionBooking(customer.uid, bookingId, { action: "accept" })).rejects.toBeTruthy();
    await expect(transitionBooking(other.uid, bookingId, { action: "cancel" })).rejects.toBeTruthy();

    for (const action of ["accept", "start", "complete"]) await transitionBooking(provider.uid, bookingId, { action });
    expect((await adminDb().collection(C.bookings).doc(bookingId).get()).get("status")).toBe("completed");

    expect(await confirmOffPlatformPayment(customer.uid, bookingId)).not.toBe("paid");
    expect(await confirmOffPlatformPayment(provider.uid, bookingId)).toBe("paid");
    const tx = await adminDb().collection(C.transactions).where("bookingId", "==", bookingId).get();
    expect(tx.size).toBeGreaterThan(0);

    await createReview(customer.uid, bookingId, { ratings: five, comment: "Quick and tidy." });
    await expect(createReview(customer.uid, bookingId, { ratings: five })).rejects.toBeTruthy();
    await expect(createReview(provider.uid, bookingId, { ratings: five })).rejects.toBeTruthy();
    const prof = await adminDb().collection(C.providerProfiles).doc(provider.uid).get();
    expect(prof.get("stats.ratingCount")).toBe(1);
  });

  it("removes the public profile when the provider is suspended", async () => {
    await decideApplication(admin, provider.uid, { decision: "suspend", notes: "test" });
    expect(await getPublicProfile(provider.uid)).toBeNull();
    await adminDb().collection(C.auditLogs).add({ actorId: "test", action: "test.cleanup", at: FieldValue.serverTimestamp() });
  });
});

/**
 * Seeds reference data (service categories, Addis Ababa regions, platform settings).
 *
 *   npm run seed                 # reference data, emulator only
 *   npm run seed -- --demo       # plus clearly labelled demo providers (emulator only)
 *   npm run seed -- --project    # reference data into the configured real project (never demo data)
 *
 * Demo providers are marked isDemo, named "Demo ...", use the development identity fixture (never
 * Fayda), and are hidden by the app outside development. The script refuses to write demo data
 * anywhere except the local emulator.
 *
 * Run with `--conditions=react-server` (see package.json) so it can reuse the real server services.
 */
import { FieldValue } from "firebase-admin/firestore";
import { CATEGORY_SEED, REGION_SEED, DEFAULT_PLATFORM_SETTINGS } from "../src/data/reference";
import { adminAuth, adminDb } from "../src/server/firebase/admin";
import { C } from "../src/server/collections";

const args = new Set(process.argv.slice(2));
const onEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

async function seedReference() {
  const db = adminDb();
  const batch = db.batch();
  for (const c of CATEGORY_SEED) batch.set(db.collection(C.serviceCategories).doc(c.id), { ...c, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  for (const r of REGION_SEED) batch.set(db.collection(C.geographicRegions).doc(r.id), { ...r, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  // Settings are created once and then owned by administrators; never overwrite an existing document.
  const settings = db.collection(C.platformSettings).doc("marketplace");
  if (!(await settings.get()).exists) batch.set(settings, { ...DEFAULT_PLATFORM_SETTINGS, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  console.log(`Seeded ${CATEGORY_SEED.length} categories and ${REGION_SEED.length} regions.`);
}

const DEMO = [
  { name: "Demo Provider Abebe", title: "Plumber, leaks and installations", cats: ["plumbing"], sub: "bole", years: 8, model: "hourly", rate: 350_00 },
  { name: "Demo Provider Hirut", title: "Home and apartment cleaning", cats: ["house-cleaning", "domestic-help"], sub: "yeka", years: 5, model: "daily", rate: 900_00 },
  { name: "Demo Provider Dawit", title: "Electrician, wiring and fault finding", cats: ["electrical"], sub: "kirkos", years: 11, model: "hourly", rate: 400_00 },
  { name: "Demo Provider Meron", title: "Handyman and furniture assembly", cats: ["handyman"], sub: "nifas-silk-lafto", years: 3, model: "quote", rate: null },
] as const;

async function seedDemo() {
  if (!onEmulator) throw new Error("Refusing to create demo data outside the Firestore emulator.");
  process.env.APP_ENV ??= "development";
  process.env.IDENTITY_MODE ??= "dev_fixture";
  const { createAccount } = await import("../src/server/services/accounts");
  const { saveProviderSection, submitApplication, decideApplication } = await import("../src/server/services/providers");
  const db = adminDb();
  const seedAdmin = { uid: "seed-script", role: "super_admin" };
  for (const [i, d] of DEMO.entries()) {
    const uid = `demo-provider-${i + 1}`;
    if ((await db.collection(C.users).doc(uid).get()).exists) continue;
    await adminAuth().createUser({ uid, email: `${uid}@example.invalid`, password: "demo-password-not-for-production", displayName: d.name }).catch(() => undefined);
    await createAccount(uid, `${uid}@example.invalid`, { accountType: "provider", displayName: d.name, phone: `0911${String(100000 + i).slice(-6)}`, locale: "en", acceptTerms: true, acceptPrivacy: true, providerType: "individual" });
    // Development identity fixture: counts only in development, never shows the Fayda Verified badge.
    await db.collection(C.users).doc(uid).update({ isDemo: true, identityStatus: "fayda_verified", identitySource: "dev_fixture", identityVerifiedAt: FieldValue.serverTimestamp() });
    await saveProviderSection(uid, "profile", { title: d.title, bio: `${d.name} is a demo profile for local development. It is not a real person and cannot be booked in production.`, yearsExperience: d.years, languages: ["am", "en"], providerType: "individual", employmentPreferences: ["on_demand", "scheduled"] });
    await saveProviderSection(uid, "categories", { categoryIds: [...d.cats] });
    await saveProviderSection(uid, "area", { subCityId: d.sub, neighborhoodId: null, radiusKm: 8, travelPreference: "within_radius" });
    await saveProviderSection(uid, "pricing", { model: d.model, rateMinor: d.rate, callOutFeeMinor: 0, cancellationPolicy: "moderate" });
    await saveProviderSection(uid, "availability", { availableNow: i % 2 === 0, workingDays: [1, 2, 3, 4, 5, 6], startTime: "08:00", endTime: "18:00", acceptsRecurring: true, blockedDates: [] });
    await submitApplication(uid, true);
    await decideApplication(seedAdmin, uid, { decision: "approve", notes: "Demo data (seed script)" });
    console.log(`Created ${d.name}`);
  }
}

async function main() {
  if (!onEmulator && !args.has("--project")) {
    throw new Error("FIRESTORE_EMULATOR_HOST is not set. Start the emulators, or pass --project to seed reference data into a real project.");
  }
  if (!onEmulator && process.env.APP_ENV === "production" && !args.has("--confirm-production")) {
    throw new Error("Seeding production needs --project --confirm-production. Only reference data is written.");
  }
  await seedReference();
  if (args.has("--demo")) await seedDemo();
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

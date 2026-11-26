import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { badRequest, conflict, notFound } from "../errors";
import { normalizeEthiopianPhone } from "@/domain/phone";
import { LOCALES } from "@/domain/types";
import { resolveArea } from "./reference";

export const LEGAL_VERSIONS = { terms: "draft-2026-11", privacy: "draft-2026-11" } as const;

export const CreateAccountInput = z.object({
  accountType: z.enum(["customer", "provider"]),
  displayName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(9).max(20),
  locale: z.enum(LOCALES as [string, ...string[]]).default("en"),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  providerType: z.enum(["individual", "business"]).optional(),
});

/** Called once right after Firebase Auth sign-up. Creates the HelpSmart account records. */
export async function createAccount(uid: string, email: string | null, input: unknown) {
  const data = CreateAccountInput.parse(input);
  const phoneE164 = normalizeEthiopianPhone(data.phone);
  if (!phoneE164) throw badRequest("Enter a valid Ethiopian mobile number (+251 9… or +251 7…)", "invalid_phone");

  const db = adminDb();
  const userRef = db.collection(C.users).doc(uid);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(userRef);
    if (existing.exists) throw conflict("Account already exists", "account_exists");
    const roles = data.accountType === "provider" ? ["customer", "provider"] : ["customer"];
    tx.set(userRef, {
      uid,
      displayName: data.displayName,
      email: email?.toLowerCase() ?? null,
      phoneE164,
      locale: data.locale,
      roles,
      primaryRole: data.accountType,
      accountStatus: "active",
      identityStatus: "unverified",
      identitySource: null,
      identityVerifiedAt: null,
      consents: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy, acceptedAt: FieldValue.serverTimestamp() },
      onboarding: { completed: false },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection(C.customerProfiles).doc(uid), {
      uid,
      preferredCategoryIds: [],
      createdAt: FieldValue.serverTimestamp(),
    });
    if (data.accountType === "provider") {
      tx.set(db.collection(C.providerProfiles).doc(uid), {
        uid,
        providerType: data.providerType ?? "individual",
        displayName: data.displayName,
        stats: { ratingCount: 0, ratingSums: null, ratingAverage: 0, completedJobs: 0 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection(C.providerApplications).doc(uid), {
        uid,
        status: "draft",
        history: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
  await audit({ actorId: uid, actorRole: data.accountType, action: "account.created", targetType: "user", targetId: uid });
}

/** Lets an existing customer add provider capabilities (subject to onboarding + approval). */
export async function becomeProvider(uid: string, providerType: "individual" | "business") {
  const db = adminDb();
  const userRef = db.collection(C.users).doc(uid);
  await db.runTransaction(async (tx) => {
    const u = await tx.get(userRef);
    if (!u.exists) throw notFound("Account not found");
    const roles = new Set<string>(u.get("roles"));
    if (roles.has("provider")) return;
    roles.add("provider");
    tx.update(userRef, { roles: [...roles], updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection(C.providerProfiles).doc(uid), {
      uid,
      providerType,
      displayName: u.get("displayName"),
      stats: { ratingCount: 0, ratingSums: null, ratingAverage: 0, completedJobs: 0 },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection(C.providerApplications).doc(uid), { uid, status: "draft", history: [], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
}

export const ProfileUpdateInput = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(9).max(20).optional(),
  locale: z.enum(LOCALES as [string, ...string[]]).optional(),
  subCityId: z.string().optional(),
  neighborhoodId: z.string().nullable().optional(),
  preferredCategoryIds: z.array(z.string()).max(20).optional(),
});

export async function updateProfile(uid: string, input: unknown) {
  const d = ProfileUpdateInput.parse(input);
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (d.displayName) update.displayName = d.displayName;
  if (d.locale) update.locale = d.locale;
  if (d.phone) {
    const p = normalizeEthiopianPhone(d.phone);
    if (!p) throw badRequest("Enter a valid Ethiopian mobile number", "invalid_phone");
    update.phoneE164 = p;
  }
  if (d.subCityId) {
    const area = await resolveArea(d.subCityId, d.neighborhoodId ?? null);
    update.onboarding = { cityId: area.cityId, subCityId: area.subCity.id, neighborhoodId: area.neighborhood?.id ?? null, completed: true };
  }
  await adminDb().collection(C.users).doc(uid).update(update);
  if (d.preferredCategoryIds) {
    await adminDb().collection(C.customerProfiles).doc(uid).set({ preferredCategoryIds: d.preferredCategoryIds }, { merge: true });
  }
}

export const AddressInput = z.object({
  label: z.string().trim().min(1).max(40),
  subCityId: z.string(),
  neighborhoodId: z.string().nullable().optional(),
  landmark: z.string().trim().max(120).default(""),
  directions: z.string().trim().max(400).default(""),
  /** Optional exact map pin. Private: only shared with a confirmed provider. */
  pin: z.object({ lat: z.number().min(3).max(15), lng: z.number().min(33).max(48) }).nullable().optional(),
});

export async function addAddress(uid: string, input: unknown) {
  const d = AddressInput.parse(input);
  const area = await resolveArea(d.subCityId, d.neighborhoodId ?? null);
  const col = adminDb().collection(C.users).doc(uid).collection(C.addresses);
  const count = (await col.count().get()).data().count;
  if (count >= 10) throw badRequest("You can save up to 10 addresses");
  const ref = await col.add({
    ...d,
    cityId: area.cityId,
    neighborhoodId: area.neighborhood?.id ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function listAddresses(uid: string) {
  const s = await adminDb().collection(C.users).doc(uid).collection(C.addresses).orderBy("createdAt", "asc").get();
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as z.infer<typeof AddressInput> & { cityId: string }) }));
}

export async function deleteAddress(uid: string, id: string) {
  await adminDb().collection(C.users).doc(uid).collection(C.addresses).doc(id).delete();
}

export async function requestAccountDeletion(uid: string, reason: string) {
  const db = adminDb();
  await db.collection(C.users).doc(uid).update({ accountStatus: "deletion_requested", deletionRequestedAt: FieldValue.serverTimestamp() });
  await db.collection(C.supportTickets).add({
    uid,
    type: "account_deletion",
    subject: "Account deletion request",
    message: reason.slice(0, 1000),
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });
  // Hide from marketplace immediately.
  await db.collection(C.publicProfiles).doc(uid).delete().catch(() => undefined);
  await audit({ actorId: uid, actorRole: "user", action: "account.deletion_requested", targetType: "user", targetId: uid });
}

/** Admin: suspend/restore. Suspension revokes sessions and removes the public profile. */
export async function setAccountSuspended(admin: { uid: string; role: string }, uid: string, suspended: boolean, reason: string) {
  const db = adminDb();
  await db.collection(C.users).doc(uid).update({
    accountStatus: suspended ? "suspended" : "active",
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (suspended) await adminAuth().revokeRefreshTokens(uid).catch(() => undefined);
  const { refreshPublicProfile } = await import("./providers");
  await refreshPublicProfile(uid).catch(() => undefined);
  await audit({
    actorId: admin.uid,
    actorRole: admin.role,
    action: suspended ? "user.suspend" : "user.restore",
    targetType: "user",
    targetId: uid,
    metadata: { reasonLength: reason.length },
  });
}

/** Admin: process an approved deletion. Keeps legally required financial/audit records, anonymises the rest. */
export async function processAccountDeletion(admin: { uid: string; role: string }, uid: string) {
  const db = adminDb();
  const u = await db.collection(C.users).doc(uid).get();
  if (!u.exists || u.get("accountStatus") !== "deletion_requested") throw badRequest("No pending deletion request");
  const batch = db.batch();
  batch.set(db.collection(C.users).doc(uid), {
    uid,
    displayName: "Deleted user",
    email: null,
    phoneE164: null,
    roles: [],
    accountStatus: "suspended",
    identityStatus: "unverified",
    identitySource: null,
    deletedAt: FieldValue.serverTimestamp(),
  });
  batch.delete(db.collection(C.publicProfiles).doc(uid));
  batch.delete(db.collection(C.privateIdentityRecords).doc(uid));
  batch.delete(db.collection(C.customerProfiles).doc(uid));
  batch.delete(db.collection(C.providerProfiles).doc(uid));
  await batch.commit();
  await adminAuth().deleteUser(uid).catch(() => undefined);
  await audit({ actorId: admin.uid, actorRole: admin.role, action: "user.deleted", targetType: "user", targetId: uid });
}

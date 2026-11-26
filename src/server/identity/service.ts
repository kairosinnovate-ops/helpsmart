import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { C } from "../collections";
import { audit } from "../audit";
import { decryptJson, encryptJson, hmacSubject, sha256b64url } from "../crypto";
import { ApiError, badRequest, forbidden, unavailable } from "../errors";
import { rateLimit } from "../rate-limit";
import { identityProvider } from "./providers";
import { newAuthRequestSecrets, OidcError } from "./oidc-rp";
import type { IdentityStatus } from "@/domain/types";
import { notify } from "../services/notifications";

export const CONSENT_TEXT_VERSION = "identity-consent-draft-2026-11";
const SESSION_TTL_MS = 10 * 60 * 1000;

export type VerificationOutcome =
  | "verified"
  | "cancelled"
  | "failed"
  | "additional_review"
  | "expired_session"
  | "replay"
  | "unavailable";

/** Step 1: user consents, we create a one-time verification session and return the provider URL. */
export async function startVerification(uid: string, consent: { accepted: boolean; userAgent?: string }) {
  if (!consent.accepted) throw badRequest("Consent is required to verify your identity", "consent_required");
  const avail = identityProvider();
  if (!avail.ok) {
    // Fail closed: no provider → no verification, restricted features stay locked.
    throw unavailable(
      "Identity verification is not available yet. HelpSmart is completing its Fayda partner onboarding.",
      "identity_provider_unavailable",
    );
  }
  await rateLimit(`idv_start_${uid}`, 5, 3600);

  const db = adminDb();
  const userRef = db.collection(C.users).doc(uid);
  const user = await userRef.get();
  const status = user.get("identityStatus") as IdentityStatus;
  if (status === "fayda_verified") throw badRequest("Your identity is already verified", "already_verified");
  if (status === "suspended") throw forbidden("Verification is suspended for this account", "identity_suspended");

  const secrets = newAuthRequestSecrets();
  const consentRef = db.collection(C.verificationConsentRecords).doc();
  const sessionRef = db.collection(C.identityVerificationSessions).doc(sha256b64url(secrets.state));
  const url = await avail.provider.authorizationUrl(secrets).catch(() => {
    throw unavailable("Identity provider is unreachable. Please try again shortly.", "identity_provider_unreachable");
  });

  const batch = db.batch();
  batch.set(consentRef, {
    uid,
    purpose: "identity_verification",
    provider: avail.provider.source,
    consentTextVersion: CONSENT_TEXT_VERSION,
    givenAt: FieldValue.serverTimestamp(),
    userAgentHash: consent.userAgent ? sha256b64url(consent.userAgent) : null,
    withdrawnAt: null,
  });
  batch.set(sessionRef, {
    uid,
    provider: avail.provider.source,
    // Secrets encrypted at rest; the state itself is only stored as a hash (doc id).
    secrets: encryptJson({ nonce: secrets.nonce, codeVerifier: secrets.codeVerifier }),
    consentRecordId: consentRef.id,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + SESSION_TTL_MS),
    used: false,
  });
  batch.update(userRef, { identityStatus: "in_progress", updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  await audit({
    actorId: uid,
    actorRole: "user",
    action: "identity.verification_started",
    targetType: "user",
    targetId: uid,
    metadata: { provider: avail.provider.source },
  });
  return { redirectUrl: url };
}

async function recordAttempt(
  uid: string,
  provider: string,
  outcome: VerificationOutcome,
  extra: Record<string, unknown> = {},
) {
  await adminDb()
    .collection(C.identityVerificationRecords)
    .add({ uid, provider, outcome, at: FieldValue.serverTimestamp(), ...extra });
}

async function setStatus(uid: string, status: IdentityStatus) {
  await adminDb().collection(C.users).doc(uid).update({ identityStatus: status, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Step 2: provider redirected back. Validates the one-time session (state), binds it to the signed-in user,
 * exchanges the code server-side, validates tokens, and links the identity with duplicate detection.
 */
export async function completeVerification(params: {
  currentUid: string | null;
  state: string | null;
  code: string | null;
  error: string | null;
}): Promise<VerificationOutcome> {
  if (!params.state) return "failed";
  const db = adminDb();
  const sessionRef = db.collection(C.identityVerificationSessions).doc(sha256b64url(params.state));

  // Atomically consume the session → a replayed callback finds it already used.
  const consumed = await db.runTransaction(async (tx) => {
    const s = await tx.get(sessionRef);
    if (!s.exists) return { kind: "missing" as const };
    const d = s.data()!;
    if (d.used) return { kind: "replay" as const, uid: d.uid as string, provider: d.provider as string };
    tx.update(sessionRef, { used: true, usedAt: FieldValue.serverTimestamp() });
    return {
      kind: "ok" as const,
      uid: d.uid as string,
      provider: d.provider as string,
      secrets: d.secrets as string,
      expiresAt: (d.expiresAt as Timestamp).toMillis(),
      consentRecordId: d.consentRecordId as string,
    };
  });

  if (consumed.kind === "missing") return "failed";
  if (consumed.kind === "replay") {
    await recordAttempt(consumed.uid, consumed.provider, "replay");
    await audit({ actorId: params.currentUid, actorRole: "user", action: "identity.replay_blocked", targetType: "user", targetId: consumed.uid });
    return "replay";
  }
  const { uid, provider } = consumed;
  // Session fixation / account-linking protection: the callback must arrive in the same signed-in account.
  if (params.currentUid !== uid) {
    await recordAttempt(uid, provider, "failed", { reason: "account_mismatch" });
    await setStatus(uid, "failed");
    return "failed";
  }
  if (Date.now() > consumed.expiresAt) {
    await recordAttempt(uid, provider, "expired_session");
    await setStatus(uid, "unverified");
    return "expired_session";
  }
  if (params.error) {
    const outcome: VerificationOutcome = params.error === "access_denied" ? "cancelled" : "failed";
    await recordAttempt(uid, provider, outcome, { providerError: params.error.slice(0, 64) });
    await setStatus(uid, outcome === "cancelled" ? "unverified" : "failed");
    return outcome;
  }
  if (!params.code) {
    await recordAttempt(uid, provider, "failed", { reason: "missing_code" });
    await setStatus(uid, "failed");
    return "failed";
  }

  const avail = identityProvider();
  if (!avail.ok || avail.provider.source !== provider) {
    await recordAttempt(uid, provider, "unavailable");
    await setStatus(uid, "unverified");
    return "unavailable";
  }

  let identity;
  try {
    const secrets = decryptJson<{ nonce: string; codeVerifier: string }>(consumed.secrets);
    identity = await avail.provider.exchange(params.code, { state: params.state, ...secrets });
  } catch (e) {
    const code = e instanceof OidcError ? e.code : "exchange_error";
    const outcome: VerificationOutcome =
      code === "discovery_failed" || code === "token_exchange_failed" ? "unavailable" : "failed";
    await recordAttempt(uid, provider, outcome, { reason: code });
    await setStatus(uid, outcome === "unavailable" ? "unverified" : "failed");
    await audit({ actorId: uid, actorRole: "user", action: "identity.verification_failed", targetType: "user", targetId: uid, metadata: { reason: code } });
    return outcome;
  }

  const subjectHash = hmacSubject(identity.issuer, identity.subject);
  const subjectRef = db.collection(C.identitySubjects).doc(subjectHash);
  const userRef = db.collection(C.users).doc(uid);
  const recordRef = db.collection(C.identityVerificationRecords).doc();
  const privateRef = db.collection(C.privateIdentityRecords).doc(uid);

  const outcome = await db.runTransaction(async (tx) => {
    const existing = await tx.get(subjectRef);
    const duplicate = existing.exists && existing.get("uid") !== uid;
    const base = {
      uid,
      provider: identity.source,
      source: identity.source,
      subjectHash,
      acr: identity.acr ?? null,
      claimNamesReceived: identity.claimNamesReceived,
      consentRecordId: consumed.consentRecordId,
      validated: true, // signature/issuer/audience/nonce checks passed
      at: FieldValue.serverTimestamp(),
    };
    if (duplicate) {
      // Same national identity already linked to another account → human review, no badge.
      tx.set(recordRef, { ...base, outcome: "additional_review", reason: "duplicate_identity" });
      tx.update(userRef, { identityStatus: "additional_review", updatedAt: FieldValue.serverTimestamp() });
      return "additional_review" as const;
    }
    tx.set(subjectRef, { uid, linkedAt: FieldValue.serverTimestamp(), source: identity.source });
    tx.set(recordRef, { ...base, outcome: "verified" });
    tx.set(privateRef, {
      uid,
      source: identity.source,
      claims: encryptJson(identity.retainedClaims),
      retainedClaimNames: Object.keys(identity.retainedClaims),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      identityStatus: "fayda_verified",
      identitySource: identity.source,
      identityVerifiedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "verified" as const;
  });

  await audit({
    actorId: uid,
    actorRole: "user",
    action: outcome === "verified" ? "identity.verified" : "identity.duplicate_flagged",
    targetType: "user",
    targetId: uid,
    metadata: { source: identity.source },
  });
  await notify(uid, {
    type: "identity_update",
    title: outcome === "verified" ? "Identity verified" : "Verification needs review",
    body:
      outcome === "verified"
        ? "Your identity has been verified. You can now book and message professionals."
        : "We need to review your verification. Our team will contact you.",
    link: "/account/verify",
  });
  if (outcome === "verified") {
    const { refreshPublicProfile } = await import("../services/providers");
    await refreshPublicProfile(uid).catch(() => undefined);
  }
  return outcome;
}

/**
 * Admin exception review. An admin can only *confirm* a verification that already has a validated
 * provider result on record (e.g. a duplicate flag that turned out to be a legitimate account merge),
 * or reject/suspend it. There is no path to create a verified status without a validated record.
 */
export async function resolveIdentityReview(
  adminUid: string,
  adminRole: string,
  targetUid: string,
  decision: "confirm" | "reject" | "suspend" | "revoke",
  note: string,
) {
  const db = adminDb();
  const userRef = db.collection(C.users).doc(targetUid);
  const recs = await db
    .collection(C.identityVerificationRecords)
    .where("uid", "==", targetUid)
    .orderBy("at", "desc")
    .limit(1)
    .get();
  const latest = recs.docs[0]?.data();
  const user = await userRef.get();
  if (!user.exists) throw new ApiError(404, "not_found", "User not found");

  if (decision === "confirm") {
    if (user.get("identityStatus") !== "additional_review") throw badRequest("Account is not awaiting review");
    if (!latest || latest.validated !== true || !latest.subjectHash) {
      throw forbidden("No validated Fayda result on record. Verified status cannot be granted manually.", "no_validated_result");
    }
    await db.runTransaction(async (tx) => {
      tx.set(db.collection(C.identitySubjects).doc(latest.subjectHash), { uid: targetUid, linkedAt: FieldValue.serverTimestamp(), source: latest.source, reassignedBy: adminUid });
      tx.update(userRef, {
        identityStatus: "fayda_verified",
        identitySource: latest.source,
        identityVerifiedAt: FieldValue.serverTimestamp(),
      });
    });
  } else {
    const map = { reject: "failed", suspend: "suspended", revoke: "expired_revoked" } as const;
    await userRef.update({ identityStatus: map[decision], updatedAt: FieldValue.serverTimestamp() });
  }
  await audit({
    actorId: adminUid,
    actorRole: adminRole,
    action: `identity.review_${decision}`,
    targetType: "user",
    targetId: targetUid,
    metadata: { noteLength: note.length },
  });
  const { refreshPublicProfile } = await import("../services/providers");
  await refreshPublicProfile(targetUid).catch(() => undefined);
}

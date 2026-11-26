import "server-only";
import { getSessionUser, type SessionUser } from "./session";
import { forbidden, unauthorized } from "../errors";
import { hasPermission, type Permission } from "@/domain/permissions";
import { env } from "../env";

/**
 * Backend authorisation guards. These — not the UI — enforce the marketplace rules.
 */

export async function requireUser(): Promise<SessionUser & { doc: NonNullable<SessionUser["doc"]> }> {
  const u = await getSessionUser();
  if (!u) throw unauthorized();
  if (!u.doc) throw forbidden("Finish creating your account first", "account_incomplete");
  if (u.doc.accountStatus === "suspended") throw forbidden("This account is suspended", "account_suspended");
  return u as SessionUser & { doc: NonNullable<SessionUser["doc"]> };
}

/**
 * True only for a real, validated identity verification.
 * Dev fixture results count only in development/test, so staging and production reject simulated identity.
 */
export function isIdentityVerified(u: Pick<SessionUser, "doc">): boolean {
  const d = u.doc;
  if (!d || d.identityStatus !== "fayda_verified") return false;
  if (d.identitySource === "fayda_oidc") return true;
  if (d.identitySource === "dev_fixture") {
    const e = env();
    return (e.APP_ENV === "development" || e.APP_ENV === "test") && e.IDENTITY_MODE === "dev_fixture";
  }
  return false;
}

/** Restricted marketplace actions (book, message, transact, review) need verified identity. */
export async function requireVerifiedUser() {
  const u = await requireUser();
  if (!isIdentityVerified(u)) {
    throw forbidden("Verify your identity with Fayda to use this feature", "identity_verification_required");
  }
  return u;
}

export async function requireProvider() {
  const u = await requireUser();
  if (!u.doc.roles.includes("provider")) throw forbidden("Provider account required", "provider_required");
  return u;
}

export async function requireAdmin(perm: Permission) {
  const u = await getSessionUser();
  if (!u) throw unauthorized();
  if (!u.adminRole) throw forbidden("Administrator access required", "admin_required");
  if (!hasPermission(u.adminRole, perm)) throw forbidden(`Missing permission: ${perm}`, "permission_denied");
  return u;
}

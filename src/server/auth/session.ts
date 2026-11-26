import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "../firebase/admin";
import { C } from "../collections";
import type { AdminRole, IdentitySource, IdentityStatus, Locale, UserRole } from "@/domain/types";

export const SESSION_COOKIE = "__session"; // Firebase Hosting / App Hosting only forwards this cookie name
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface UserDoc {
  uid: string;
  displayName: string;
  email: string | null;
  phoneE164: string | null;
  locale: Locale;
  roles: UserRole[];
  accountStatus: "active" | "suspended" | "deletion_requested";
  identityStatus: IdentityStatus;
  identitySource: IdentitySource | null;
  identityVerifiedAt: FirebaseFirestore.Timestamp | null;
  onboarding?: { cityId?: string; subCityId?: string; neighborhoodId?: string; completed?: boolean };
  isDemo?: boolean;
}

export interface SessionUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  adminRole: AdminRole | null;
  token: DecodedIdToken;
  doc: UserDoc | null;
}

async function verifyToken(): Promise<DecodedIdToken | null> {
  const h = await headers();
  const authz = h.get("authorization");
  try {
    if (authz?.startsWith("Bearer ")) {
      // Mobile / API clients: Firebase ID token, revocation checked.
      return await adminAuth().verifyIdToken(authz.slice(7), true);
    }
    const c = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!c) return null;
    return await adminAuth().verifySessionCookie(c, true);
  } catch {
    return null;
  }
}

/** Resolves the signed-in user for this request (memoised per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = await verifyToken();
  if (!token) return null;
  const snap = await adminDb().collection(C.users).doc(token.uid).get();
  const adminRole = (token.adminRole as AdminRole | undefined) ?? null;
  return {
    uid: token.uid,
    email: token.email ?? null,
    emailVerified: token.email_verified ?? false,
    adminRole,
    token,
    doc: snap.exists ? (snap.data() as UserDoc) : null,
  };
});

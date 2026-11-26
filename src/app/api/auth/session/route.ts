import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth } from "@/server/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/server/auth/session";
import { body, mutation } from "@/server/http";
import { ok, unauthorized } from "@/server/errors";
import { env } from "@/server/env";

/** Exchanges a fresh Firebase ID token for an httpOnly session cookie. */
export const POST = mutation(async (req) => {
  const { idToken } = z.object({ idToken: z.string().min(20) }).parse(await body(req));
  const decoded = await adminAuth().verifyIdToken(idToken, true).catch(() => null);
  if (!decoded) throw unauthorized("Invalid sign-in");
  // Only mint sessions from a recent sign-in (limits stolen-token reuse).
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw unauthorized("Please sign in again");
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: env().APP_ENV !== "development" && env().APP_ENV !== "test",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return ok({ uid: decoded.uid });
});

export const DELETE = mutation(async () => {
  const jar = await cookies();
  const c = jar.get(SESSION_COOKIE)?.value;
  if (c) {
    const d = await adminAuth().verifySessionCookie(c).catch(() => null);
    if (d) await adminAuth().revokeRefreshTokens(d.sub).catch(() => undefined);
  }
  jar.delete(SESSION_COOKIE);
  return ok({ signedOut: true });
});

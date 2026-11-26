import "server-only";
import { adminDb } from "./firebase/admin";
import { C } from "./collections";
import { ApiError } from "./errors";

/**
 * Fixed-window rate limiter backed by Firestore (works across server instances).
 * For very high traffic, move to Memorystore/Redis; the interface stays the same.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000));
  const ref = adminDb().collection(C.rateLimits).doc(`${key.replace(/\//g, "_")}_${windowStart}`);
  const count = await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const c = (snap.exists ? (snap.data()!.count as number) : 0) + 1;
    tx.set(ref, { count: c, expiresAt: new Date((windowStart + 2) * windowSeconds * 1000) }, { merge: true });
    return c;
  });
  if (count > limit) throw new ApiError(429, "rate_limited", "Too many requests. Please wait a moment.");
}

/**
 * HelpSmart background jobs. Request-path logic lives in the Next.js server (src/server); these functions
 * only react to events and run housekeeping. They never change identity, approval or payment state.
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();
const db = getFirestore();
const REGION = "europe-west1"; // Closest Firebase region to Ethiopia today; review before launch.

/**
 * Push a notification to the user's registered devices (users/{uid}.fcmTokens), if any.
 * The in-app notification document is the source of truth; push is best effort.
 * Push copy is deliberately generic so lock screens do not reveal addresses or message text.
 */
export const pushNotification = onDocumentCreated({ document: "notifications/{id}", region: REGION }, async (event) => {
  const n = event.data?.data();
  if (!n?.uid) return;
  const user = await db.collection("users").doc(n.uid).get();
  const tokens: string[] = user.get("fcmTokens") ?? [];
  if (!tokens.length || user.get("notificationPrefs.push") === false) return;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: "HelpSmart", body: n.title ?? "You have a new update" },
    data: { link: typeof n.link === "string" ? n.link : "/notifications" },
  });
  const stale = res.responses
    .map((r, i) => (!r.success && r.error?.code === "messaging/registration-token-not-registered" ? tokens[i] : null))
    .filter((t): t is string => !!t);
  if (stale.length) {
    await user.ref.update({ fcmTokens: tokens.filter((t) => !stale.includes(t)) });
  }
});

/**
 * Housekeeping, hourly. Firestore TTL policies on expiresAt also delete these documents; this job is a
 * fallback in projects where the TTL policy has not been enabled yet.
 */
export const cleanupExpired = onSchedule({ schedule: "every 60 minutes", region: REGION, timeZone: "Africa/Addis_Ababa" }, async () => {
  const now = Timestamp.now();
  for (const col of ["identityVerificationSessions", "rateLimits"]) {
    const snap = await db.collection(col).where("expiresAt", "<", now).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    logger.info("cleanupExpired", { col, deleted: snap.size });
  }
});

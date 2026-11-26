/**
 * Grants or removes an administrator role. This is the ONLY way to create admins: there is no
 * self-service path and no API that can grant super_admin.
 *
 *   npm run admin:grant -- --email ops@example.com --role verification_officer
 *   npm run admin:grant -- --email ops@example.com --revoke
 *
 * Run by an operator with IAM access to the Firebase project (Application Default Credentials).
 * The user must sign out and in again (or wait up to an hour) for the new claim to take effect.
 */
import { FieldValue } from "firebase-admin/firestore";
import { ADMIN_ROLES, type AdminRole } from "../src/domain/types";
import { adminAuth, adminDb } from "../src/server/firebase/admin";
import { C } from "../src/server/collections";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const role = arg("role") as AdminRole | undefined;
  const revoke = process.argv.includes("--revoke");
  const operator = process.env.USER || process.env.USERNAME || "operator";
  if (!email) throw new Error("--email is required");
  if (!revoke && (!role || !ADMIN_ROLES.includes(role))) throw new Error(`--role must be one of: ${ADMIN_ROLES.join(", ")}`);

  const user = await adminAuth().getUserByEmail(email.toLowerCase());
  if (!revoke && !user.emailVerified && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("The user's email address must be verified before an admin role is granted.");
  }
  const claims = { ...(user.customClaims ?? {}) };
  if (revoke) delete claims.adminRole;
  else claims.adminRole = role;
  await adminAuth().setCustomUserClaims(user.uid, claims);
  await adminAuth().revokeRefreshTokens(user.uid); // force existing sessions to pick up the change

  const db = adminDb();
  await db.collection(C.adminUsers).doc(user.uid).set(
    { uid: user.uid, email: user.email, role: revoke ? null : role, active: !revoke, updatedAt: FieldValue.serverTimestamp(), updatedBy: `script:${operator}` },
    { merge: true },
  );
  await db.collection(C.auditLogs).add({
    actorId: `script:${operator}`,
    actorRole: "operator",
    action: revoke ? "admin.role_revoked" : "admin.role_granted",
    targetType: "user",
    targetId: user.uid,
    metadata: { role: role ?? null },
    at: FieldValue.serverTimestamp(),
  });
  console.log(revoke ? `Revoked admin role from ${email}` : `Granted ${role} to ${email}`);
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

import "server-only";
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin initialisation.
 * - Emulators: set FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST and GCLOUD_PROJECT.
 * - Firebase App Hosting / Cloud Run: Application Default Credentials, no key file.
 * - Elsewhere: FIREBASE_SERVICE_ACCOUNT_JSON from a secret manager (never committed).
 */
let app: App | null = null;
let db: Firestore | null = null;

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  const projectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    app = initializeApp({ projectId: projectId || "demo-helpsmart" });
  } else if (sa) {
    app = initializeApp({ credential: cert(JSON.parse(sa)), projectId });
  } else {
    app = initializeApp({ credential: applicationDefault(), projectId });
  }
  return app;
}

export function adminDb(): Firestore {
  if (db) return db;
  // Next.js can load this module more than once (one copy per route bundle) while the Firebase app is shared,
  // so the shared Firestore instance may already be configured.
  // settings() throws once the instance is in use; by then another copy has already applied the same settings.
  db = getFirestore(adminApp());
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    /* already configured */
  }
  return db;
}

export function adminAuth() {
  return getAuth(adminApp());
}

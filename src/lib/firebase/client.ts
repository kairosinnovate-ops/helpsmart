"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

/** Public Firebase web config — these values are not secrets. Secrets never reach the browser. */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

let app: FirebaseApp, auth: Auth, db: Firestore, storage: FirebaseStorage;
let wired = false;

export function firebase() {
  if (!wired) {
    app = getApps().length ? getApp() : initializeApp({ ...config, apiKey: config.apiKey || "demo-key", projectId: config.projectId || "demo-helpsmart" });
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    if (useEmulators) {
      const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
      connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, host, 8080);
      connectStorageEmulator(storage, host, 9199);
    }
    wired = true;
  }
  return { app, auth, db, storage };
}

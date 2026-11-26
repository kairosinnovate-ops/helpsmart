"use client";
import { signOut as fbSignOut, type User } from "firebase/auth";
import { firebase } from "./firebase/client";
import { api } from "./api";

/** After any Firebase sign-in, exchange the fresh ID token for a server session cookie. */
export async function establishSession(user: User) {
  const idToken = await user.getIdToken(true);
  await api("/api/auth/session", { body: { idToken } });
}

export async function signOut() {
  await api("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
  await fbSignOut(firebase().auth).catch(() => undefined);
}

export function firebaseErrorKey(code: string | undefined): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "auth.errors.emailInUse";
    case "auth/weak-password":
      return "auth.errors.weakPassword";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "auth.errors.invalidCredentials";
    case "auth/too-many-requests":
      return "auth.errors.tooMany";
    default:
      return "auth.errors.generic";
  }
}

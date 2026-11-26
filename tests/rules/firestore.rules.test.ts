import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-helpsmart-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/alice"), { uid: "alice", identityStatus: "unverified", roles: ["customer"] });
    await setDoc(doc(db, "users/bob"), { uid: "bob", identityStatus: "fayda_verified", roles: ["customer", "provider"] });
    await setDoc(doc(db, "privateIdentityRecords/alice"), { uid: "alice", claims: "enc" });
    await setDoc(doc(db, "identityVerificationRecords/r1"), { uid: "alice", outcome: "verified" });
    await setDoc(doc(db, "publicProfiles/bob"), { displayName: "Bob", badges: ["helpsmart_approved"] });
    await setDoc(doc(db, "providerProfiles/bob"), { uid: "bob" });
    await setDoc(doc(db, "providerApplications/bob"), { uid: "bob", status: "approved" });
    await setDoc(doc(db, "serviceCategories/plumbing"), { active: true });
    await setDoc(doc(db, "serviceCategories/childcare"), { active: false });
    await setDoc(doc(db, "reviews/b1"), { status: "published", providerId: "bob" });
    await setDoc(doc(db, "reviews/b2"), { status: "hidden", providerId: "bob" });
    await setDoc(doc(db, "notifications/n1"), { uid: "alice", read: false });
    await setDoc(doc(db, "conversations/alice__bob"), { participantIds: ["alice", "bob"] });
    await setDoc(doc(db, "conversations/alice__bob/messages/m1"), { senderId: "bob", text: "hi" });
    await setDoc(doc(db, "bookings/k1"), { customerId: "alice", providerId: "bob", status: "confirmed" });
    await setDoc(doc(db, "payments/k1"), { status: "pending" });
    await setDoc(doc(db, "auditLogs/a1"), { action: "x" });
    await setDoc(doc(db, "platformSettings/marketplace"), { commissionRate: 0.12 });
  });
});

const as = (uid: string | null, claims: Record<string, unknown> = {}) =>
  (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).firestore();

describe("Firestore rules", () => {
  it("lets a user read only their own user document", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "users/alice")));
    await assertFails(getDoc(doc(as("alice"), "users/bob")));
    await assertFails(getDoc(doc(as(null), "users/alice")));
  });

  it("blocks users from changing their own verification status, roles or anything else", async () => {
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { identityStatus: "fayda_verified" }));
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), { roles: ["customer", "provider"] }));
    await assertFails(setDoc(doc(as("alice"), "users/alice"), { uid: "alice" }));
    await assertFails(deleteDoc(doc(as("alice"), "users/alice")));
  });

  it("does not let even admins write from the client", async () => {
    const admin = as("root", { adminRole: "super_admin" });
    await assertFails(updateDoc(doc(admin, "users/alice"), { identityStatus: "fayda_verified" }));
    await assertFails(updateDoc(doc(admin, "publicProfiles/bob"), { badges: ["fayda_verified"] }));
    await assertFails(updateDoc(doc(admin, "providerApplications/bob"), { status: "approved" }));
  });

  it("never exposes identity records", async () => {
    await assertFails(getDoc(doc(as("alice"), "privateIdentityRecords/alice")));
    await assertFails(getDoc(doc(as("alice"), "identityVerificationRecords/r1")));
    await assertFails(getDoc(doc(as("root", { adminRole: "super_admin" }), "privateIdentityRecords/alice")));
  });

  it("protects ratings, badges, approvals, payments and commissions", async () => {
    await assertFails(updateDoc(doc(as("bob"), "publicProfiles/bob"), { badges: ["fayda_verified", "top_rated"] }));
    await assertFails(updateDoc(doc(as("bob"), "providerProfiles/bob"), { "stats.ratingAverage": 5 }));
    await assertFails(updateDoc(doc(as("bob"), "providerApplications/bob"), { status: "approved" }));
    await assertFails(updateDoc(doc(as("alice"), "payments/k1"), { status: "paid" }));
    await assertFails(getDoc(doc(as("alice"), "payments/k1")));
    await assertFails(updateDoc(doc(as("bob"), "platformSettings/marketplace"), { commissionRate: 0 }));
    await assertFails(setDoc(doc(as("alice"), "reviews/fake"), { status: "published", providerId: "bob", overall: 5 }));
  });

  it("keeps bookings server-only", async () => {
    await assertFails(getDoc(doc(as("alice"), "bookings/k1")));
    await assertFails(updateDoc(doc(as("bob"), "bookings/k1"), { status: "completed" }));
  });

  it("serves public data publicly", async () => {
    await assertSucceeds(getDoc(doc(as(null), "publicProfiles/bob")));
    await assertSucceeds(getDoc(doc(as(null), "serviceCategories/plumbing")));
    await assertFails(getDoc(doc(as(null), "serviceCategories/childcare")));
    await assertSucceeds(getDoc(doc(as(null), "reviews/b1")));
    await assertFails(getDoc(doc(as(null), "reviews/b2")));
  });

  it("restricts notifications to their owner", async () => {
    await assertSucceeds(getDocs(query(collection(as("alice"), "notifications"), where("uid", "==", "alice"))));
    await assertFails(getDocs(query(collection(as("bob"), "notifications"), where("uid", "==", "alice"))));
    await assertFails(getDocs(collection(as("alice"), "notifications")));
    await assertFails(updateDoc(doc(as("alice"), "notifications/n1"), { read: true }));
  });

  it("restricts conversations and messages to participants", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "conversations/alice__bob")));
    await assertSucceeds(getDocs(collection(as("bob"), "conversations/alice__bob/messages")));
    await assertFails(getDocs(collection(as("mallory"), "conversations/alice__bob/messages")));
    await assertFails(setDoc(doc(as("alice"), "conversations/alice__bob/messages/m2"), { senderId: "alice", text: "x" }));
  });

  it("denies audit logs and anything unlisted", async () => {
    await assertFails(getDoc(doc(as("root", { adminRole: "super_admin" }), "auditLogs/a1")));
    await assertFails(setDoc(doc(as("alice"), "somethingNew/x"), { a: 1 }));
  });
});

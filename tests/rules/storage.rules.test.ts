import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes } from "firebase/storage";

let env: RulesTestEnvironment;
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-helpsmart-rules",
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), "credentials/alice/cert.pdf"), pdf, { contentType: "application/pdf" });
  });
});
afterAll(() => env.cleanup());

const st = (uid: string | null, claims: Record<string, unknown> = {}) =>
  (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).storage();

describe("Storage rules", () => {
  it("lets a provider upload credentials only to their own folder", async () => {
    await assertSucceeds(uploadBytes(ref(st("alice"), "credentials/alice/new.pdf"), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(st("alice"), "credentials/bob/new.pdf"), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(st(null), "credentials/alice/x.pdf"), pdf, { contentType: "application/pdf" }));
  });

  it("rejects disallowed file types and oversize files", async () => {
    await assertFails(uploadBytes(ref(st("alice"), "credentials/alice/x.html"), pdf, { contentType: "text/html" }));
    await assertFails(uploadBytes(ref(st("alice"), "credentials/alice/big.pdf"), new Uint8Array(11 * 1024 * 1024), { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(st("alice"), "providers/alice/p.pdf"), pdf, { contentType: "application/pdf" }));
  });

  it("does not allow overwriting a submitted credential", async () => {
    await assertFails(uploadBytes(ref(st("alice"), "credentials/alice/cert.pdf"), pdf, { contentType: "application/pdf" }));
  });

  it("limits credential reads to the owner and verification staff", async () => {
    await assertSucceeds(getBytes(ref(st("alice"), "credentials/alice/cert.pdf")));
    await assertSucceeds(getBytes(ref(st("officer", { adminRole: "verification_officer" }), "credentials/alice/cert.pdf")));
    await assertFails(getBytes(ref(st("bob"), "credentials/alice/cert.pdf")));
    await assertFails(getBytes(ref(st("agent", { adminRole: "support_agent" }), "credentials/alice/cert.pdf")));
    await assertFails(getBytes(ref(st(null), "credentials/alice/cert.pdf")));
  });
});

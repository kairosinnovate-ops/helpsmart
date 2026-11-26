import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash } from "node:crypto";
import { env } from "./env";

/**
 * Application-layer encryption for sensitive identity attributes (AES-256-GCM) and keyed hashing
 * of national-ID-derived subject identifiers (HMAC-SHA256), so raw identifiers are never stored.
 * In development without keys, a fixed, clearly-labelled dev key is derived. Production refuses (see env.ts).
 */

function key(name: "IDENTITY_ENCRYPTION_KEY" | "IDENTITY_HMAC_KEY"): Buffer {
  const v = env()[name];
  if (v) {
    const b = Buffer.from(v, "base64");
    if (b.length !== 32) throw new Error(`${name} must be 32 bytes base64`);
    return b;
  }
  if (env().APP_ENV === "production" || env().APP_ENV === "staging") {
    throw new Error(`${name} is required in ${env().APP_ENV}`);
  }
  return createHash("sha256").update(`helpsmart-dev-only-${name}`).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("IDENTITY_ENCRYPTION_KEY"), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptJson<T>(payload: string): T {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Bad ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key("IDENTITY_ENCRYPTION_KEY"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const out = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

export function hmacSubject(issuer: string, subject: string): string {
  return createHmac("sha256", key("IDENTITY_HMAC_KEY")).update(`${issuer}|${subject}`).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256b64url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

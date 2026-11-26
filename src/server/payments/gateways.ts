import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * Payment gateway adapters. HelpSmart never holds customer funds itself (no escrow, no wallet):
 * regulated money movement is done by licensed partners. Each adapter must:
 *  - create a payment session/checkout with the partner (server-side, secret key from Secret Manager)
 *  - verify webhook authenticity using the partner's documented signature scheme
 *  - map partner events to HelpSmart PaymentStatus
 *
 * None of the partner APIs are implemented with guessed endpoints. Until a partner contract and its
 * official API documentation are in place, each adapter reports `configured: false`, and the webhook
 * endpoint rejects all events (fail closed).
 */

export type GatewayId = "chapa" | "telebirr" | "cbe_birr";

export interface GatewayEvent {
  eventId: string;
  bookingId: string;
  status: "paid" | "failed" | "refunded" | "pending";
  amountMinor: number;
  currency: string;
  gatewayRef: string;
}

export interface PaymentGateway {
  id: GatewayId;
  configured: boolean;
  /** Returns the parsed event if the signature is valid, otherwise null. */
  verifyWebhook(rawBody: string, headers: Headers): GatewayEvent | null;
}

/** Constant-time HMAC-SHA256 check, shared by adapters whose partner uses HMAC signatures. */
export function verifyHmacSha256(rawBody: string, secret: string, signatureHex: string | null): boolean {
  if (!signatureHex) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signatureHex, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function notConfigured(id: GatewayId): PaymentGateway {
  return { id, configured: false, verifyWebhook: () => null };
}

export function gateway(id: string): PaymentGateway | null {
  const enabled = new Set(env().PAYMENT_GATEWAYS_ENABLED.split(",").map((s) => s.trim()).filter(Boolean));
  if (id !== "chapa" && id !== "telebirr" && id !== "cbe_birr") return null;
  if (!enabled.has(id)) return notConfigured(id);
  // TODO(partner onboarding): implement event parsing per official partner documentation.
  // The signature header name and payload schema must come from the partner, not be guessed.
  return notConfigured(id);
}

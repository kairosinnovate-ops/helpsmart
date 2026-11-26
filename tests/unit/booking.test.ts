import { describe, expect, it } from "vitest";
import { availableActions, BookingTransitionError, nextStatus } from "@/domain/booking";

const priced = { hasAgreedPrice: true };
const unpriced = { hasAgreedPrice: false };

describe("booking state machine", () => {
  it("routes a priced booking to the provider and an unpriced one to a quote", () => {
    expect(nextStatus("draft", "submit", "customer", priced)).toBe("awaiting_provider_response");
    expect(nextStatus("draft", "submit", "customer", unpriced)).toBe("awaiting_quote");
  });

  it("walks the happy path to completed", () => {
    let s = nextStatus("draft", "submit", "customer", priced);
    s = nextStatus(s, "accept", "provider", priced);
    s = nextStatus(s, "start_travel", "provider", priced);
    s = nextStatus(s, "start", "provider", priced);
    s = nextStatus(s, "complete", "provider", priced);
    expect(s).toBe("completed");
  });

  it("supports the quote loop", () => {
    const s = nextStatus("awaiting_quote", "submit_quote", "provider", unpriced);
    expect(s).toBe("awaiting_customer_confirmation");
    expect(nextStatus(s, "confirm", "customer", priced)).toBe("confirmed");
    expect(nextStatus(s, "reject_quote", "customer", priced)).toBe("cancelled");
  });

  it("rejects actions by the wrong party", () => {
    expect(() => nextStatus("awaiting_provider_response", "accept", "customer", priced)).toThrow(BookingTransitionError);
    expect(() => nextStatus("in_progress", "complete", "customer", priced)).toThrow(/customer cannot complete/);
    expect(() => nextStatus("disputed", "resolve_refund", "customer", priced)).toThrow(BookingTransitionError);
  });

  it("rejects actions from the wrong state", () => {
    expect(() => nextStatus("completed", "cancel", "customer", priced)).toThrow(/Cannot cancel/);
    expect(() => nextStatus("draft", "complete", "provider", priced)).toThrow(BookingTransitionError);
  });

  it("stops a provider cancelling once en route", () => {
    expect(() => nextStatus("provider_en_route", "cancel", "provider", priced)).toThrow(/Contact support/);
    expect(nextStatus("provider_en_route", "cancel", "customer", priced)).toBe("cancelled");
  });

  it("only admins resolve disputes and mark refunds", () => {
    expect(nextStatus("disputed", "resolve_refund", "admin", priced)).toBe("refund_pending");
    expect(nextStatus("refund_pending", "mark_refunded", "admin", priced)).toBe("refunded");
  });

  it("lists available actions per actor", () => {
    expect(availableActions("awaiting_provider_response", "provider", priced).sort()).toEqual(["accept", "cancel", "decline", "submit_quote"]);
    expect(availableActions("awaiting_provider_response", "customer", priced)).toEqual(["cancel"]);
    expect(availableActions("completed", "customer", priced)).toEqual(["dispute"]);
  });
});

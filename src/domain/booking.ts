import type { BookingStatus } from "./types";

/**
 * Booking state machine. Every status change in the system goes through `nextStatus`,
 * which is evaluated on the server. Clients only ever ask for an *action*.
 */

export type BookingActor = "customer" | "provider" | "admin" | "system";

export const BOOKING_ACTIONS = [
  "submit",
  "accept",
  "decline",
  "submit_quote",
  "confirm",
  "reject_quote",
  "start_travel",
  "start",
  "complete",
  "cancel",
  "dispute",
  "resolve_completed",
  "resolve_refund",
  "mark_refunded",
] as const;
export type BookingAction = (typeof BOOKING_ACTIONS)[number];

interface Transition {
  from: BookingStatus[];
  actors: BookingActor[];
  to: BookingStatus | ((ctx: TransitionContext) => BookingStatus);
}

export interface TransitionContext {
  /** True when the booking already has an agreed price (fixed/hourly/daily rate accepted). */
  hasAgreedPrice: boolean;
}

const TRANSITIONS: Record<BookingAction, Transition> = {
  submit: {
    from: ["draft"],
    actors: ["customer"],
    to: (ctx) => (ctx.hasAgreedPrice ? "awaiting_provider_response" : "awaiting_quote"),
  },
  accept: {
    from: ["awaiting_provider_response"],
    actors: ["provider"],
    to: "confirmed",
  },
  decline: {
    from: ["awaiting_provider_response", "awaiting_quote"],
    actors: ["provider"],
    to: "cancelled",
  },
  submit_quote: {
    from: ["awaiting_provider_response", "awaiting_quote"],
    actors: ["provider"],
    to: "awaiting_customer_confirmation",
  },
  confirm: {
    from: ["awaiting_customer_confirmation"],
    actors: ["customer"],
    to: "confirmed",
  },
  reject_quote: {
    from: ["awaiting_customer_confirmation"],
    actors: ["customer"],
    to: "cancelled",
  },
  start_travel: {
    from: ["confirmed"],
    actors: ["provider"],
    to: "provider_en_route",
  },
  start: {
    from: ["confirmed", "provider_en_route"],
    actors: ["provider"],
    to: "in_progress",
  },
  complete: {
    from: ["in_progress"],
    actors: ["provider"],
    to: "completed",
  },
  cancel: {
    from: [
      "draft",
      "awaiting_provider_response",
      "awaiting_quote",
      "awaiting_customer_confirmation",
      "confirmed",
      "provider_en_route",
    ],
    actors: ["customer", "provider", "admin"],
    to: "cancelled",
  },
  dispute: {
    from: ["in_progress", "completed"],
    actors: ["customer", "provider"],
    to: "disputed",
  },
  resolve_completed: {
    from: ["disputed"],
    actors: ["admin"],
    to: "completed",
  },
  resolve_refund: {
    from: ["disputed"],
    actors: ["admin"],
    to: "refund_pending",
  },
  mark_refunded: {
    from: ["refund_pending"],
    actors: ["admin"],
    to: "refunded",
  },
};

export class BookingTransitionError extends Error {
  constructor(
    message: string,
    public readonly code: "invalid_action" | "invalid_state" | "forbidden_actor",
  ) {
    super(message);
  }
}

export function nextStatus(
  current: BookingStatus,
  action: BookingAction,
  actor: BookingActor,
  ctx: TransitionContext,
): BookingStatus {
  const t = TRANSITIONS[action];
  if (!t) throw new BookingTransitionError(`Unknown action ${action}`, "invalid_action");
  if (!t.actors.includes(actor)) {
    throw new BookingTransitionError(`${actor} cannot ${action}`, "forbidden_actor");
  }
  if (!t.from.includes(current)) {
    throw new BookingTransitionError(`Cannot ${action} a booking that is ${current}`, "invalid_state");
  }
  // A provider may not cancel once en route without admin involvement — they must contact support.
  if (action === "cancel" && actor === "provider" && current === "provider_en_route") {
    throw new BookingTransitionError("Contact support to cancel once en route", "invalid_state");
  }
  return typeof t.to === "function" ? t.to(ctx) : t.to;
}

/** Actions available to an actor in the current state — used to render buttons. Server re-checks. */
export function availableActions(
  current: BookingStatus,
  actor: BookingActor,
  ctx: TransitionContext,
): BookingAction[] {
  return (Object.keys(TRANSITIONS) as BookingAction[]).filter((a) => {
    try {
      nextStatus(current, a, actor, ctx);
      return true;
    } catch {
      return false;
    }
  });
}

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "awaiting_provider_response",
  "awaiting_quote",
  "awaiting_customer_confirmation",
  "confirmed",
  "provider_en_route",
  "in_progress",
];

/** Disputes may be opened up to 72 hours after completion. */
export const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000;
/** Reviews may be submitted up to 30 days after completion. */
export const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function bookingReference(seq: string): string {
  // Human-friendly, non-sequential reference, e.g. HS-7K3Q-9FZ2
  const clean = seq.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(8, "X").slice(0, 8);
  return `HS-${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

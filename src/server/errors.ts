import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingTransitionError } from "@/domain/booking";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = "Sign in required") => new ApiError(401, "unauthenticated", msg);
export const forbidden = (msg = "You do not have permission to do this", code = "forbidden") =>
  new ApiError(403, code, msg);
export const notFound = (msg = "Not found") => new ApiError(404, "not_found", msg);
export const badRequest = (msg: string, code = "bad_request") => new ApiError(400, code, msg);
export const conflict = (msg: string, code = "conflict") => new ApiError(409, code, msg);
export const unavailable = (msg: string, code = "unavailable") => new ApiError(503, code, msg);

/** Wrap a route handler: maps known errors to JSON, never leaks internals or sensitive data. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "validation_failed",
              message: "Some fields are invalid",
              fields: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            },
          },
          { status: 400 },
        );
      }
      if (err instanceof BookingTransitionError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.code === "forbidden_actor" ? 403 : 409 },
        );
      }
      // Log only the error name/message, never request bodies (may contain personal data).
      console.error("[api] unhandled", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
      return NextResponse.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
    }
  };
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

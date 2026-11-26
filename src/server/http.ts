import "server-only";
import type { NextRequest } from "next/server";
import { env } from "./env";
import { ApiError, handle } from "./errors";

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer) header must match the app.
 * Bearer-token clients (mobile) are not vulnerable to CSRF and skip the check.
 */
export function assertSameOrigin(req: Request) {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  const allowed = new Set([new URL(env().APP_BASE_URL).origin, new URL(req.url).origin]);
  if (!origin || !allowed.has(origin)) throw new ApiError(403, "bad_origin", "Request origin not allowed");
}

export async function body(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 64 * 1024) throw new ApiError(413, "too_large", "Request too large");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "bad_json", "Invalid JSON");
  }
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a state-changing route: error mapping + origin check. */
export function mutation<P = Record<string, never>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return handle(async (req: NextRequest, ctx: Ctx<P>) => {
    assertSameOrigin(req);
    return fn(req, ctx);
  });
}

export function query<P = Record<string, never>>(fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return handle(fn);
}

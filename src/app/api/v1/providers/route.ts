import { query } from "@/server/http";
import { ok } from "@/server/errors";
import { searchFromQuery } from "@/server/services/providers";

/** Public search. Only approved + identity-verified providers exist in the index. */
export const GET = query(async (req) => {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  return ok(await searchFromQuery(raw));
});

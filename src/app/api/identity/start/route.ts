import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { startVerification } from "@/server/identity/service";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  const { consent } = z.object({ consent: z.boolean() }).parse(await body(req));
  const r = await startVerification(u.uid, { accepted: consent, userAgent: req.headers.get("user-agent") ?? undefined });
  return ok(r);
});

import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { resolveIdentityReview } from "@/server/identity/service";

export const POST = mutation<{ uid: string }>(async (req, ctx) => {
  const a = await requireAdmin("identity.review_exception");
  const d = z.object({ decision: z.enum(["confirm", "reject", "suspend", "revoke"]), note: z.string().max(1000).default("") }).parse(await body(req));
  await resolveIdentityReview(a.uid, a.adminRole!, (await ctx.params).uid, d.decision, d.note);
  return ok({ ok: true });
});

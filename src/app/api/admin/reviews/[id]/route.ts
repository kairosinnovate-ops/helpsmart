import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { moderateReview } from "@/server/services/reviews";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const a = await requireAdmin("reviews.moderate");
  const d = z.object({ action: z.enum(["hide", "restore"]), note: z.string().max(1000).default("") }).parse(await body(req));
  await moderateReview({ uid: a.uid, role: a.adminRole! }, (await ctx.params).id, d.action, d.note);
  return ok({ ok: true });
});

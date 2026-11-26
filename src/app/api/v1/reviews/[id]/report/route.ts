import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { reportReview } from "@/server/services/reviews";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireUser();
  const { reason } = z.object({ reason: z.string() }).parse(await body(req));
  await reportReview(u.uid, (await ctx.params).id, reason);
  return ok({ reported: true }, 201);
});

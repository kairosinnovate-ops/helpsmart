import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { createReview } from "@/server/services/reviews";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireVerifiedUser();
  await createReview(u.uid, (await ctx.params).id, await body(req));
  return ok({ created: true }, 201);
});

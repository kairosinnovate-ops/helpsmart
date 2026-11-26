import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireProvider } from "@/server/auth/guards";
import { respondToReview } from "@/server/services/reviews";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireProvider();
  const { text } = z.object({ text: z.string() }).parse(await body(req));
  await respondToReview(u.uid, (await ctx.params).id, text);
  return ok({ responded: true });
});

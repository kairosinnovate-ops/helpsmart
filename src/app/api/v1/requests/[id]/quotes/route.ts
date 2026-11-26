import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { submitQuotation } from "@/server/services/requests";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireVerifiedUser();
  await submitQuotation(u.uid, (await ctx.params).id, await body(req));
  return ok({ submitted: true }, 201);
});

import { mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { closeServiceRequest } from "@/server/services/requests";

export const POST = mutation<{ id: string }>(async (_req, ctx) => {
  const u = await requireVerifiedUser();
  await closeServiceRequest(u.uid, (await ctx.params).id);
  return ok({ closed: true });
});

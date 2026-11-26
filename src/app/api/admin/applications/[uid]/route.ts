import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { decideApplication } from "@/server/services/providers";

export const POST = mutation<{ uid: string }>(async (req, ctx) => {
  const a = await requireAdmin("providers.approve");
  await decideApplication({ uid: a.uid, role: a.adminRole! }, (await ctx.params).uid, await body(req));
  return ok({ ok: true });
});

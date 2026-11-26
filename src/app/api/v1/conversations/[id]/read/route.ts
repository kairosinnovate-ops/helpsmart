import { mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { markConversationRead } from "@/server/services/messaging";

export const POST = mutation<{ id: string }>(async (_req, ctx) => {
  const u = await requireUser();
  await markConversationRead(u.uid, (await ctx.params).id);
  return ok({ read: true });
});

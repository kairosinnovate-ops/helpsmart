import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { sendMessage } from "@/server/services/messaging";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireVerifiedUser();
  await sendMessage({ uid: u.uid, displayName: u.doc.displayName }, (await ctx.params).id, await body(req));
  return ok({ sent: true }, 201);
});

import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { acceptQuotation } from "@/server/services/requests";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireVerifiedUser();
  const bookingId = await acceptQuotation({ uid: u.uid, displayName: u.doc.displayName }, (await ctx.params).id, await body(req));
  return ok({ bookingId });
});

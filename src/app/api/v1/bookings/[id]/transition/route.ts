import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { transitionBooking } from "@/server/services/bookings";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const u = await requireVerifiedUser();
  const status = await transitionBooking(u.uid, (await ctx.params).id, await body(req));
  return ok({ status });
});

import { mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { confirmOffPlatformPayment } from "@/server/services/bookings";

export const POST = mutation<{ id: string }>(async (_req, ctx) => {
  const u = await requireVerifiedUser();
  return ok({ paymentStatus: await confirmOffPlatformPayment(u.uid, (await ctx.params).id) });
});

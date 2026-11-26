import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { transitionBooking } from "@/server/services/bookings";
import { hasPermission } from "@/domain/permissions";
import { forbidden } from "@/server/errors";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const a = await requireAdmin("bookings.intervene");
  const input = (await body(req)) as { action?: string };
  // Refund steps additionally need finance permission (separation of duties).
  if ((input.action === "resolve_refund" || input.action === "mark_refunded") && !hasPermission(a.adminRole, "finance.refund")) {
    throw forbidden("Refunds need a finance administrator", "permission_denied");
  }
  const status = await transitionBooking(a.uid, (await ctx.params).id, input, { role: a.adminRole! });
  return ok({ status });
});

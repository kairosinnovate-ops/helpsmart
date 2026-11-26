import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { createBooking } from "@/server/services/bookings";

export const POST = mutation(async (req) => {
  const u = await requireVerifiedUser();
  const id = await createBooking({ uid: u.uid, displayName: u.doc.displayName }, await body(req));
  return ok({ id }, 201);
});

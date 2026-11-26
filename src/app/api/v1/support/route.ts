import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { createTicket } from "@/server/services/support";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  return ok({ id: await createTicket(u.uid, await body(req)) }, 201);
});

import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { createServiceRequest } from "@/server/services/requests";

export const POST = mutation(async (req) => {
  const u = await requireVerifiedUser();
  return ok({ id: await createServiceRequest(u, await body(req)) }, 201);
});

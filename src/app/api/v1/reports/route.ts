import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { createReport } from "@/server/services/support";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  await createReport(u.uid, await body(req));
  return ok({ reported: true }, 201);
});

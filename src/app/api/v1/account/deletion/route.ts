import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { requestAccountDeletion } from "@/server/services/accounts";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  const { reason } = z.object({ reason: z.string().max(1000).default("") }).parse(await body(req));
  await requestAccountDeletion(u.uid, reason);
  return ok({ requested: true });
});

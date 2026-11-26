import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { markNotificationsRead } from "@/server/services/notifications";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(await body(req));
  await markNotificationsRead(u.uid, ids);
  return ok({ read: ids.length });
});

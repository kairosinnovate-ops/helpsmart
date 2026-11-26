import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { blockUser } from "@/server/services/messaging";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  const d = z.object({ otherUid: z.string().min(1), block: z.boolean() }).parse(await body(req));
  await blockUser(u.uid, d.otherUid, d.block);
  return ok({ blocked: d.block });
});

import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireProvider } from "@/server/auth/guards";
import { setAvailableNow } from "@/server/services/providers";

export const POST = mutation(async (req) => {
  const u = await requireProvider();
  const { availableNow } = z.object({ availableNow: z.boolean() }).parse(await body(req));
  await setAvailableNow(u.uid, availableNow);
  return ok({ availableNow });
});

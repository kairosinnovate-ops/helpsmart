import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { toggleSavedProvider } from "@/server/services/providers";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  const d = z.object({ providerId: z.string().min(1), save: z.boolean() }).parse(await body(req));
  await toggleSavedProvider(u.uid, d.providerId, d.save);
  return ok({ saved: d.save });
});

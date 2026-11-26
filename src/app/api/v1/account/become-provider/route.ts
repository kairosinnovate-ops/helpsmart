import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { becomeProvider } from "@/server/services/accounts";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  const { providerType } = z.object({ providerType: z.enum(["individual", "business"]) }).parse(await body(req));
  await becomeProvider(u.uid, providerType);
  return ok({ ok: true });
});

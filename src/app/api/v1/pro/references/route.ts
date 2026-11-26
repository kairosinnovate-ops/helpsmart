import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireProvider } from "@/server/auth/guards";
import { addReference } from "@/server/services/providers";

export const POST = mutation(async (req) => {
  const u = await requireProvider();
  await addReference(u.uid, await body(req));
  return ok({ added: true }, 201);
});

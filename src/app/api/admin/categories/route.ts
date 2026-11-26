import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { CategoryInput, upsertCategory } from "@/server/services/reference";

export const PUT = mutation(async (req) => {
  const a = await requireAdmin("categories.manage");
  await upsertCategory({ uid: a.uid, role: a.adminRole! }, CategoryInput.parse(await body(req)));
  return ok({ saved: true });
});

import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { updateSettings } from "@/server/services/reference";

export const PATCH = mutation(async (req) => {
  const a = await requireAdmin("settings.manage");
  await updateSettings({ uid: a.uid, role: a.adminRole! }, await body(req));
  return ok({ saved: true });
});

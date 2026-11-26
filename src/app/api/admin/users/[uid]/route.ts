import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { processAccountDeletion, setAccountSuspended } from "@/server/services/accounts";

export const POST = mutation<{ uid: string }>(async (req, ctx) => {
  const d = z.object({ action: z.enum(["suspend", "restore", "delete"]), reason: z.string().max(1000).default("") }).parse(await body(req));
  const uid = (await ctx.params).uid;
  if (d.action === "delete") {
    const a = await requireAdmin("users.delete");
    await processAccountDeletion({ uid: a.uid, role: a.adminRole! }, uid);
  } else {
    const a = await requireAdmin("users.suspend");
    await setAccountSuspended({ uid: a.uid, role: a.adminRole! }, uid, d.action === "suspend", d.reason);
  }
  return ok({ ok: true });
});

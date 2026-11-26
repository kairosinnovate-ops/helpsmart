import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { verifyCredential } from "@/server/services/providers";

export const POST = mutation<{ id: string }>(async (req, ctx) => {
  const a = await requireAdmin("credentials.verify");
  const { status } = z.object({ status: z.enum(["verified", "rejected"]) }).parse(await body(req));
  await verifyCredential({ uid: a.uid, role: a.adminRole! }, (await ctx.params).id, status);
  return ok({ status });
});

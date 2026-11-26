import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireAdmin } from "@/server/auth/guards";
import { resolveCase } from "@/server/services/support";

const Coll = z.enum(["supportTickets", "incidentReports", "reviewReports"]);

export const POST = mutation<{ collection: string; id: string }>(async (req, ctx) => {
  const p = await ctx.params;
  const collection = Coll.parse(p.collection);
  const a = await requireAdmin(collection === "supportTickets" ? "support.manage" : "reports.manage");
  const d = z.object({ status: z.enum(["in_progress", "resolved", "dismissed"]), note: z.string().max(1000).default("") }).parse(await body(req));
  await resolveCase({ uid: a.uid, role: a.adminRole! }, collection, p.id, d.status, d.note);
  return ok({ ok: true });
});

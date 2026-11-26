import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireProvider } from "@/server/auth/guards";
import { saveProviderSection } from "@/server/services/providers";

const Section = z.enum(["profile", "categories", "area", "pricing", "availability"]);

export const PUT = mutation<{ section: string }>(async (req, ctx) => {
  const u = await requireProvider();
  const section = Section.parse((await ctx.params).section);
  await saveProviderSection(u.uid, section, await body(req));
  return ok({ saved: section });
});

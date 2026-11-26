import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireVerifiedUser } from "@/server/auth/guards";
import { openConversation } from "@/server/services/messaging";

export const POST = mutation(async (req) => {
  const u = await requireVerifiedUser();
  const d = z.object({ otherUid: z.string().min(1), bookingId: z.string().nullable().optional() }).parse(await body(req));
  return ok({ id: await openConversation({ uid: u.uid, displayName: u.doc.displayName }, d.otherUid, d.bookingId) });
});

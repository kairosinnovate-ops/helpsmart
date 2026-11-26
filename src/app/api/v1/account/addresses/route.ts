import { z } from "zod";
import { body, mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { requireUser } from "@/server/auth/guards";
import { addAddress, deleteAddress } from "@/server/services/accounts";

export const POST = mutation(async (req) => {
  const u = await requireUser();
  return ok({ id: await addAddress(u.uid, await body(req)) }, 201);
});

export const DELETE = mutation(async (req) => {
  const u = await requireUser();
  const { id } = z.object({ id: z.string().min(1) }).parse(await body(req));
  await deleteAddress(u.uid, id);
  return ok({ deleted: true });
});

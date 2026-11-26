import { body, mutation } from "@/server/http";
import { ok, unauthorized } from "@/server/errors";
import { getSessionUser } from "@/server/auth/session";
import { requireUser } from "@/server/auth/guards";
import { createAccount, updateProfile } from "@/server/services/accounts";

export const POST = mutation(async (req) => {
  const u = await getSessionUser();
  if (!u) throw unauthorized();
  await createAccount(u.uid, u.email, await body(req));
  return ok({ created: true }, 201);
});

export const PATCH = mutation(async (req) => {
  const u = await requireUser();
  await updateProfile(u.uid, await body(req));
  return ok({ updated: true });
});

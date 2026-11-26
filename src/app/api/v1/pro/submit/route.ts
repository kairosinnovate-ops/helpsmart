import { mutation } from "@/server/http";
import { ok } from "@/server/errors";
import { isIdentityVerified, requireProvider } from "@/server/auth/guards";
import { submitApplication } from "@/server/services/providers";

export const POST = mutation(async () => {
  const u = await requireProvider();
  await submitApplication(u.uid, isIdentityVerified(u));
  return ok({ submitted: true });
});

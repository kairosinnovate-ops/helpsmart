import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { completeVerification } from "@/server/identity/service";
import { env } from "@/server/env";

/** Redirect URI registered with Fayda. Never trusts query parameters beyond the one-time state. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const user = await getSessionUser();
  let outcome = "failed";
  try {
    outcome = await completeVerification({
      currentUid: user?.uid ?? null,
      state: p.get("state"),
      code: p.get("code"),
      error: p.get("error"),
    });
  } catch {
    outcome = "failed";
  }
  return NextResponse.redirect(new URL(`/account/verify?result=${outcome}`, env().APP_BASE_URL));
}

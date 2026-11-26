import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth redirect only. It checks that a session cookie exists, not that it is valid.
 * Every page and API route still verifies the session on the server (src/server/auth).
 */
const PROTECTED = ["/home", "/bookings", "/messages", "/account", "/notifications", "/requests", "/pro", "/admin", "/explore/saved"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.cookies.has("__session")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};

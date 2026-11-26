import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware protects the admin UI area. Presence of the session cookie is
 * checked here; real authorization (RBAC) is enforced server-side in each
 * API route (PRD §15: server-enforced RBAC, no frontend-only checks).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isStatic = pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  // Public login page and auth API are always accessible.
  if (pathname === "/login" || pathname === "/api/auth/login" || isAuthApi || isStatic) {
    return NextResponse.next();
  }

  const session = request.cookies.get("session");

  // Protect admin pages: redirect to login when no session.
  if (isAdminPage && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*", "/login"],
};

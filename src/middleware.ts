import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for landing page, login page and API routes
  if (pathname === "/" || pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  try {
    // Call Better Auth's session endpoint directly, passing along the cookie header
    // This safely completely bypasses the need to guess cookie names (__Secure-, etc.)
    const sessionUrl = new URL("/api/auth/get-session", request.url);
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    const session = await response.json();

    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch (err) {
    // In case the fetch fails, default to rejecting access
    const loginUrl = new URL("/auth/login", request.url);
    console.log(err);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

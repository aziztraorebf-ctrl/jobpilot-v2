import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createMiddlewareClient } from "./lib/supabase/auth-middleware";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes: skip intl middleware entirely
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Auth callback: no locale prefix, no auth check
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  // Public auth pages: login and signup (allow without session)
  const isPublicAuthPage =
    pathname.includes("/login") || pathname.includes("/signup");
  if (isPublicAuthPage) {
    return intlMiddleware(request);
  }

  // Refresh Supabase auth session via middleware client
  const { supabase, response: getResponse } = createMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL(`/${routing.defaultLocale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // User is authenticated: apply intl middleware
  const intlResponse = intlMiddleware(request);

  // Copy Supabase auth cookies (refreshed tokens) into intl response
  const supabaseResponse = getResponse();
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

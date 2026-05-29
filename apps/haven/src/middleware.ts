import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Routes that do NOT require authentication.
 * Everything else is considered protected and will redirect to /login.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",           // OAuth callbacks, magic-link confirm, etc.
  "/invite",         // Invite accept page
  "/about",
  "/blog",
  "/guides",
  "/resources",
  "/tools",          // Public tools landing
  "/search",
  "/cases",          // Public community cases
  "/community",      // Public community pages
  "/_next",          // Next.js internals
  "/favicon",
  "/robots.txt",
  "/sitemap",
  "/indexnow",
];

/** API routes that handle their own auth (skip middleware redirect). */
const PUBLIC_API_PREFIXES = [
  "/api/ingest",          // Mailgun webhook — verified via HMAC signature
  "/api/internal",        // Cron / admin routes — verified via bearer secrets
  "/api/indexnow-key",    // Static key file
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  // Root landing page
  if (pathname === "/") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always create a response to allow Supabase to refresh the session cookie.
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured (local dev without env vars), skip auth checks.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). A bug here could remove users' login state.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    // Redirect unauthenticated users to login, preserving the intended destination.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // IMPORTANT: Return supabaseResponse (not a new NextResponse) so the
  // refreshed session cookie is preserved.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT static assets:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - Images / fonts / icons
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

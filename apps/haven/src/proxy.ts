import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { applySharedCookieOptions } from "@haven/auth/cookie-options";
import { authEnv, hasSupabaseEnv } from "@haven/auth/env";

const protectedPrefixes = ["/dashboard", "/onboarding", "/profile", "/timeline", "/planner", "/advisor", "/inbox", "/settings"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requiresAuth = protectedPrefixes.some((prefix) => path.startsWith(prefix));

  if (!requiresAuth || !hasSupabaseEnv) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createServerClient(authEnv.NEXT_PUBLIC_SUPABASE_URL!, authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, applySharedCookieOptions(options));
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/timeline/:path*",
    "/planner/:path*",
    "/advisor/:path*",
    "/inbox/:path*",
    "/settings/:path*"
  ]
};

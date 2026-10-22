import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { applySharedCookieOptions } from "@haven/auth/cookie-options";
import { authEnv, hasSupabaseEnv } from "@haven/auth/env";
import { SIGNED_IN_HOME, isArchivedPath } from "@/lib/archived-routes";
import { INVITE_ONLY_PATH, OWNER_EMAIL } from "@/lib/access-constants";

const protectedPrefixes = ["/dashboard", "/onboarding", "/profile", "/timeline", "/planner", "/advisor", "/inbox", "/settings", "/documents"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Parked surfaces are switched off completely — no direct-link back door.
  if (isArchivedPath(path)) {
    return NextResponse.rewrite(new URL("/gone", request.url), { status: 404 });
  }

  const isFirmArea = path === "/firm" || path.startsWith("/firm/");
  const requiresAuth = isFirmArea || protectedPrefixes.some((prefix) => path.startsWith(prefix));

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
    if (isFirmArea) {
      loginUrl.searchParams.set("role", "lawyer");
    }
    loginUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(loginUrl);
  }

  // The firm area is for lawyers only. Everyone else goes to their own home.
  if (isFirmArea) {
    const { data: firmId, error } = await supabase.rpc("haven_firm_id" as never);
    if (error || !firmId) {
      return NextResponse.redirect(new URL(SIGNED_IN_HOME, request.url));
    }
    return response;
  }

  // Invitation only: a signed-in account without an invite is turned away.
  // Lawyers aren't clients, so they're sent to their firm dashboard instead.
  const email = (user.email ?? "").trim().toLowerCase();
  if (email !== OWNER_EMAIL) {
    const { data: hasAccess, error } = await supabase.rpc("haven_has_access" as never);
    if (error || hasAccess !== true) {
      const { data: firmId } = await supabase.rpc("haven_firm_id" as never);
      if (firmId) {
        return NextResponse.redirect(new URL("/firm", request.url));
      }
      const inviteUrl = new URL(INVITE_ONLY_PATH, request.url);
      inviteUrl.searchParams.set("message", "not_invited");
      return NextResponse.redirect(inviteUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/cases/:path*",
    "/clients/:path*",
    "/community/:path*",
    "/documents/:path*",
    "/lawyers/:path*",
    "/reports/:path*",
    "/search/:path*",
    "/tasks/:path*",
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/timeline/:path*",
    "/planner/:path*",
    "/advisor/:path*",
    "/inbox/:path*",
    "/settings/:path*",
    "/firm/:path*"
  ]
};

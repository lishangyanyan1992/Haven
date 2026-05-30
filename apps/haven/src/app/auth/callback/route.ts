import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { applySharedCookieOptions } from "@haven/auth/cookie-options";
import { authEnv } from "@haven/auth/env";

/**
 * Supabase auth callback handler.
 *
 * Supabase redirects here after:
 * - Email confirmation (sign-up)
 * - Password reset (forgot-password flow)
 * - OAuth sign-in (if added in future)
 *
 * It exchanges the one-time `code` for a session cookie, then
 * redirects the user to their intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Validate redirect destination — only allow relative paths on this origin.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (!code) {
    // No code — could be a hash-based recovery link (older Supabase flow).
    // Redirect to reset-password and let the client handle the hash token.
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  const response = NextResponse.redirect(`${origin}${safeNext}`);

  if (!authEnv.NEXT_PUBLIC_SUPABASE_URL || !authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    authEnv.NEXT_PUBLIC_SUPABASE_URL,
    authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, applySharedCookieOptions(options));
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] code exchange error:", error.message);
    return NextResponse.redirect(`${origin}/login?message=invalid_credentials`);
  }

  return response;
}

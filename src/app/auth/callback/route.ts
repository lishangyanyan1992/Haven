import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/server/actions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    console.error("[auth/callback] no code param in request");
    return NextResponse.redirect(`${origin}/login?message=oauth_error`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("[auth/callback] code exchange failed:", error?.message);
      return NextResponse.redirect(`${origin}/login?message=oauth_error`);
    }

    const { user } = data;
    const email = user.email ?? "";
    const fullName =
      String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? email.split("@")[0]);

    const destination = await resolvePostAuthRedirect(user.id, email, fullName);

    return NextResponse.redirect(`${origin}${destination}`);
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return NextResponse.redirect(`${origin}/login?message=oauth_error`);
  }
}

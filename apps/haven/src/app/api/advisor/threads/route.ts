import { NextResponse } from "next/server";

import { listThreads } from "@/lib/advisor/threads";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The user's saved conversations, most recently active first.
 *
 * Fetched by the advisor workspace on mount only — not on every page. Supabase
 * egress is already the tightest budget in this project, and "load the sidebar
 * everywhere" is how a small payload becomes a large bill.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threads = await listThreads(user.id);
    return NextResponse.json({ threads });
  } catch (error) {
    console.error("[advisor/threads] list failed:", error);
    return NextResponse.json({ error: "Unable to load your conversations." }, { status: 500 });
  }
}

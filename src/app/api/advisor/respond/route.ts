import { NextResponse } from "next/server";

import { isAdvisorRateLimitError, respondToAdvisorMessage } from "@/lib/advisor/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await respondToAdvisorMessage(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[advisor/respond] error:", error);
    if (isAdvisorRateLimitError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create advisor response." },
      { status: 500 }
    );
  }
}

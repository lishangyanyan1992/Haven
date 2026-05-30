import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLangfuseClient, flushLangfuse } from "@/lib/langfuse";

const feedbackSchema = z.object({
  traceId: z.string().min(1),
  score: z.enum(["up", "down"]),
  comment: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = feedbackSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { traceId, score, comment } = body.data;
  const numericScore = score === "up" ? 1 : 0;

  const lf = getLangfuseClient();
  if (lf) {
    lf.score({
      traceId,
      name: "user-feedback",
      value: numericScore,
      comment: comment ?? (score === "up" ? "👍 Helpful" : "👎 Not helpful"),
      dataType: "BOOLEAN",
    });
    await flushLangfuse();
  }

  return NextResponse.json({ ok: true });
}

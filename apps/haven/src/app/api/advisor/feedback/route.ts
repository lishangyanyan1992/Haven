import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLangfuseClient, flushLangfuse } from "@/lib/langfuse";

const feedbackSchema = z.object({
  traceId: z.string().min(1),
  score: z.enum(["up", "down"]),
  comment: z.string().max(500).optional(),
});

/**
 * Feedback lands in two places on purpose.
 *
 * Langfuse is where a score sits next to the trace that produced it, which is
 * what you want when reading one bad answer. But nothing on our side could see
 * it, so acting on feedback meant remembering to open someone else's dashboard.
 * The row in `advisor_feedback` is what the weekly health check reads, so a
 * downvote with a written reason surfaces on its own.
 *
 * Neither write is allowed to fail the request. The person has already given
 * their opinion; a storage error is ours to notice, not theirs.
 */
async function persistFeedback(input: {
  userId: string;
  traceId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient() as any;

    // The trace id is recorded on the assistant message when the exchange is
    // saved. Scoping the lookup to this user means a guessed trace id cannot
    // attach feedback to somebody else's conversation.
    const { data: message } = await admin
      .from("advisor_messages")
      .select("id")
      .eq("user_id", input.userId)
      .eq("role", "assistant")
      .filter("retrieval_metadata->>traceId", "eq", input.traceId)
      .maybeSingle();

    if (!message) return;

    const { data: existing } = await admin
      .from("advisor_feedback")
      .select("id")
      .eq("user_id", input.userId)
      .eq("message_id", message.id)
      .maybeSingle();

    // A rating and the follow-up detail are one opinion, so the second write
    // updates the first rather than adding a row.
    if (existing) {
      const patch: { rating: number; feedback_text?: string } = { rating: input.rating };
      if (input.comment) patch.feedback_text = input.comment;
      await admin.from("advisor_feedback").update(patch).eq("id", existing.id);
      return;
    }

    await admin.from("advisor_feedback").insert({
      user_id: input.userId,
      message_id: message.id,
      rating: input.rating,
      feedback_text: input.comment ?? null,
    });
  } catch {
    // Swallowed for the same reason the Langfuse write is.
  }
}

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

  await persistFeedback({ userId: user.id, traceId, rating: numericScore, comment });

  const lf = getLangfuseClient();
  if (lf) {
    lf.score({
      // Deterministic id so a rating and the follow-up "what was wrong" detail
      // upsert into one score instead of counting as two pieces of feedback.
      id: `${traceId}-user-feedback`,
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

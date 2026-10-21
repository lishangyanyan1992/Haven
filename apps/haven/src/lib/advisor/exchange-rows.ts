/**
 * The two `advisor_messages` rows for one question and its answer.
 *
 * Kept apart from `threads.ts` so the offline check can import it without a
 * database client.
 *
 * Both rows must carry the same keys. supabase-js sends a multi-row insert with a
 * `columns` list built from the union of every row's keys, and a row missing one
 * of those keys is sent as NULL for it, not as the column default. The user row
 * used to omit `retrieval_metadata`, which is NOT NULL, so every insert was
 * rejected and no message was ever stored. Threads were still created and
 * counted against the daily five, but the conversation list hides threads with
 * no messages, so users saw "0 of 5 left" and nothing to go back to.
 */

import type { AdvisorAnswerPayload } from "@/types/domain";

export interface AdvisorMessageRow {
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  answer_payload: AdvisorAnswerPayload | null;
  retrieval_metadata: Record<string, unknown>;
}

export function buildExchangeRows(input: {
  threadId: string;
  userId: string;
  question: string;
  answer: AdvisorAnswerPayload;
  traceId: string;
}): AdvisorMessageRow[] {
  return [
    {
      thread_id: input.threadId,
      user_id: input.userId,
      role: "user",
      content: input.question,
      answer_payload: null,
      retrieval_metadata: {}
    },
    {
      thread_id: input.threadId,
      user_id: input.userId,
      role: "assistant",
      content: input.answer.answer_markdown ?? "",
      answer_payload: input.answer,
      retrieval_metadata: { traceId: input.traceId }
    }
  ];
}

/**
 * Advisor conversation persistence.
 *
 * `advisor_threads` and `advisor_messages` were created in the very first advisor
 * migration and then never written to. Thread rows were reserved (they counted
 * against the daily allowance) and messages were held only in React state, so
 * closing the tab destroyed the conversation *and* kept the charge for it. A user
 * mid-way through a 60-day grace period re-explained their situation from scratch
 * on every visit.
 *
 * This module is the missing half. It deliberately stays small: write an exchange,
 * list conversations, read one back, delete one. Anything cleverer — remembered
 * facts, returning-user greetings, tapering the prompt for people who have been
 * here before — belongs on top of this, not inside it.
 *
 * Everything here goes through the admin client and filters on `user_id`
 * explicitly, matching `getAdvisorUsage`. The row-level security policies are the
 * second line of defence, not the only one: every query below is scoped by user in
 * its own right, so a policy regression cannot quietly widen it.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdvisorAnswerPayload, AdvisorMessage } from "@/types/domain";

export interface AdvisorThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

/** Longest conversation we will read back into the client. */
const MAX_MESSAGES_PER_THREAD = 200;

/** Conversations shown in the sidebar. */
const MAX_THREADS_LISTED = 30;

/**
 * Save one completed exchange.
 *
 * Called after the answer is finished so the stored assistant message carries the
 * final text — the safety addenda and the stale-bulletin notice are appended after
 * generation, and a history that omitted them would quietly drop the very
 * sentences the guardrails exist to add.
 *
 * Failures are swallowed. Persistence is not worth failing a delivered answer
 * over: the user has already read it, and throwing here would surface as an error
 * on a response that actually succeeded.
 */
export async function persistExchange(input: {
  threadId: string;
  userId: string;
  question: string;
  answer: AdvisorAnswerPayload;
  traceId: string;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient() as any;

    await admin.from("advisor_messages").insert([
      {
        thread_id: input.threadId,
        user_id: input.userId,
        role: "user",
        content: input.question
      },
      {
        thread_id: input.threadId,
        user_id: input.userId,
        role: "assistant",
        content: input.answer.answer_markdown,
        answer_payload: input.answer,
        retrieval_metadata: { traceId: input.traceId }
      }
    ]);

    // Inserting a message does not touch the thread row, and the sidebar is ordered
    // by recency, so an active conversation would sink below stale ones without
    // this. The updated_at trigger fires on update, so touching status is enough.
    await admin
      .from("advisor_threads")
      .update({ status: "active" })
      .eq("id", input.threadId)
      .eq("user_id", input.userId);
  } catch {
    // Intentionally silent — see the doc comment.
  }
}

/** Conversations for the sidebar, most recently active first. */
export async function listThreads(userId: string): Promise<AdvisorThreadSummary[]> {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("advisor_threads")
    .select("id, title, updated_at, advisor_messages(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_THREADS_LISTED);

  if (error) {
    throw new Error(`Unable to load conversations: ${error.message}`);
  }

  return (data ?? [])
    .map((row: any) => ({
      id: row.id as string,
      title: (row.title as string) ?? "New conversation",
      updatedAt: row.updated_at as string,
      messageCount: row.advisor_messages?.[0]?.count ?? 0
    }))
    // A thread row is reserved before generation, so an abandoned or errored first
    // question can leave one with no messages behind it. Listing those would show
    // the user conversations that open empty.
    .filter((thread: AdvisorThreadSummary) => thread.messageCount > 0);
}

/** Read one conversation back, oldest message first. */
export async function getThreadMessages(userId: string, threadId: string): Promise<AdvisorMessage[]> {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("advisor_messages")
    .select("id, thread_id, role, content, answer_payload, retrieval_metadata, created_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES_PER_THREAD);

  if (error) {
    throw new Error(`Unable to load this conversation: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    threadId: row.thread_id as string,
    role: row.role as AdvisorMessage["role"],
    content: row.content as string,
    createdAt: row.created_at as string,
    traceId: row.retrieval_metadata?.traceId ?? undefined,
    answerPayload: (row.answer_payload as AdvisorAnswerPayload | null) ?? undefined
  }));
}

/**
 * Delete a conversation and everything under it.
 *
 * Messages, citations and feedback are removed by the foreign-key cascade. This is
 * a real delete rather than an archive flag: the user is being offered deletion, so
 * the row has to go.
 */
export async function deleteThread(userId: string, threadId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("advisor_threads")
    .delete()
    .eq("id", threadId)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new Error(`Unable to delete this conversation: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

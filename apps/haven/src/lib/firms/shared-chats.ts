import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isThreadVisibleToFirm } from "@/lib/advisor/firm-visibility";

/**
 * The client's AI chats, as their firm sees them
 * (specs/advisor-chat-firm-visibility).
 *
 * A firm sees a chat only when all three hold:
 *   - the client is linked to this firm in firm_clients now;
 *   - the client acknowledged that this firm can see their chats;
 *   - the chat was started at or after that acknowledgement.
 *
 * Every read of the client's chats in this file goes through sharedChatScope(),
 * which checks the first two and returns the cut-off for the third. The
 * database gives firms no access to the chat tables at all, so a read that
 * skipped this would return nothing rather than too much.
 * evals/firms/isolation.check.ts enforces that.
 *
 * Lawyers get the question and answer text the client saw, and nothing
 * internal: no retrieval detail, no traces, no remembered facts.
 */

function db(override?: unknown) {
  return (override ?? createSupabaseAdminClient()) as any;
}

const MAX_CHATS = 30;
const MAX_MESSAGES_PER_CHAT = 200;

export type SharedChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

export type SharedChat = {
  id: string;
  title: string;
  createdAt: string;
  messages: SharedChatMessage[];
};

/** The client's user id and the moment they agreed this firm can see their chats, or null. */
async function sharedChatScope(
  firmId: string,
  firmClientId: string,
  client: any
): Promise<{ userId: string; visibleFrom: string } | null> {
  const { data: link, error: linkError } = await client
    .from("firm_clients")
    .select("user_id, joined_at")
    .eq("firm_id", firmId)
    .eq("id", firmClientId)
    .maybeSingle();
  if (linkError) throw new Error(`Could not load client: ${linkError.message}`);
  if (!link?.user_id || !link.joined_at) return null;

  const { data: ack, error: ackError } = await client
    .from("advisor_firm_visibility_acks")
    .select("acknowledged_at")
    .eq("firm_id", firmId)
    .eq("user_id", link.user_id)
    .maybeSingle();
  if (ackError) throw new Error(`Could not load chat sharing: ${ackError.message}`);
  if (!ack?.acknowledged_at) return null;

  return { userId: String(link.user_id), visibleFrom: String(ack.acknowledged_at) };
}

/** The client's shared chats, newest first, each with its questions and answers in order. */
export async function listSharedChatsForFirm(firmId: string, firmClientId: string, override?: unknown): Promise<SharedChat[]> {
  const client = db(override);
  const scope = await sharedChatScope(firmId, firmClientId, client);
  if (!scope) return [];

  const { data: threads, error } = await client
    .from("advisor_threads")
    .select("id, title, created_at")
    .eq("user_id", scope.userId)
    .gte("created_at", scope.visibleFrom)
    .order("created_at", { ascending: false })
    .limit(MAX_CHATS);
  if (error) throw new Error(`Could not load chats: ${error.message}`);
  const visible = ((threads ?? []) as any[]).filter((t) => isThreadVisibleToFirm(t.created_at, scope.visibleFrom));
  if (visible.length === 0) return [];

  const { data: messages, error: messageError } = await client
    .from("advisor_messages")
    .select("id, thread_id, role, content, answer_payload, created_at")
    .eq("user_id", scope.userId)
    .in(
      "thread_id",
      visible.map((t) => t.id)
    )
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(MAX_CHATS * MAX_MESSAGES_PER_CHAT);
  if (messageError) throw new Error(`Could not load chat messages: ${messageError.message}`);

  const byThread = new Map<string, SharedChatMessage[]>();
  for (const row of (messages ?? []) as any[]) {
    const list = byThread.get(row.thread_id) ?? [];
    if (list.length >= MAX_MESSAGES_PER_CHAT) continue;
    list.push({
      id: String(row.id),
      role: row.role === "assistant" ? "assistant" : "user",
      // What the client saw: the answer text, never the stored internals.
      text: String(row.role === "assistant" ? row.answer_payload?.answer_markdown ?? row.content ?? "" : row.content ?? ""),
      createdAt: String(row.created_at)
    });
    byThread.set(row.thread_id, list);
  }

  return visible
    .map((t) => ({
      id: String(t.id),
      title: String(t.title ?? "Conversation"),
      createdAt: String(t.created_at),
      messages: byThread.get(t.id) ?? []
    }))
    .filter((chat) => chat.messages.length > 0);
}

/** Whether this firm can see one AI answer, for a lawyer replying to it. */
export async function isAiAnswerVisibleToFirm(
  firmId: string,
  firmClientId: string,
  aiAnswerId: string,
  override?: unknown
): Promise<boolean> {
  const client = db(override);
  const scope = await sharedChatScope(firmId, firmClientId, client);
  if (!scope) return false;

  const { data: message, error } = await client
    .from("advisor_messages")
    .select("id, thread_id, role")
    .eq("user_id", scope.userId)
    .eq("id", aiAnswerId)
    .maybeSingle();
  if (error || !message || message.role !== "assistant") return false;

  const { data: thread, error: threadError } = await client
    .from("advisor_threads")
    .select("created_at")
    .eq("user_id", scope.userId)
    .eq("id", message.thread_id)
    .maybeSingle();
  if (threadError || !thread) return false;
  return isThreadVisibleToFirm(thread.created_at, scope.visibleFrom);
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  cleanMessageBody,
  ensureConversation,
  findConversation,
  hasUnreadFrom,
  insertMessage,
  loadMessages,
  shouldSendAlert,
  type ConversationMessage
} from "@/lib/firms/message-core";
import { clientAlertEmail, defaultSendEmail, sendAlert, type SendEmail } from "@/lib/firms/message-alerts";
import { isAiAnswerVisibleToFirm } from "@/lib/firms/shared-chats";

/**
 * The lawyer's side of client messaging (specs/client-lawyer-messaging).
 *
 * Every function takes the firm from requireFirmMember() and finds the client
 * in firm_clients scoped to that firm before touching a conversation.
 * evals/firms/isolation.check.ts holds this file to the same rules as
 * clients.ts.
 */

function db(override?: unknown) {
  return (override ?? createSupabaseAdminClient()) as any;
}

type FirmClientRef = { id: string; user_id: string | null; normalized_email: string };

/** The client, only if they belong to this firm. */
async function firmClientFor(firmId: string, firmClientId: string, client: any): Promise<FirmClientRef | null> {
  const { data, error } = await client
    .from("firm_clients")
    .select("id, user_id, normalized_email")
    .eq("firm_id", firmId)
    .eq("id", firmClientId)
    .maybeSingle();
  if (error) throw new Error(`Could not load client: ${error.message}`);
  return (data as FirmClientRef | null) ?? null;
}

export type FirmConversation = { messages: ConversationMessage[]; hasUnread: boolean };

/** The conversation with one of this firm's clients. Empty when nobody has written yet. */
export async function getFirmConversation(firmId: string, firmClientId: string, override?: unknown): Promise<FirmConversation | null> {
  const client = db(override);
  const firmClient = await firmClientFor(firmId, firmClientId, client);
  if (!firmClient) return null;
  const conversation = await findConversation(client, firmId, firmClient.id);
  if (!conversation) return { messages: [], hasUnread: false };
  return {
    messages: await loadMessages(client, conversation.id),
    hasUnread: hasUnreadFrom(conversation.last_client_message_at, conversation.firm_last_read_at)
  };
}

/** Opening the conversation clears the unread marker for everyone at the firm. */
export async function markFirmConversationRead(firmId: string, firmClientId: string, override?: unknown, now = new Date()) {
  const client = db(override);
  const firmClient = await firmClientFor(firmId, firmClientId, client);
  if (!firmClient) return false;
  const { error } = await client
    .from("firm_conversations")
    .update({ firm_last_read_at: now.toISOString() })
    .eq("firm_id", firmId)
    .eq("firm_client_id", firmClient.id);
  if (error) console.error("[messages] could not mark read", error.message);
  return !error;
}

/** This firm's clients who have written since the firm last opened their conversation. */
export async function firmClientsWithUnreadMessages(firmId: string, override?: unknown): Promise<Set<string>> {
  const { data, error } = await db(override)
    .from("firm_conversations")
    .select("firm_client_id, last_client_message_at, firm_last_read_at")
    .eq("firm_id", firmId);
  if (error) {
    console.error("[messages] could not load unread markers", error.message);
    return new Set();
  }
  return new Set(
    ((data ?? []) as any[])
      .filter((row) => hasUnreadFrom(row.last_client_message_at, row.firm_last_read_at))
      .map((row) => String(row.firm_client_id))
  );
}

export type FirmSendResult =
  | { status: "sent"; alerted: boolean }
  | { status: "invalid"; error: string }
  | { status: "not_found" };

/**
 * A lawyer's message to a client. With aiAnswerId it is a reply to one of the
 * client's AI answers, allowed only when this firm can see that answer.
 */
export async function sendFirmMessage(
  firmId: string,
  input: {
    firmClientId: string;
    lawyerUserId: string;
    lawyerName: string;
    firmName: string;
    body: unknown;
    aiAnswerId?: string | null;
  },
  override?: unknown,
  deps: { send?: SendEmail; now?: Date } = {}
): Promise<FirmSendResult> {
  const cleaned = cleanMessageBody(input.body);
  if (!cleaned.ok) return { status: "invalid", error: cleaned.error };

  const client = db(override);
  const firmClient = await firmClientFor(firmId, input.firmClientId, client);
  if (!firmClient) return { status: "not_found" };

  if (input.aiAnswerId && !(await isAiAnswerVisibleToFirm(firmId, firmClient.id, input.aiAnswerId, client))) {
    return { status: "not_found" };
  }

  const conversation = await ensureConversation(client, firmId, firmClient.id);
  const inserted = await insertMessage(client, conversation, {
    senderRole: "lawyer",
    senderUserId: input.lawyerUserId,
    senderName: input.lawyerName,
    body: cleaned.body,
    source: input.aiAnswerId ? "advisor_reply" : "dashboard",
    advisorMessageId: input.aiAnswerId ?? null
  });
  if (inserted.status !== "sent") return { status: "sent", alerted: false };

  // Writing means the lawyer has seen everything so far.
  const now = deps.now ?? new Date();
  const patch: Record<string, string> = { firm_last_read_at: now.toISOString() };
  const alert = shouldSendAlert({
    lastAlertedAt: conversation.client_last_alerted_at,
    lastReadAt: conversation.client_last_read_at,
    now
  });
  if (alert) patch.client_last_alerted_at = now.toISOString();
  const { error } = await client.from("firm_conversations").update(patch).eq("firm_id", firmId).eq("id", conversation.id);
  if (error) console.error("[messages] could not update conversation", error.message);

  if (alert && firmClient.normalized_email) {
    await sendAlert([firmClient.normalized_email], clientAlertEmail({ firmName: input.firmName }), deps.send ?? defaultSendEmail);
  }
  return { status: "sent", alerted: alert };
}

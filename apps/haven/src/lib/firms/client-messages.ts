import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  cleanMessageBody,
  ensureConversation,
  findConversation,
  hasUnreadFrom,
  insertMessage,
  loadMessages,
  shouldSendAlert,
  type ConversationMessage,
  type MessageSource
} from "@/lib/firms/message-core";
import { defaultSendEmail, lawyerAlertEmail, sendAlert, type SendEmail } from "@/lib/firms/message-alerts";

/**
 * The client's side of messaging their lawyer (specs/client-lawyer-messaging).
 *
 * The signed-in user is the only input that decides access: a client can
 * reach a conversation only through their own firm_clients row. A firm id
 * from the browser just picks which of those rows; it can never add one.
 */

function db(override?: unknown) {
  return (override ?? createSupabaseAdminClient()) as any;
}

type ClientLink = {
  id: string;
  firm_id: string;
  normalized_email: string;
  shared_answers: Record<string, unknown> | null;
  firms: { name?: string | null } | null;
};

/** Every firm this user has joined. */
async function clientLinks(userId: string, client: any): Promise<ClientLink[]> {
  const { data, error } = await client
    .from("firm_clients")
    .select("id, firm_id, normalized_email, shared_answers, joined_at, firms(name)")
    .eq("user_id", userId)
    .not("joined_at", "is", null);
  if (error) throw new Error(`Could not load firms: ${error.message}`);
  return ((data ?? []) as any[]).filter((row) => row.joined_at) as ClientLink[];
}

function clientDisplayName(link: ClientLink): string {
  const fullName = link.shared_answers?.fullName;
  return typeof fullName === "string" && fullName.trim() ? fullName.trim() : link.normalized_email;
}

export type ClientConversation = {
  firmId: string;
  firmName: string;
  messages: ConversationMessage[];
  hasUnread: boolean;
};

/** One conversation per firm the client has joined, including firms nobody has written to yet. */
export async function listClientConversations(userId: string, override?: unknown): Promise<ClientConversation[]> {
  const client = db(override);
  const links = await clientLinks(userId, client);
  const out: ClientConversation[] = [];
  for (const link of links) {
    const conversation = await findConversation(client, link.firm_id, link.id);
    out.push({
      firmId: link.firm_id,
      firmName: link.firms?.name ?? "your law firm",
      messages: conversation ? await loadMessages(client, conversation.id) : [],
      hasUnread: conversation ? hasUnreadFrom(lastLawyerMessageAt(conversation), conversation.client_last_read_at) : false
    });
  }
  return out;
}

/** The last lawyer message time is not stored directly; any message after the client's last one counts. */
function lastLawyerMessageAt(conversation: { last_message_at: string | null; last_client_message_at: string | null }) {
  if (!conversation.last_message_at) return null;
  if (conversation.last_client_message_at && conversation.last_client_message_at >= conversation.last_message_at) return null;
  return conversation.last_message_at;
}

/** Opening their messages clears the client's unread marker for that firm. */
export async function markClientConversationRead(userId: string, firmId: string, override?: unknown, now = new Date()) {
  const client = db(override);
  const link = (await clientLinks(userId, client)).find((l) => l.firm_id === firmId);
  if (!link) return false;
  const { error } = await client
    .from("firm_conversations")
    .update({ client_last_read_at: now.toISOString() })
    .eq("firm_id", link.firm_id)
    .eq("firm_client_id", link.id);
  if (error) console.error("[messages] could not mark read", error.message);
  return !error;
}

export type ClientSendResult =
  | { status: "sent"; alerted: boolean }
  | { status: "already_sent" }
  | { status: "invalid"; error: string }
  | { status: "not_found" };

/** A client's message to one of their firms. */
export async function sendClientMessage(
  userId: string,
  input: { firmId: string; body: unknown; source?: Extract<MessageSource, "onboarding" | "dashboard"> },
  override?: unknown,
  deps: { send?: SendEmail; now?: Date } = {}
): Promise<ClientSendResult> {
  const cleaned = cleanMessageBody(input.body);
  if (!cleaned.ok) return { status: "invalid", error: cleaned.error };

  const client = db(override);
  const link = (await clientLinks(userId, client)).find((l) => l.firm_id === input.firmId);
  if (!link) return { status: "not_found" };
  return sendOnLink(client, userId, link, cleaned.body, input.source ?? "dashboard", deps);
}

/**
 * The setup box "What would you like your lawyer to know or answer?". Sent to
 * every firm the client is setting up with, once each: a second finish (or a
 * double click) finds the first and sends nothing.
 */
export async function sendOnboardingMessages(
  userId: string,
  rawBody: unknown,
  override?: unknown,
  deps: { send?: SendEmail; now?: Date } = {}
): Promise<ClientSendResult[]> {
  if (typeof rawBody !== "string" || !rawBody.trim()) return [];
  const cleaned = cleanMessageBody(rawBody);
  if (!cleaned.ok) return [{ status: "invalid", error: cleaned.error }];
  const client = db(override);
  const results: ClientSendResult[] = [];
  for (const link of await clientLinks(userId, client)) {
    results.push(await sendOnLink(client, userId, link, cleaned.body, "onboarding", deps));
  }
  return results;
}

async function sendOnLink(
  client: any,
  userId: string,
  link: ClientLink,
  body: string,
  source: "onboarding" | "dashboard",
  deps: { send?: SendEmail; now?: Date }
): Promise<ClientSendResult> {
  const conversation = await ensureConversation(client, link.firm_id, link.id);
  const inserted = await insertMessage(client, conversation, {
    senderRole: "client",
    senderUserId: userId,
    senderName: clientDisplayName(link),
    body,
    source
  });
  if (inserted.status === "duplicate") return { status: "already_sent" };

  const now = deps.now ?? new Date();
  const patch: Record<string, string> = { client_last_read_at: now.toISOString() };
  const alert = shouldSendAlert({
    lastAlertedAt: conversation.firm_last_alerted_at,
    lastReadAt: conversation.firm_last_read_at,
    now
  });
  if (alert) patch.firm_last_alerted_at = now.toISOString();
  const { error } = await client.from("firm_conversations").update(patch).eq("id", conversation.id);
  if (error) console.error("[messages] could not update conversation", error.message);

  if (alert) {
    const { data: members, error: memberError } = await client
      .from("firm_members")
      .select("email")
      .eq("firm_id", link.firm_id);
    if (memberError) console.error("[messages] could not load lawyers to alert", memberError.message);
    await sendAlert(
      ((members ?? []) as any[]).map((m) => String(m.email ?? "")),
      lawyerAlertEmail({ clientName: clientDisplayName(link), firmClientId: link.id }),
      deps.send ?? defaultSendEmail
    );
  }
  return { status: "sent", alerted: alert };
}

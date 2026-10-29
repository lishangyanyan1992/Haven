import { MESSAGE_MAX_LENGTH } from "@/lib/firms/message-limits";

/**
 * Client and lawyer messaging (specs/client-lawyer-messaging): the parts both
 * sides share. Who may read or write a conversation is decided before these
 * are called, in firm-messages.ts (the lawyer side, scoped to the lawyer's
 * firm) and client-messages.ts (the client side, scoped to the signed-in
 * client). Nothing here takes a firm or client from the browser.
 */

/** At most one alert email per recipient per conversation in this window. */
export const ALERT_WINDOW_MS = 15 * 60 * 1000;

/** How much of an AI answer a lawyer's reply quotes. */
export const QUOTE_LENGTH = 160;

const UNIQUE_VIOLATION = "23505";
const MAX_MESSAGES = 500;

export type MessageSource = "onboarding" | "dashboard" | "advisor_reply";

export type ConversationRow = {
  id: string;
  firm_id: string;
  firm_client_id: string;
  client_last_read_at: string | null;
  firm_last_read_at: string | null;
  client_last_alerted_at: string | null;
  firm_last_alerted_at: string | null;
  last_message_at: string | null;
  last_client_message_at: string | null;
};

export type ConversationMessage = {
  id: string;
  senderRole: "client" | "lawyer";
  senderName: string;
  body: string;
  source: MessageSource;
  createdAt: string;
  /** For a lawyer's reply to an AI answer: the start of that answer, or deleted when the client removed the chat. */
  aiAnswerQuote: { excerpt: string; chatId: string } | { deleted: true } | null;
};

export type CleanBody = { ok: true; body: string } | { ok: false; error: string };

/** Plain text, 1 to 5,000 characters once trimmed. */
export function cleanMessageBody(raw: unknown): CleanBody {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > MESSAGE_MAX_LENGTH) {
    return { ok: false, error: `Messages can be up to ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.` };
  }
  return { ok: true, body };
}

/**
 * Whether a new message should email the recipient: never alerted, alerted
 * more than 15 minutes ago, or they have opened the conversation since.
 */
export function shouldSendAlert(input: { lastAlertedAt: string | null; lastReadAt: string | null; now: Date }): boolean {
  if (!input.lastAlertedAt) return true;
  const alertedAt = new Date(input.lastAlertedAt).getTime();
  if (input.now.getTime() - alertedAt >= ALERT_WINDOW_MS) return true;
  return Boolean(input.lastReadAt && new Date(input.lastReadAt).getTime() >= alertedAt);
}

/** True when the other side wrote after this side last opened the conversation. */
export function hasUnreadFrom(lastOtherMessageAt: string | null, lastReadAt: string | null): boolean {
  if (!lastOtherMessageAt) return false;
  if (!lastReadAt) return true;
  return new Date(lastOtherMessageAt).getTime() > new Date(lastReadAt).getTime();
}

const CONVERSATION_COLUMNS =
  "id, firm_id, firm_client_id, client_last_read_at, firm_last_read_at, client_last_alerted_at, firm_last_alerted_at, last_message_at, last_client_message_at";

/** The conversation between one firm and one of its clients, if it exists. */
export async function findConversation(client: any, firmId: string, firmClientId: string): Promise<ConversationRow | null> {
  const { data, error } = await client
    .from("firm_conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("firm_id", firmId)
    .eq("firm_client_id", firmClientId)
    .maybeSingle();
  if (error) throw new Error(`Could not load conversation: ${error.message}`);
  return (data as ConversationRow | null) ?? null;
}

/** The conversation, created on first use. Callers have already checked the client belongs to the firm. */
export async function ensureConversation(client: any, firmId: string, firmClientId: string): Promise<ConversationRow> {
  const existing = await findConversation(client, firmId, firmClientId);
  if (existing) return existing;
  const { data, error } = await client
    .from("firm_conversations")
    .insert({ firm_id: firmId, firm_client_id: firmClientId })
    .select(CONVERSATION_COLUMNS)
    .single();
  if (error?.code === UNIQUE_VIOLATION) {
    const raced = await findConversation(client, firmId, firmClientId);
    if (raced) return raced;
  }
  if (error || !data) throw new Error(`Could not start conversation: ${error?.message ?? "no row"}`);
  return data as ConversationRow;
}

export type InsertResult = { status: "sent"; createdAt: string } | { status: "duplicate" };

/** Save one message and move the conversation's timestamps. */
export async function insertMessage(
  client: any,
  conversation: ConversationRow,
  input: {
    senderRole: "client" | "lawyer";
    senderUserId: string | null;
    senderName: string;
    body: string;
    source: MessageSource;
    advisorMessageId?: string | null;
  }
): Promise<InsertResult> {
  const { data, error } = await client
    .from("firm_messages")
    .insert({
      conversation_id: conversation.id,
      sender_role: input.senderRole,
      sender_user_id: input.senderUserId,
      sender_name: input.senderName.slice(0, 200),
      body: input.body,
      source: input.source,
      advisor_message_id: input.advisorMessageId ?? null
    })
    .select("created_at")
    .single();
  if (error?.code === UNIQUE_VIOLATION) return { status: "duplicate" };
  if (error || !data) throw new Error(`Could not send message: ${error?.message ?? "no row"}`);

  const createdAt = String(data.created_at);
  const patch: Record<string, string> = { last_message_at: createdAt };
  if (input.senderRole === "client") patch.last_client_message_at = createdAt;
  const { error: updateError } = await client.from("firm_conversations").update(patch).eq("id", conversation.id);
  if (updateError) console.error("[messages] could not update conversation times", updateError.message);
  return { status: "sent", createdAt };
}

/**
 * Every message in a conversation, oldest first. A lawyer's reply to an AI
 * answer quotes the start of that answer, read live from the client's own
 * chat so nothing is copied: when the client deletes the chat, the quote goes.
 */
export async function loadMessages(client: any, conversationId: string): Promise<ConversationMessage[]> {
  const { data, error } = await client
    .from("firm_messages")
    .select("id, sender_role, sender_name, body, source, advisor_message_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) throw new Error(`Could not load messages: ${error.message}`);
  // Newest 500, shown oldest first.
  const rows = ((data ?? []) as any[]).reverse();

  const quotedIds = rows.map((row) => row.advisor_message_id).filter((id): id is string => typeof id === "string");
  const quotes = new Map<string, { excerpt: string; chatId: string }>();
  if (quotedIds.length > 0) {
    const { data: quoted, error: quoteError } = await client
      .from("advisor_messages")
      .select("id, thread_id, content, answer_payload")
      .in("id", quotedIds);
    if (quoteError) console.error("[messages] could not load quoted answers", quoteError.message);
    for (const row of (quoted ?? []) as any[]) {
      const text = String(row.answer_payload?.answer_markdown ?? row.content ?? "");
      quotes.set(row.id, { excerpt: excerpt(text), chatId: String(row.thread_id) });
    }
  }

  return rows.map((row) => ({
    id: String(row.id),
    senderRole: row.sender_role === "lawyer" ? "lawyer" : "client",
    senderName: String(row.sender_name ?? ""),
    body: String(row.body ?? ""),
    source: (row.source ?? "dashboard") as MessageSource,
    createdAt: String(row.created_at),
    aiAnswerQuote:
      row.source !== "advisor_reply"
        ? null
        : row.advisor_message_id && quotes.has(row.advisor_message_id)
          ? quotes.get(row.advisor_message_id)!
          : { deleted: true }
  }));
}

/** The start of an answer as plain text, for a quote. */
export function excerpt(markdown: string): string {
  const plain = markdown
    .replace(/[#>*_`~\[\]]/g, "")
    .replace(/\(https?:[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > QUOTE_LENGTH ? `${plain.slice(0, QUOTE_LENGTH - 1).trimEnd()}…` : plain;
}

const PRODUCTION_SITE = "https://haven-h1b.com";

/** Site address for links in alert emails. Never a localhost link outside development. */
export function siteUrl(path: string): string {
  let base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) {
    if (process.env.NODE_ENV === "production") {
      console.error("[messages] NEXT_PUBLIC_SITE_URL is not set; alert links use the public site address");
      base = PRODUCTION_SITE;
    } else {
      base = "http://localhost:3000";
    }
  }
  return new URL(path, base).toString();
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAcknowledgementCurrent } from "@/lib/advisor/firm-visibility-copy";

/**
 * Telling a firm's client that their firm sees their AI chats
 * (specs/advisor-chat-firm-visibility).
 *
 * For a firm client the chat is "ask your lawyer": Haven's AI answers first and
 * the lawyer may follow up. Before their first question after this shipped,
 * and again after joining another firm, the client is shown who can see the
 * chat and must acknowledge it. A firm then sees only chats started at or
 * after that acknowledgement; earlier chats stay private.
 *
 * The client side lives here; the firm's read is src/lib/firms/shared-chats.ts.
 */

function db(override?: unknown) {
  return (override ?? createSupabaseAdminClient()) as any;
}

export {
  AI_ANSWER_LABEL_FIRM,
  AI_ANSWER_LABEL_NO_FIRM,
  aiAnswerLabel,
  isAcknowledgementCurrent,
  isThreadVisibleToFirm,
  joinFirmNames,
  visibilityLineText,
  visibilityNoticeText
} from "@/lib/advisor/firm-visibility-copy";

export type ChatVisibility = {
  /** Every firm the client is linked to now. Empty for people without a firm. */
  firms: { firmId: string; firmName: string; acknowledgedAt: string | null }[];
  /** True when some linked firm has no acknowledgement yet: the notice must be shown before sending. */
  needsNotice: boolean;
};

/** Which firms see this person's chats, and whether they still need to be told. */
export async function getChatVisibility(userId: string, override?: unknown): Promise<ChatVisibility> {
  const client = db(override);
  const { data: links, error } = await client
    .from("firm_clients")
    .select("firm_id, joined_at, firms(name)")
    .eq("user_id", userId)
    .not("joined_at", "is", null);
  if (error) throw new Error(`Could not load firms: ${error.message}`);
  const linked = ((links ?? []) as any[]).filter((row) => row.joined_at);
  if (linked.length === 0) return { firms: [], needsNotice: false };

  const { data: acks, error: ackError } = await client
    .from("advisor_firm_visibility_acks")
    .select("firm_id, acknowledged_at")
    .eq("user_id", userId);
  if (ackError) throw new Error(`Could not load chat sharing: ${ackError.message}`);
  const ackByFirm = new Map(((acks ?? []) as any[]).map((row) => [String(row.firm_id), String(row.acknowledged_at)]));

  const firms = linked.map((row) => {
    const ack = ackByFirm.get(String(row.firm_id)) ?? null;
    return {
      firmId: String(row.firm_id),
      firmName: String(row.firms?.name ?? "your law firm"),
      // An agreement from an earlier link to this firm doesn't count.
      acknowledgedAt: isAcknowledgementCurrent(ack, row.joined_at) ? ack : null
    };
  });
  return { firms, needsNotice: firms.some((f) => !f.acknowledgedAt) };
}

/**
 * Record that the client saw the notice, for every linked firm without a
 * current acknowledgement (none, or one from an earlier link, which is
 * replaced). Current ones keep their original time, so a repeat click can
 * never make older chats visible. `shownFirmIds` are the firms the notice
 * named; nothing is recorded if any firm needing agreement wasn't among them.
 */
export async function acknowledgeChatVisibility(
  userId: string,
  shownFirmIds: readonly string[],
  override?: unknown,
  now = new Date()
): Promise<ChatVisibility> {
  const client = db(override);
  const current = await getChatVisibility(userId, client);
  const missing = current.firms.filter((f) => !f.acknowledgedAt);
  // Only firms the client was shown can be agreed to. If a firm was linked
  // after the notice appeared, record nothing: the refreshed notice names it.
  const shown = new Set(shownFirmIds);
  if (missing.some((f) => !shown.has(f.firmId))) return current;
  if (missing.length > 0) {
    const { error } = await client.from("advisor_firm_visibility_acks").upsert(
      missing.map((f) => ({ user_id: userId, firm_id: f.firmId, acknowledged_at: now.toISOString() })),
      { onConflict: "user_id,firm_id" }
    );
    if (error) throw new Error(`Could not save chat sharing: ${error.message}`);
  }
  return getChatVisibility(userId, client);
}

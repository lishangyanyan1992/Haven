/**
 * Wording and the one visibility rule for AI chats a firm can see
 * (specs/advisor-chat-firm-visibility). No database access, so the chat
 * screen can use it in the browser.
 */

/** A chat is visible to a firm when it started at or after the client's acknowledgement for that firm. */
export function isThreadVisibleToFirm(threadCreatedAt: string | null | undefined, acknowledgedAt: string | null | undefined): boolean {
  if (!threadCreatedAt || !acknowledgedAt) return false;
  const created = new Date(threadCreatedAt).getTime();
  const acked = new Date(acknowledgedAt).getTime();
  if (Number.isNaN(created) || Number.isNaN(acked)) return false;
  return created >= acked;
}

/**
 * An acknowledgement counts only if it was given during the current link to
 * the firm. When a client leaves and rejoins (or grants access again), the
 * join time moves and they must be told again.
 */
export function isAcknowledgementCurrent(acknowledgedAt: string | null | undefined, joinedAt: string | null | undefined): boolean {
  if (!acknowledgedAt || !joinedAt) return false;
  const acked = new Date(acknowledgedAt).getTime();
  const joined = new Date(joinedAt).getTime();
  if (Number.isNaN(acked) || Number.isNaN(joined)) return false;
  return acked >= joined;
}

/**
 * Shown above the chat box from before the first message and throughout the
 * conversation, whenever Haven's AI is answering. Fixed text from the page, never
 * written by the model. Covers AI-use disclosure rules (for example Utah Code
 * 13-77, Florida Bar Opinion 24-1) and the Texas software exemption, which
 * requires saying the product is not a substitute for an attorney's advice.
 */
export const AI_DISCLOSURE_NOTICE =
  "You're talking to Haven's AI, not a lawyer. It gives general information and is not a substitute for advice from your attorney.";

/** Shown under every AI answer. Fixed text, rendered by the page, never written by the model. */
export const AI_ANSWER_LABEL_FIRM = "AI can make mistakes. Your lawyer may reach out to confirm this.";
export const AI_ANSWER_LABEL_NO_FIRM = "AI can make mistakes. Check important decisions with an immigration lawyer.";

export function aiAnswerLabel(hasFirm: boolean): string {
  return hasFirm ? AI_ANSWER_LABEL_FIRM : AI_ANSWER_LABEL_NO_FIRM;
}

/** "Acme Law" / "Acme Law and Baker Immigration" / "A, B and C". */
export function joinFirmNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] ?? "your law firm";
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

export function visibilityNoticeText(firmNames: string[]): string {
  return `Questions you ask here go to your lawyer at ${joinFirmNames(firmNames)}. Haven's AI answers first, and your lawyer may follow up to confirm or add to it.`;
}

export function visibilityLineText(firmNames: string[]): string {
  return `Your lawyer at ${joinFirmNames(firmNames)} sees these questions. Haven's AI answers first.`;
}

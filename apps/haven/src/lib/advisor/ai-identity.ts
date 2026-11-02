/**
 * The Advisor must always be honest that it is an AI and not a lawyer.
 *
 * Utah Code 13-77 requires a clear answer whenever someone asks whether they are
 * talking to AI, and bar guidance on intake chatbots (for example Florida Bar
 * Opinion 24-1) requires that people know they are not talking to a lawyer. The
 * page shows a fixed notice; this covers what the model says when asked.
 *
 * Appended in code after the hosted prompt is fetched, so editing the prompt in
 * Langfuse cannot remove it.
 */
export const AI_IDENTITY_INSTRUCTION = [
  "AI IDENTITY. You are an AI assistant, not a person and not a lawyer, and Haven is not a law firm.",
  "If anyone asks or implies whether they are talking to a person, a lawyer, or an AI, say plainly in your first sentence that you are Haven's AI assistant, not a person or a lawyer, and that your answers are general information and not a substitute for advice from their attorney.",
  "Never claim or imply to be human, a lawyer, a paralegal, or acting for their law firm, and never say you represent them."
].join(" ");

export function withAiIdentity(systemPrompt: string): string {
  return `${systemPrompt}\n\n${AI_IDENTITY_INSTRUCTION}`;
}

/**
 * Fixed reply for "is this a person / a bot / my lawyer?" when the question
 * matches no immigration topic. Those turns never reach the model, so the
 * clarifying menu used to answer them, which is not the clear answer the rules
 * require.
 */
export const AI_IDENTITY_REPLY = [
  "You're talking to Haven's AI assistant, not a person and not a lawyer. Haven is not a law firm, so I can't represent you or act as your attorney.",
  "",
  "I can explain how immigration rules work in general and help you prepare questions for your immigration lawyer. My answers are not a substitute for advice from your attorney."
].join("\n");

const IDENTITY_NOUN =
  "(?:person|human|bot|chatbot|robot|ai|a\\.i\\.|machine|computer|program|lawyer|attorney|paralegal|representative)";
const ARTICLE = "(?:a |an |my |the |some )?";
const QUALIFIER = "(?:real |actual |human |live |licensed |immigration )*";

/**
 * Identity statements only: the noun has to follow the subject directly
 * ("are you a lawyer", "am I talking to a chatbot"), so "are you sharing this
 * with my lawyer" does not count.
 */
const IDENTITY_PATTERNS = [
  new RegExp(`\\b(?:am i|are we|is this|i'm|im)\\s+(?:really |actually |still |now )?(?:talking|speaking|chatting|texting)\\s+(?:to|with)\\s+${ARTICLE}${QUALIFIER}${IDENTITY_NOUN}\\b`),
  new RegExp(`\\b(?:are you|is this|is it|you're|youre|you are)\\s+(?:really |actually |just |now )?${ARTICLE}${QUALIFIER}${IDENTITY_NOUN}\\b`),
  /\b(?:person|human)\s+or\s+(?:a\s+)?(?:bot|chatbot|ai|robot|machine)\b|\b(?:bot|chatbot|ai|robot|machine)\s+or\s+(?:a\s+)?(?:person|human)\b/,
  /\b(?:can|will|could|would) you\s+(?:legally\s+)?(?:represent me|be my (?:lawyer|attorney))\b/
];

const FILLER = /^(?:wait|ok|okay|thanks|thank you|hi|hello|hey|so|um|hmm|sorry|great|cool|right)[\s,!.?]*$/;

/** True when someone is asking whether they are talking to a person, a bot or a lawyer. */
export function asksAboutAiIdentity(text: string): boolean {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  return IDENTITY_PATTERNS.some((pattern) => pattern.test(t));
}

/**
 * "only": every sentence is an identity question or filler, so the fixed reply
 * is the whole answer. "combined": there is also a real question to handle.
 */
export function identityQuestionKind(text: string): "none" | "only" | "combined" {
  if (!asksAboutAiIdentity(text)) return "none";
  const sentences = text
    .split(/(?<=[?.!])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const rest = sentences.filter((sentence) => {
    if (asksAboutAiIdentity(sentence)) return false;
    const lower = sentence.toLowerCase();
    return !FILLER.test(lower) && lower.split(/\s+/).length >= 3;
  });
  return rest.length === 0 ? "only" : "combined";
}

/** One-line disclosure put in front of a fixed reply when the turn also asks something else. */
export const AI_IDENTITY_LINE =
  "To answer your first question: you're talking to Haven's AI assistant, not a person or a lawyer, and I can't represent you. My answers are not a substitute for advice from your attorney.";

/** Puts the identity line in front of a fixed reply when the person asked who they are talking to. */
export function withIdentityLine(text: string, question: string): string {
  return asksAboutAiIdentity(question) ? `${AI_IDENTITY_LINE}\n\n${text}` : text;
}

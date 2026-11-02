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

/** True when someone is asking whether they are talking to a person, a bot or a lawyer. */
export function asksAboutAiIdentity(text: string): boolean {
  const t = text.toLowerCase().replace(/[’']/g, "'");
  const whoAmI =
    /\b(am i|are you|is this|is it|i'm|im)\b[^?.!]{0,40}\b(talking|speaking|chatting|texting)\b[^?.!]{0,25}\b(to|with)\b[^?.!]{0,20}\b(a |an |the )?(real |actual |human |live )?(person|human|bot|robot|ai|a\.i\.|machine|computer|lawyer|attorney|paralegal)\b/;
  const areYou =
    /\b(are you|is this|you're|you are|youre)\b[^?.!]{0,25}\b(a |an |my |the )?(real |actual |human |live |licensed )?(person|human|bot|robot|ai|a\.i\.|chatbot|machine|lawyer|attorney|immigration attorney|immigration lawyer|paralegal|representative)\b/;
  const personOrBot = /\b(person|human)\b[^?.!]{0,12}\bor\b[^?.!]{0,12}\b(bot|ai|robot|machine)\b|\b(bot|ai|robot|machine)\b[^?.!]{0,12}\bor\b[^?.!]{0,12}\b(person|human)\b/;
  const represent = /\b(can|will|could|would) you\b[^?.!]{0,20}\b(represent|be my (lawyer|attorney))\b/;
  return whoAmI.test(t) || areYou.test(t) || personOrBot.test(t) || represent.test(t);
}

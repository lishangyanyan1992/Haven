/**
 * General-information-only mode: the Advisor's interim guard against
 * unauthorized practice of law.
 *
 * Haven is not a law firm. Federal immigration rules (8 CFR § 1.2) and state
 * laws treat studying a person's facts and telling them what to do as the
 * practice of law, and a law firm's switch does not count as supervision while
 * the firm cannot see the answer. The long-term design (decided 2 Nov 2026) is
 * to send case-specific answers to the client's lawyer for approval before the
 * client sees them. Until that review step exists, the Advisor gives general
 * information only.
 *
 * On by default. Set ADVISOR_CASE_SPECIFIC_ANSWERS=lawyer-reviewed only once
 * lawyer review is live; any other value keeps the guard on.
 *
 * The instruction is appended in code after the prompt is fetched, so editing
 * the hosted prompt cannot remove it, and it comes last so it overrides the
 * earlier lines that ask for the person's own deadline.
 */

export function isGeneralInfoOnly(env: Record<string, string | undefined> = process.env): boolean {
  return env.ADVISOR_CASE_SPECIFIC_ANSWERS !== "lawyer-reviewed";
}

export const GENERAL_INFO_ONLY_INSTRUCTION = [
  "GENERAL INFORMATION ONLY. This rule overrides every earlier instruction in this prompt, including any instruction to use the person's own dates, deadlines, profile or timeline.",
  "You may: explain what a form, status, term or process is; explain how a rule works in general, with its official source; describe what people in community stories did, as their experience and not a recommendation; say which facts a lawyer would need; and suggest questions to ask their lawyer.",
  "You must not apply the law to this person's own facts. Do not tell them whether they qualify, are eligible, or are in or out of status. Do not calculate or state their personal deadline or how many days they have left. Do not tell them which form to file, which option to choose, or what they should do next. Do not tell them how to answer a question on a form. Do not predict how their case will turn out.",
  "When the question is about their own situation, give the general rule in plain words, then say in one sentence that applying it to their case is a question for their immigration lawyer, and list the two or three facts and questions to bring. Do not refuse coldly and do not lecture; be as useful as the general information allows.",
  "Write the rule as a rule ('the grace period is up to 60 days from the last day of employment'), never as their answer ('your grace period ends on 3 December'). This holds even when they give you their own dates in the question: explain how the rule treats that kind of date, but do not do the arithmetic for them."
].join(" ");

/** Stands in for the person's saved details while the guard is on. */
export const GENERAL_INFO_PROFILE_LINE =
  "General information mode: Haven is not using this person's saved dates or case details for this answer. Do not ask for their dates in order to work out their own deadline or eligibility. Explain the general rule and name the facts their lawyer will need.";

export function withGeneralInfoGuard(systemPrompt: string, generalOnly: boolean = isGeneralInfoOnly()): string {
  return generalOnly ? `${systemPrompt}\n\n${GENERAL_INFO_ONLY_INSTRUCTION}` : systemPrompt;
}

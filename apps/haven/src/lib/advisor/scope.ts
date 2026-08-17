/**
 * What the Advisor answers, and what it declines.
 *
 * WHY THIS FILE EXISTS
 *
 * The Advisor covered ten topics, and that breadth is the root cause of the mess
 * the redesign is unwinding. Ten topics needed ten sets of rules; there was one
 * prompt to put them in, so the prompt became a changelog of fourteen one-off
 * instructions. Twenty-two of thirty-seven guardrails are named `FIX_` after the
 * bug that produced them. Every topic added made every other topic's answer
 * slightly worse, and nothing in the code said which topics the product had
 * actually committed to being good at.
 *
 * This file is that statement. Two areas are in scope, and they were chosen from
 * the intent corpus rather than from intuition:
 *
 *   1. "I lost my job — how do I stay?"  (layoffs, grace period, bridge status)
 *   2. "Where am I in the green card line?"  (visa bulletin, priority dates,
 *      I-485 filing eligibility)
 *
 * The card sort of 73 real questions found that layoff and bridge-status
 * mechanics — B-2 as a bridge, H-4 switches, the 240-day rule — are the largest
 * cluster by a wide margin, and that they are not separate questions. Somebody
 * asking "can I switch to H-4 while I look?" is asking the layoff question. They
 * are one topic here for that reason.
 *
 * WHY DECLINING IS THE SAFER ANSWER, NOT THE LAZIER ONE
 *
 * At tier 4 a half-covered topic is worse than an honest redirect. The two
 * topics cut here with the highest stakes — travel with a pending I-485, and
 * CSPA — are also the two that generated the most post-hoc patches, which is
 * evidence they were being answered at the edge of what the pipeline could do
 * safely. A redirect that names the deadline and sends the user to counsel is a
 * better outcome than an answer that is right four times in five.
 *
 * WHAT SURVIVES THE NARROWING
 *
 * Being out of scope is not the same as having nothing to say. Every redirect
 * carries the one fact that topic's user could otherwise learn too late — the
 * I-485 abandonment risk, that pending OPT is not work authorization, that
 * motion deadlines run from the notice. And the safety floors are not topics at
 * all, so they are untouched: moderation and the crisis hand-off run before any
 * of this, and the refusal to help conceal facts from USCIS is carried by the
 * work-authorization redirect itself rather than dropped with the topic.
 *
 * HOW TO PUT A TOPIC BACK
 *
 * Delete its line from REDIRECTED. That is deliberately the whole change: the
 * point of the narrowing is that topics return one at a time, each with its own
 * rule module and its own eval cohort, and the cost of re-adding one should be
 * visible in a one-line diff rather than spread across a prompt.
 */

import type { TopicBucket } from "@/lib/advisor/topics";

/**
 * Topics the Advisor declines, mapped to the message it declines with.
 *
 * Empty this map and the Advisor answers everything again, exactly as it did
 * before the narrowing. That is the intended off switch.
 */
export const REDIRECTED: Partial<Record<TopicBucket, string>> = {
  "student-status": "MSG_SCOPE_STUDENT",
  "job-change": "MSG_SCOPE_JOB_CHANGE",
  cspa: "MSG_SCOPE_CSPA",
  "self-petition": "MSG_SCOPE_SELF_PETITION",
  perm: "MSG_SCOPE_PERM",
  "work-authorization": "MSG_SCOPE_UNAUTHORIZED_WORK"
};

/**
 * Order in which competing redirects are chosen, most time-critical first.
 *
 * A question can raise two declined areas at once — "my daughter ages out and my
 * NIW was denied" is both — and the user should get the one where the deadline
 * is least recoverable. CSPA leads because its deadline can pass while somebody
 * is still working out who to ask.
 */
const REDIRECT_PRIORITY: TopicBucket[] = [
  "cspa",
  "self-petition",
  // Below student-status, not above it. A student asking whether they can start
  // work on a pending OPT application raises both topics, and sending them the
  // "you worked without permission" redirect answers an accusation they did not
  // make. The student redirect carries the fact they actually need — pending OPT
  // is not permission to work — so it is the better of the two here.
  "student-status",
  "work-authorization",
  "job-change",
  "perm"
];

/**
 * Declined topics that lose when the question is about the user's own Haven data.
 *
 * PERM is the only one, and it yields only to `haven-product` — not to any
 * in-scope topic. The narrower rule is deliberate: yielding to anything in scope
 * let real PERM questions through, because "my employer started PERM and my H-1B
 * max-out is in March" raises h1b too and would have been answered.
 *
 * What this does allow is "I uploaded my I-797, PERM receipt and I-140 approval —
 * what does my timeline look like?", a question about documents the user gave us
 * that happens to name PERM. Answering that with "PERM is your employer's job" is
 * unhelpful and slightly absurd.
 *
 * Nothing else belongs here. Every other declined topic carries a deadline, so
 * even an incidental mention is worth stopping for.
 */
const YIELDS_TO_HAVEN_PRODUCT: TopicBucket[] = ["perm"];

export type ScopeDecision =
  | { inScope: true }
  | { inScope: false; area: TopicBucket | "travel"; guardrailId: string };

/**
 * Decide whether to answer.
 *
 * Travel is handled by signal rather than by topic, and the distinction is load
 * bearing. `adjustment-of-status` covers both "can I file my I-485 this month?"
 * — which is the green-card-queue question and squarely in scope — and "can I
 * fly home with it pending?", which is the cut travel topic. Redirecting the
 * whole topic would take the queue question with it; keeping the whole topic
 * would keep travel. So the split follows the travel signal, not the label.
 *
 * An out-of-scope area wins even when in-scope topics are also present. A
 * layoff question that also asks about travel gets the travel redirect, because
 * answering the layoff half and quietly dropping the travel half is precisely
 * the partial coverage this narrowing exists to stop.
 */
export function decideScope(topics: TopicBucket[], travelMentioned: boolean): ScopeDecision {
  if (travelMentioned && topics.includes("adjustment-of-status")) {
    return { inScope: false, area: "travel", guardrailId: "MSG_SCOPE_TRAVEL" };
  }

  const isHavenProductQuestion = topics.includes("haven-product");

  for (const topic of REDIRECT_PRIORITY) {
    const guardrailId = REDIRECTED[topic];
    if (!guardrailId || !topics.includes(topic)) continue;
    if (isHavenProductQuestion && YIELDS_TO_HAVEN_PRODUCT.includes(topic)) continue;
    return { inScope: false, area: topic, guardrailId };
  }

  return { inScope: true };
}

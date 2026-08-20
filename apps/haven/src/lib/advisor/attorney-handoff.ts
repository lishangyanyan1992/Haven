/**
 * Turning "talk to an immigration attorney" into somewhere to go.
 *
 * The Advisor says this constantly, and it has to — it is not a lawyer, and on a
 * subject where a wrong move costs somebody their status, handing the question to
 * a professional is often the honest answer. But said on its own it is a dead end
 * of exactly the kind a support bot creates when it says "please contact support":
 * technically correct, and the conversation is over with the user no closer to
 * anything. Worse here, because the person now has to work out what *kind* of
 * lawyer their problem needs, which is usually the thing they came in unsure
 * about.
 *
 * So a handoff carries three things the user cannot easily assemble themselves:
 *
 * 1. **Where.** A link into Haven's directory already filtered to the practice
 *    area their question falls in, so they land on firms that take this kind of
 *    case rather than on sixty unsorted ones.
 * 2. **What to bring.** Their own dates, pulled from what Haven already holds.
 *    The first thing any attorney asks for, and the thing people arrive without.
 * 3. **What to ask.** Two or three questions specific to their situation. A
 *    consultation is usually thirty minutes and often paid; walking in with the
 *    right questions is the difference between an answer and a quote.
 *
 * Two things this deliberately does not do. It never says a firm is right for
 * them — the directory is a starting point and says so, and an endorsement is not
 * ours to make. And it never softens the recommendation into optional. Where the
 * Advisor has decided somebody needs counsel, the handoff makes that easier to
 * act on, not easier to skip.
 *
 * Built in code rather than asked of the model for the usual reason: the link,
 * the practice area, and the user's dates are facts we hold, and a model that can
 * paraphrase them can also invent them.
 */

import type { TopicBucket } from "@/lib/advisor/topics";
import { readGracePeriod } from "@/lib/advisor/grace-period";
import { isArchivedPath } from "@/lib/archived-routes";

/**
 * Practice areas as the directory data actually spells them.
 *
 * A value not in this list silently disables the filter and lands the user on the
 * whole directory, so these strings must match the firm records. Checked by
 * `attorney-handoff.check.ts` against the real data rather than trusted here.
 */
export type PracticeArea = "H-1B" | "EB-2 NIW" | "PERM" | "Student" | "Immigration";

/**
 * Which practice area a topic belongs to, most specific first.
 *
 * Ordered rather than mapped because a question usually carries several topics,
 * and the narrowest one should choose the firms. Somebody asking about a PERM
 * after a layoff wants firms that do PERM; sending them to the general list
 * because "layoffs" also matched would waste the filter entirely.
 *
 * Only areas some topic can actually reach are listed. An area with no route to
 * it is a set of questions nobody will ever be shown.
 */
const AREA_BY_TOPIC: Array<[TopicBucket, PracticeArea]> = [
  ["self-petition", "EB-2 NIW"],
  ["perm", "PERM"],
  ["student-status", "Student"],
  ["h1b", "H-1B"],
  ["layoffs", "H-1B"],
  ["job-change", "H-1B"]
];

export function practiceAreaFor(topics: readonly TopicBucket[]): PracticeArea {
  for (const [topic, area] of AREA_BY_TOPIC) {
    if (topics.includes(topic)) return area;
  }
  return "Immigration";
}

/**
 * The questions worth thirty minutes of a lawyer's time, by practice area.
 *
 * Each one is a decision the Advisor is not allowed to make and the user cannot
 * look up: it turns on their specific facts. Deliberately not "what are my
 * options" — the point is to arrive with something an attorney can answer quickly
 * rather than spend the consultation establishing the basics.
 */
const QUESTIONS: Record<PracticeArea, string[]> = {
  "H-1B": [
    "Which of my options actually fits my dates, and which one is fastest?",
    "What has to be filed before my grace period ends, and who files it?",
    "Does anything I have already done change what I can still file?"
  ],
  "EB-2 NIW": [
    "Is my endeavour specific enough to survive the national-importance test?",
    "What evidence is missing from what I have now?",
    "Should I file this alongside anything else, or instead of it?"
  ],
  PERM: [
    "Where is my case actually up to, and what is the realistic timeline?",
    "What happens to my PERM if I change jobs or my employer changes?",
    "What can I do now that does not depend on my employer?"
  ],
  Student: [
    "Do my dates still work, and is anything about to lapse?",
    "Which of my options keeps me in status while I sort the rest out?",
    "What should my school be doing, and what should I be doing myself?"
  ],
  Immigration: [
    "Given my dates, what is the deadline I should actually be working to?",
    "What are my realistic options, and which would you rule out?",
    "What do you need from me to give me a straight answer?"
  ]
};

export interface HandoffContext {
  /** ISO date of the user's last day of employment, if Haven holds one. */
  layoffDate?: string | null;
  /** Priority date, for green-card questions where it changes the advice. */
  priorityDate?: string | null;
}

/**
 * What to take to the consultation.
 *
 * Their real dates where Haven has them, because "bring your dates" is useless
 * advice to somebody who does not know which dates matter. Where Haven holds
 * nothing, this asks for the document rather than inventing a date — the same
 * rule that governs every other place the Advisor touches a date.
 */
function whatToBring(context: HandoffContext, today: Date): string[] {
  const items: string[] = [];

  const grace = context.layoffDate ? readGracePeriod(context.layoffDate, today) : null;
  if (grace) {
    items.push(
      `Your last day of employment — Haven has it as ${formatDate(grace.layoffDate)}, which puts the end of the 60-day period around ${formatDate(grace.graceEndDate)}.`
    );
  }
  if (context.priorityDate) {
    items.push(`Your priority date — Haven has it as ${formatDate(context.priorityDate)}.`);
  }

  items.push("Your most recent I-797 approval notices and your current I-94.");
  items.push("Any receipt notices for filings that are still pending.");

  return items;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

/**
 * Whether an answer actually sent somebody to a lawyer.
 *
 * Matched against the finished answer rather than decided up front, because the
 * recommendation can come from a guardrail, from the model, or from both, and a
 * handoff attached to an answer that never mentioned an attorney would read as a
 * non-sequitur — or worse, as Haven pushing paid help unprompted.
 */
const RECOMMENDS_COUNSEL =
  /\b(immigration )?(attorney|lawyer|counsel)\b/i;

/**
 * The disclaimer line, which is not decoration.
 *
 * The directory is built from public listings and is explicitly not a referral or
 * an endorsement; saying so in the handoff keeps the Advisor's version honest
 * even for someone who never opens the page.
 */
const NOT_A_REFERRAL =
  "Haven does not take a fee for any listing and a listing is not a referral — confirm licensing, scope, and fees with the firm directly.";

export interface AttorneyHandoff {
  text: string;
  practiceArea: PracticeArea;
}

/**
 * Build the handoff block, or nothing.
 *
 * Returns null when the answer did not recommend counsel, and when the thread has
 * already delivered one — repeating the same block every turn is how a genuinely
 * useful thing turns into something people scroll past, and the safety lines that
 * sit near it get scrolled past with it.
 */
export function buildAttorneyHandoff(input: {
  topics: readonly TopicBucket[];
  answer: string;
  context: HandoffContext;
  alreadyDelivered: boolean;
  today?: Date;
}): AttorneyHandoff | null {
  if (input.alreadyDelivered) return null;
  if (!RECOMMENDS_COUNSEL.test(input.answer)) return null;

  const practiceArea = practiceAreaFor(input.topics);
  const today = input.today ?? new Date();

  // The directory was parked in the August 2026 simplification, and a link to a
  // parked route lands on "this page isn't part of Haven right now" — a worse
  // dead end than the one this feature exists to remove, and delivered at the
  // moment somebody is most stuck. So the link is conditional on the route being
  // live, read from the archive list rather than from a flag someone has to
  // remember to flip. Everything else in the block works either way: the dates
  // and the questions are useful to a person searching for a lawyer themselves.
  // Un-park /lawyers and the link reappears with no change here.
  const directoryLive = !isArchivedPath("/lawyers");

  const lines = [
    "**Finding one, and getting your money's worth**",
    "",
    directoryLive
      ? `[Browse ${practiceArea === "Immigration" ? "immigration" : practiceArea} firms in Haven's directory](/lawyers?focus=${encodeURIComponent(practiceArea)}) — small and boutique practices, filterable by state and language spoken.`
      : `Look for a small or boutique firm that lists ${practiceArea === "Immigration" ? "employment-based immigration" : practiceArea} work — they are generally faster to answer and cheaper than high-volume shops.`,
    "",
    "Take with you:",
    ...whatToBring(input.context, today).map((item) => `- ${item}`),
    "",
    "Worth asking:",
    ...QUESTIONS[practiceArea].map((question) => `- ${question}`),
    ...(directoryLive ? ["", NOT_A_REFERRAL] : [])
  ];

  return { text: lines.join("\n"), practiceArea };
}

/** Detects a handoff already delivered earlier in the thread. */
export const HANDOFF_DELIVERED = /Finding one, and getting your money'?s worth/i;

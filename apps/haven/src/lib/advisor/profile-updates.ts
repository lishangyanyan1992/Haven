/**
 * Profile changes the user states in chat, written back to their profile.
 *
 * WHY THIS EXISTS
 *
 * A profile is a snapshot the user last edited at some point. When they tell the
 * Advisor something newer — "I was laid off on Friday", "my I-140 was approved" —
 * that correction previously lived only in the conversation. The dashboard, the
 * timeline and every future thread kept showing the stale value, and the next
 * answer was built from it.
 *
 * So a statement made in chat now updates the same record the dashboard writes.
 * One profile, whichever surface the user happened to be in.
 *
 * WHY THE DETECTION IS DELIBERATELY NARROW
 *
 * This is the first thing in the Advisor that *changes stored data* rather than
 * answering a question, and the failure mode is delayed and silent: a misparse
 * does not produce a visibly wrong answer today, it quietly rewrites the basis of
 * every answer from now on. At tier 4 that is worse than missing an update, which
 * the user can always restate.
 *
 * So the bar is high and the coverage is small on purpose:
 *
 *   - Present-tense, first-person statements only. Never a question, never a
 *     hypothetical ("if I get laid off"), never someone else's situation.
 *   - Conflicting signals in one message write nothing. "I was laid off in March
 *     but I started somewhere new in June" contains both, and guessing which one
 *     is current is exactly the guess this must not make.
 *   - Only fields where the statement maps to one value without interpretation.
 *     Dates, categories and employer details are left to the profile form.
 *   - Every write is announced to the user in the same reply, naming the field,
 *     the new value and the sentence that caused it. An update the user cannot
 *     see is an update they cannot correct.
 */

import type { EmploymentStatus, PermStage } from "@/types/domain";

export type ProfileUpdate =
  | { field: "employmentStatus"; value: EmploymentStatus; quote: string; label: string }
  /**
   * The last day of employment, which starts the 60-day clock.
   *
   * Held apart from the other fields because it does not live on the profile — it
   * is written to `layoff_events`, the same record the Layoff War Room creates,
   * so the Advisor and the countdown on the dashboard cannot disagree.
   *
   * It is also the highest-consequence write in this file by a distance. Every
   * other field is a category the user can eyeball; this one is arithmetic that
   * produces a deadline somebody acts on, and being two days out in the wrong
   * direction is worse than having no date at all. Hence the parsing rules below.
   */
  | { field: "layoffDate"; value: string; quote: string; label: string }
  | { field: "i140Approved"; value: true; quote: string; label: string }
  | { field: "i485Filed"; value: true; quote: string; label: string }
  | { field: "permStage"; value: PermStage; quote: string; label: string };

/** Asking, not telling. */
const QUESTION_LIKE = /^(what|when|how|why|can|could|should|would|do|does|did|is|are|will|if)\b|\?\s*$/i;

/** Hypothetical or someone else's situation. */
const NOT_ABOUT_NOW =
  /\b(if i|what if|in case|suppose|hypothetical|my (friend|colleague|spouse|wife|husband|brother|sister)|a friend)\b/i;

/**
 * Job loss stated as a current fact.
 *
 * Narrower than JOB_LOSS_TERMS in service.ts, and that difference is deliberate.
 * That list is tuned to over-trigger, because an unnecessary safety warning is
 * cheap. This one writes to the database, where over-triggering is not cheap, so
 * it takes only the plainest first-person constructions.
 */
const LAID_OFF =
  /\bi (was|got|have been|'ve been) (laid off|made redundant|terminated|let go|fired)\b|\bi (was|got) riffed\b|\bmy (job|position|role) (was|has been) (eliminated|cut|made redundant)\b/i;

/** A new job, which is what makes a laid-off status stale in the other direction. */
const NEW_JOB =
  /\bi (started|start|have started|'ve started|joined|am joining)\b[^.?!]{0,24}\b(job|role|company|employer|position)\b|\bi (found|got|accepted)\b[^.?!]{0,16}\b(job|offer|role|position)\b|\bmy new employer (filed|started)\b/i;

/**
 * A date the user stated plainly enough to act on.
 *
 * Only three shapes are accepted, and the omissions matter more than the
 * inclusions:
 *
 *   "August 3" / "Aug 3, 2026"   month by name, unambiguous in any locale
 *   "8/3/2026"                   numeric, but only with a four-digit year, because
 *                                8/3 is August 3rd to an American and March 8th to
 *                                almost everybody else — and this product's users
 *                                are overwhelmingly not American
 *   "today" / "yesterday"        exact, relative to a date we hold
 *
 * Weekday names are deliberately rejected. "Last Friday" and "on Friday" are how
 * people actually speak, and they are precisely the phrasings where a reasonable
 * reading can be seven days out. A clock that starts a week late is the specific
 * harm this whole feature exists to prevent, so an unparsed date is the right
 * outcome: the answer asks for it instead.
 *
 * A bare year-less month/day is read as the most recent occurrence, never a future
 * one — somebody in August saying "laid off on November 2nd" means last November.
 */
const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11
};

const MONTH_NAME_DATE = new RegExp(
  `\\b(${Object.keys(MONTHS).join("|")})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`,
  "i"
);
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const TODAY_WORD = /\btoday\b/i;
const YESTERDAY_WORD = /\byesterday\b/i;

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function extractStatedDate(sentence: string, today: Date = new Date()): string | null {
  const now = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (YESTERDAY_WORD.test(sentence)) return isoOf(new Date(now.getTime() - 86_400_000));
  if (TODAY_WORD.test(sentence)) return isoOf(now);

  const numeric = NUMERIC_DATE.exec(sentence);
  if (numeric) {
    const [, month, day, year] = numeric;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsed.getUTCMonth() !== Number(month) - 1) return null;
    return parsed.getTime() > now.getTime() ? null : isoOf(parsed);
  }

  const named = MONTH_NAME_DATE.exec(sentence);
  if (named) {
    const [, monthWord, dayText, yearText] = named;
    const month = MONTHS[monthWord.toLowerCase()];
    const day = Number(dayText);
    const year = yearText ? Number(yearText) : now.getUTCFullYear();
    const parsed = new Date(Date.UTC(year, month, day));
    // A day number the month does not have — "February 31" — rolls over silently
    // in the Date constructor and would produce a real-looking wrong date.
    if (parsed.getUTCMonth() !== month) return null;
    if (parsed.getTime() > now.getTime()) {
      if (yearText) return null;
      const lastYear = new Date(Date.UTC(year - 1, month, day));
      return isoOf(lastYear);
    }
    return isoOf(parsed);
  }

  return null;
}

const I140_APPROVED = /\bmy i-?140 (was|got|has been|is) approved\b|\bi-?140 approval\b(?!.*\bdenied\b)/i;
const I485_FILED = /\b(i|we|my (attorney|lawyer|employer)) filed (my|our|the) i-?485\b|\bmy i-?485 (was|has been) filed\b/i;
const PERM_CERTIFIED = /\bmy perm (was|got|has been|is) (certified|approved)\b/i;
const PERM_FILED = /\b(my (employer|attorney|lawyer)|we|i) filed (my|our|the) perm\b|\bmy perm (was|has been) filed\b/i;

/**
 * Read one user message for profile changes.
 *
 * Sentence by sentence, so a quote shown back to the user is the statement that
 * caused the change rather than a paragraph containing it.
 */
export function detectProfileUpdates(message: string, today: Date = new Date()): ProfileUpdate[] {
  const sentences = message
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !QUESTION_LIKE.test(sentence) && !NOT_ABOUT_NOW.test(sentence));

  const updates: ProfileUpdate[] = [];
  let sawLaidOff: string | null = null;
  let sawNewJob: string | null = null;

  for (const sentence of sentences) {
    if (LAID_OFF.test(sentence)) sawLaidOff ??= sentence;
    if (NEW_JOB.test(sentence)) sawNewJob ??= sentence;

    if (I140_APPROVED.test(sentence)) {
      updates.push({ field: "i140Approved", value: true, quote: sentence, label: "I-140 approved: yes" });
    }
    if (I485_FILED.test(sentence)) {
      updates.push({ field: "i485Filed", value: true, quote: sentence, label: "I-485 filed: yes" });
    }
    if (PERM_CERTIFIED.test(sentence)) {
      updates.push({ field: "permStage", value: "certified", quote: sentence, label: "PERM stage: certified" });
    } else if (PERM_FILED.test(sentence)) {
      updates.push({ field: "permStage", value: "in_progress", quote: sentence, label: "PERM stage: in progress" });
    }
  }

  // Employment status last, and only when the message points one way. Both
  // signals in one message is the case where guessing is worst: "I was laid off
  // in March but I started somewhere new in June" is a common way to give
  // background, and writing `laid_off` from it would be wrong for months.
  if (sawLaidOff && !sawNewJob) {
    updates.push({
      field: "employmentStatus",
      value: "laid_off",
      quote: sawLaidOff,
      label: "Employment status: laid off"
    });

    // Only from the sentence that states the job loss. Scanning the whole message
    // would pick up a date belonging to something else entirely — "I was laid off.
    // My I-140 was approved March 3" would start the clock in March.
    const layoffDate = extractStatedDate(sawLaidOff, today);
    if (layoffDate) {
      updates.push({
        field: "layoffDate",
        value: layoffDate,
        quote: sawLaidOff,
        label: `Last day of employment: ${layoffDate}`
      });
    }
  } else if (sawNewJob && !sawLaidOff) {
    updates.push({
      field: "employmentStatus",
      value: "employed",
      quote: sawNewJob,
      label: "Employment status: employed"
    });
  }

  // Deduplicate by field, keeping the first. A message that says the same thing
  // twice should not produce two lines in the announcement.
  const seen = new Set<string>();
  return updates.filter((update) => {
    if (seen.has(update.field)) return false;
    seen.add(update.field);
    return true;
  });
}

/**
 * Drop updates that match what the profile already holds.
 *
 * Someone restating a fact we already have should not be told their profile was
 * updated — that is noise, and it makes the real announcements easier to ignore.
 */
export function filterAlreadyCurrent(
  updates: ProfileUpdate[],
  profile: { employmentStatus?: string; i140Approved?: boolean; i485Filed?: boolean; permStage?: string },
  // The open layoff on record, if any. Separate argument because it comes from a
  // different table than the profile and a caller can genuinely not have it.
  activeLayoffDate?: string | null
): ProfileUpdate[] {
  return updates.filter((update) => {
    if (update.field === "layoffDate") return activeLayoffDate !== update.value;
    if (update.field === "employmentStatus") return profile.employmentStatus !== update.value;
    if (update.field === "i140Approved") return profile.i140Approved !== true;
    if (update.field === "i485Filed") return profile.i485Filed !== true;
    if (update.field === "permStage") return profile.permStage !== update.value;
    return true;
  });
}

/**
 * What the user is told, appended to the answer.
 *
 * Deterministic rather than generated. The model could describe the change in its
 * own words and sometimes get it wrong, and a wrong description of a database
 * write is worse than no description — the user would correct the wrong thing.
 */
export function renderProfileUpdateNotice(updates: ProfileUpdate[]): string {
  if (updates.length === 0) return "";

  const startedClock = updates.some((update) => update.field === "layoffDate");

  return [
    "",
    "---",
    "",
    "**I updated your Haven profile:**",
    "",
    ...updates.map((update) => `- ${update.label} — from what you said: "${update.quote}"`),
    "",
    // Naming the consequence, not just the write. Recording a last day of
    // employment starts a 60-day countdown across the product, and somebody who
    // mistyped a date needs to know that before the countdown is what they plan
    // around.
    startedClock
      ? "Your 60-day timeline now runs from that date across Haven — your dashboard, your timeline, and my answers. If the date is wrong, tell me the right one or change it in your profile, and everything recalculates."
      : "This now shows everywhere in Haven, including your dashboard and timeline. If I got it wrong, change it in your profile and I will use that instead."
  ].join("\n");
}

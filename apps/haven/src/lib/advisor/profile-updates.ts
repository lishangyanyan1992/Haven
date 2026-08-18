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
export function detectProfileUpdates(message: string): ProfileUpdate[] {
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
  profile: { employmentStatus?: string; i140Approved?: boolean; i485Filed?: boolean; permStage?: string }
): ProfileUpdate[] {
  return updates.filter((update) => {
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

  return [
    "",
    "---",
    "",
    updates.length === 1 ? "**I updated your Haven profile:**" : "**I updated your Haven profile:**",
    "",
    ...updates.map((update) => `- ${update.label} — from what you said: "${update.quote}"`),
    "",
    "This now shows everywhere in Haven, including your dashboard and timeline. If I got it wrong, change it in your profile and I will use that instead."
  ].join("\n");
}

/**
 * What the user has already tried, and what came of it.
 *
 * The failure this exists to stop, borrowed from an audit of an unrelated support
 * bot: a user says the app crashes, the bot says reinstall it, the user says
 * "already did, still crashing", and the bot says reinstall it again. The
 * conversation is over at that point — not because the bot was wrong, but because
 * it did not hear.
 *
 * Haven's version is worse than annoying, because the obvious next step in an
 * employment-visa question is usually a person: your employer, your DSO, your
 * company's attorney. Telling someone to ask their employer to file a transfer
 * when they have just said the company is shutting down and nobody is answering
 * email reads as not listening, on the day they are least able to absorb it. And
 * they are already paying to be here; the dead end is the product's whole risk.
 *
 * Three design rules, two of them inherited from `memory.ts` for the same reasons:
 *
 * 1. **Keep the user's sentence, never a parse.** "My employer refused" is stored
 *    as those words. Reducing it to a code like `employer_refused` would need a
 *    taxonomy of every step Haven might suggest, and the first suggestion outside
 *    that taxonomy would be repeated with full confidence. The sentence, handed to
 *    the model, covers steps nobody enumerated.
 *
 * 2. **Thread-scoped, derived from history.** No storage and no schema change: the
 *    request already carries every turn. It also means an attempt does not follow
 *    someone into next month's conversation, when their employer may well answer.
 *    A durable version of this belongs in `memory.ts`, deliberately not here.
 *
 * 3. **Never block an answer.** This only ever adds a line to the prompt. A missed
 *    attempt costs a repeated suggestion, which the user can correct. Anything
 *    that could withhold or delay an answer would cost more than the bug.
 *
 * Deliberately pattern-based, like fact extraction: free, instant, and incapable of
 * inventing an attempt the user never described — which a summarising model call
 * can do, and which would then suppress the one suggestion that would have worked.
 */

import type { HistoryTurn } from "@/lib/advisor/thread-state";

/**
 * How an attempt ended, which is what decides whether repeating it is stupid.
 *
 * - `blocked` — someone else said no, or cannot help. Repeating the suggestion is
 *   the worst case: it hands the user back the door they just told you was locked.
 * - `tried` — they did it and it did not resolve things. Repeating it is wasted
 *   breath but not insulting.
 * - `underway` — done and waiting on somebody else. Repeating it reads as though
 *   the Advisor thinks they have not started.
 */
export type AttemptOutcome = "blocked" | "tried" | "underway";

export interface AttemptedStep {
  outcome: AttemptOutcome;
  /** The user's own sentence, verbatim. */
  quote: string;
}

/** Attempts carried into one prompt. Bounds cost and keeps the block readable. */
const MAX_ATTEMPTS_IN_PROMPT = 6;

/** Longer than this is a paragraph, not a statement about one step. */
const MAX_QUOTE_LENGTH = 240;

/**
 * The patterns, ordered most-specific first because the first match wins.
 *
 * Every one of these is a real phrasing from the community corpus or from the
 * layoff personas, not a guess at how people might write. The bar for adding one
 * is that the sentence, if missed, would let the Advisor repeat a step the user
 * has ruled out.
 */
const ATTEMPT_PATTERNS: Array<{ outcome: AttemptOutcome; pattern: RegExp }> = [
  {
    // Someone else closed the door. The highest-value signal here: almost every
    // suggestion Haven makes routes through an employer, a DSO, or an attorney.
    outcome: "blocked",
    pattern:
      /\b((my |the )?(employer|company|manager|hr|attorney|lawyer|dso|school|university|sponsor|recruiter)\b.{0,40}\b(refused|declined|said no|won'?t|will not|can'?t|cannot|is not willing|isn'?t willing|not willing|denied|rejected|stopped responding|never (replied|responded|got back)|has not (replied|responded)|hasn'?t (replied|responded)|no longer|doesn'?t (know|handle)|does not (know|handle)|is (gone|shut|shutting|closing))|they (refused|declined|said no|won'?t|will not|are not willing|aren'?t willing|never (replied|responded|got back)|stopped responding))\b/i
  },
  {
    // Explicitly done and explicitly unresolved.
    outcome: "tried",
    pattern:
      /\b(i (already |have already |'?ve already )?(tried|did|called|emailed|asked|contacted|spoke to|spoken to|talked to|reached out to|submitted|applied|filed|checked|looked)\b.{0,60}\b(but|and)\b.{0,40}\b(nothing|no (luck|response|reply|answer)|didn'?t (work|help)|did not (work|help)|still|no one|nobody|same (problem|issue|error))|\b(that|this|it) (didn'?t|did not) (work|help)|\bno luck\b|\bstill (nothing|no response|no reply|waiting|stuck))/i
  },
  {
    // Done, outcome not yet known. Suggesting it again implies they have not moved.
    outcome: "underway",
    pattern:
      /\b(i (have |'?ve )?(already )?(filed|submitted|applied|sent|started|begun)\b|\b(my|our) (attorney|lawyer|employer|company|hr)\b.{0,30}\b(already )?(filed|submitted|sent)\b|\bit'?s (already )?(pending|filed|submitted|in process)\b|\bi'?m (already )?(waiting|in the process)\b|\bi have been (applying|interviewing|looking|searching)\b|\bi'?ve been (applying|interviewing|looking|searching)\b)/i
  },
  {
    // The bare form, last because it carries no outcome on its own. The sentence it
    // captures usually does.
    outcome: "tried",
    pattern: /\b(i (already|'?ve) (tried|done|asked|called|emailed|contacted|checked)|already tried that|tried that (already|before))\b/i
  }
];

/**
 * Sentences that look like an attempt but are the user asking about one.
 *
 * "Should I ask my employer?" states nothing, and recording it would suppress the
 * exact suggestion they were asking for. Same guard, same reason, as `memory.ts`.
 */
const QUESTION_LIKE = /^(what|when|how|why|can|could|should|would|do|does|did|is|are|will|if|any)\b|\?\s*$/i;

/**
 * Sentences describing somebody else's attempt.
 *
 * "My friend tried that and it failed" is not a step this user has ruled out, and
 * treating it as one would withhold a live option on hearsay.
 */
const SOMEONE_ELSE =
  /\b(my (friend|colleague|coworker|co-worker|classmate|roommate|cousin|brother|sister)|a friend|someone (i know|else)|my (wife|husband|spouse|partner)'?s (employer|company))\b/i;

/** Pull attempted steps out of one message. */
export function extractAttempts(message: string): AttemptedStep[] {
  const sentences = message
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && sentence.length <= MAX_QUOTE_LENGTH);

  const found: AttemptedStep[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (QUESTION_LIKE.test(sentence)) continue;
    if (SOMEONE_ELSE.test(sentence)) continue;

    for (const { outcome, pattern } of ATTEMPT_PATTERNS) {
      if (!pattern.test(sentence)) continue;
      const key = sentence.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      found.push({ outcome, quote: sentence });
      break;
    }
  }

  return found;
}

/**
 * Every attempt stated anywhere in this thread, oldest first.
 *
 * The whole thread, not just the current message, because the repetition this
 * guards against happens across turns: the user says "already tried that" on turn
 * three and the Advisor suggests it again on turn five, by which point the message
 * that ruled it out has scrolled out of the model's attention.
 *
 * Oldest first, and the cap trims the newest rather than the oldest, because the
 * first thing somebody rules out is usually the most obvious suggestion — the one
 * most likely to be repeated.
 */
export function collectAttempts(current: string, history: readonly HistoryTurn[]): AttemptedStep[] {
  const userText = [...history.filter((turn) => turn.role === "user").map((turn) => turn.content), current];

  const all: AttemptedStep[] = [];
  const seen = new Set<string>();

  for (const text of userText) {
    for (const attempt of extractAttempts(text)) {
      const key = attempt.quote.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(attempt);
    }
  }

  return all.slice(0, MAX_ATTEMPTS_IN_PROMPT);
}

const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  blocked: "Ruled out — somebody else refused, or cannot help",
  tried: "Already tried, and it did not resolve things",
  underway: "Already done, waiting on the outcome"
};

/**
 * Render attempts for the prompt.
 *
 * The instruction matters as much as the list. "Do not repeat these" on its own
 * produces an answer that silently drops the obvious step and looks evasive — the
 * user cannot tell whether the Advisor heard them or simply had nothing. Naming
 * the step and saying it is closed is what makes the answer read as listening, and
 * it is also more honest: sometimes the closed door is genuinely the only door,
 * and the useful answer is what to do about that rather than a cheerful
 * suggestion to knock again.
 */
export function renderAttemptsForPrompt(attempts: readonly AttemptedStep[]): string[] {
  if (attempts.length === 0) return [];

  const lines = attempts.map((attempt) => `${OUTCOME_LABEL[attempt.outcome]} — the user said: "${attempt.quote}"`);

  return [
    ...lines,
    "Open your answer by acknowledging what is closed, in one short sentence of your own words — fitted to what they actually said rather than a stock phrase — the point is that they can tell you read it. Never quote their sentence back at them: repeating their own words verbatim reads like a glitch, not like listening. Skipping this altogether is the more common failure — it produces a reply that quietly routes around the closed door, which is correct and still reads as though nobody heard them.",
    "Then: do not offer any of these back as a fresh suggestion. If one of them is genuinely still the right move, say they already tried it and say what would be different this time — never present it as a new idea.",
    "If everything you would normally suggest is on this list, say so plainly rather than repeating one or padding the answer. Then give them the next thing down: who else can act, what they can do without the person who refused, and what deadline is still running while this is stuck."
  ];
}

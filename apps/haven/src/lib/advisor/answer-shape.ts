/**
 * Splitting an answer into the part everyone reads and the part most people
 * should not have to.
 *
 * Sixteen instructions in the system prompt ask for a short answer. Measured
 * across four runs of one question, the model wrote 557, 594, 761 and 577 words.
 * Removing six mandatory statements from the prompt moved nothing — the
 * before-figure was 540, and run-to-run variance on a single question is wider
 * than any effect claimed for a prompt edit. Length is not a prompt problem here,
 * and a seventeenth rule would have been the fourth time of learning that.
 *
 * The other two options were a token cap, which truncates mid-sentence and in
 * this product could cut a safety line in half, and a second compression pass,
 * which doubles the wait on an answer that already takes about twenty seconds.
 * Both make the answer worse to fix its shape.
 *
 * So the length stops being hidden and starts being managed: lead with the
 * direct answer, put the working underneath, and let the person open it. Nothing
 * is deleted — everything the model wrote is still on the page, and every source
 * and caveat is still there for anyone who wants it.
 *
 * ONE RULE ABOVE ALL OTHERS: SAFETY TEXT IS NEVER COLLAPSED.
 *
 * The guardrail addenda, the attorney handoff and the stale-bulletin notice are
 * appended after generation, and they are the sentences most likely to change what
 * somebody does. Hiding one behind a toggle would be strictly worse than the long
 * answer this replaces — a wall of text at least contains the warning. So the
 * split only ever runs over the model's own prose, and it is bounded at the first
 * appended block.
 */

/**
 * The marker the model is asked to emit between its direct answer and the rest.
 *
 * An HTML comment on purpose: if anything downstream fails to split, react-markdown
 * does not render embedded HTML, so a missed marker disappears from the page
 * instead of showing the reader a piece of machinery. The failure mode is "the
 * answer looks like it did last week", which is the right one to have.
 */
export const DETAIL_MARKER = "<!--details-->";

/**
 * The labels every appended safety block opens with.
 *
 * Exported and imported by `service.ts` rather than written out in both places.
 * The first version of this file matched them with a regex guessed from memory —
 * `[A-Z][a-z-]+ (?:safety )?note:` — which silently failed on "H-1B safety note"
 * and "Work authorization note", i.e. on two of the six, i.e. on the two most
 * common. The check caught it, and the lesson is the one this codebase keeps
 * relearning: a fact written down twice is a fact that will disagree with itself.
 *
 * Adding a note here is what makes it stay visible. Anything not listed will be
 * treated as the model's prose and can end up behind the toggle.
 */
export const APPENDED_BLOCK_LABELS = [
  "H-1B safety note:",
  "Work authorization note:",
  "CPT safety note:",
  "I-485 travel safety note:",
  "NIW strategy note:",
  "CSPA safety note:"
] as const;

const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where the appended blocks begin.
 *
 * Everything from the first of these onward is ours, not the model's, and stays
 * visible whatever else happens.
 */
const APPENDED_BLOCK = new RegExp(
  [
    // The attorney handoff.
    String.raw`\n\n\*\*Finding one, and getting your money's worth\*\*`,
    // The profile-update notice.
    String.raw`\n\n\*\*Haven updated`,
    ...APPENDED_BLOCK_LABELS.map((label) => String.raw`\n\n` + escapeForRegExp(label))
  ].join("|")
);

export interface SplitAnswer {
  /** The part shown immediately. Never empty when there is any answer at all. */
  lead: string;
  /** The model's working, shown behind a toggle. Empty when there is nothing to hide. */
  details: string;
  /** Appended safety text and handoffs. Always shown, never collapsed. */
  appended: string;
}

/**
 * Below this, there is nothing worth collapsing.
 *
 * A 90-word answer with a "show more" under it is worse than a 90-word answer:
 * it adds a decision to something already short enough to read.
 */
const MIN_WORDS_TO_SPLIT = 120;

/** The most the lead may be before it stops being a lead. */
const MAX_LEAD_WORDS = 110;

/**
 * The least a lead may be and still count as an answer.
 *
 * Low on purpose. "Your grace period ends on September 6, 2026. File something
 * before then or plan to depart." is sixteen words and is a complete answer — a
 * higher floor would refuse to split exactly the answers that got the shape right.
 * What stops a premature split is the preamble check, not this number: the failure
 * being guarded against is splitting after "here is what I am relying on", and
 * that is caught by what the block says rather than by how long it is.
 */
const MIN_LEAD_WORDS = 12;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Openings that are scaffolding rather than answer.
 *
 * Two blocks reliably arrive before the answer does: the stale-bulletin notice,
 * which we prepend, and the "here is what I am relying on" line, which the
 * situation check asks for. Both belong in the lead — the second is the whole
 * point of the confirm-before-advising rule — but neither may *be* the lead.
 *
 * Measured before this existed: all three test answers split at the first
 * paragraph break, so the reader saw "Relying on what you have on file: your last
 * day of employment is 2026-07-08" and had to open a toggle to find out how long a
 * transfer takes. That is worse than the wall of text it replaced.
 */
const PREAMBLE =
  /^\s*(?:\*\*)?(?:note on bulletin data|i'?m relying on|i am relying on|relying on|based on (?:what|your)|according to your|using the details)/i;

/**
 * Find where the direct answer ends, when the model did not say.
 *
 * Walks paragraph blocks rather than lines, so a preamble block can be carried
 * into the lead without being mistaken for it. A boundary is only offered once
 * enough *non-preamble* words have accumulated to count as an answer.
 *
 * Prefers a real structural boundary — the first markdown heading, or a bold line
 * acting as one — because the model reliably produces sections even while ignoring
 * every instruction about length. Falls back to a paragraph break.
 *
 * Returns -1 when no boundary produces a sensible lead, and the caller leaves the
 * answer whole. Guessing a split point badly is worse than not splitting: it hides
 * half a sentence somebody is about to act on.
 */
function findBoundary(text: string): number {
  const lines = text.split("\n");
  let offset = 0;
  let substantive = 0;
  let blockStart = 0;
  let blockIsPreamble = false;
  let atBlockStart = true;
  let firstParagraphBreak = -1;

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;

    if (!line.trim()) {
      // End of a block. Only a block that carried real content can be followed by
      // a split, and only once there is enough of it to stand as an answer.
      if (!atBlockStart && !blockIsPreamble && substantive >= MIN_LEAD_WORDS && firstParagraphBreak === -1) {
        firstParagraphBreak = lineStart;
      }
      atBlockStart = true;
      continue;
    }

    if (atBlockStart) {
      blockStart = lineStart;
      blockIsPreamble = PREAMBLE.test(line);
      atBlockStart = false;
    }

    const isHeading = /^\s*#{1,6}\s+\S/.test(line);
    const isBoldHeading = /^\s*\*\*[^*]{3,60}\*\*\s*$/.test(line);
    if ((isHeading || isBoldHeading) && substantive >= MIN_LEAD_WORDS) return blockStart;

    if (!blockIsPreamble) substantive += countWords(line);

    // Past this, the lead has stopped being a lead. Take the best break found.
    if (substantive > MAX_LEAD_WORDS) break;
  }

  return firstParagraphBreak;
}

/**
 * Split a finished answer into lead, details and appended safety text.
 *
 * Deliberately tolerant. Every branch that cannot find a confident split returns
 * the whole answer as the lead, which renders exactly as it does today.
 */
export function splitAnswer(answer: string): SplitAnswer {
  const appendedAt = answer.search(APPENDED_BLOCK);
  const body = appendedAt === -1 ? answer : answer.slice(0, appendedAt);
  const appended = appendedAt === -1 ? "" : answer.slice(appendedAt).trim();

  const whole = (): SplitAnswer => ({ lead: body.trim(), details: "", appended });

  // The stale-bulletin notice is prepended before the model writes a word, and it
  // is the fact that decides whether any of the rest is safe to act on. It belongs
  // in the lead whatever else happens.
  const markerAt = body.indexOf(DETAIL_MARKER);
  if (markerAt !== -1) {
    const lead = body.slice(0, markerAt).trim();
    const details = body.slice(markerAt + DETAIL_MARKER.length).trim();
    // A model that emits the marker immediately, or at the very end, has told us
    // nothing useful.
    if (countWords(lead) >= 15 && countWords(details) >= 30) {
      return { lead, details, appended };
    }
    // Marker present but useless — strip it so it never reaches the page.
    return { lead: body.replace(DETAIL_MARKER, "").trim(), details: "", appended };
  }

  if (countWords(body) < MIN_WORDS_TO_SPLIT) return whole();

  const boundary = findBoundary(body);
  if (boundary <= 0) return whole();

  const lead = body.slice(0, boundary).trim();
  const details = body.slice(boundary).trim();
  if (countWords(lead) < MIN_LEAD_WORDS || countWords(details) < 30) return whole();

  return { lead, details, appended };
}

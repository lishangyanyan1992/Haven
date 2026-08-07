/**
 * Per-thread conversational state, derived from the history the client already
 * sends. No schema change, no new storage — the request carries everything needed.
 *
 * Two things live here:
 *
 * - **Consecutive classification misses (CD-13.2).** The Advisor used to answer an
 *   unrecognised question by assuming `["h1b", "adjustment-of-status"]` and
 *   answering with full confidence, forever, with no record that it had happened.
 *   Counting the misses lets the second one change tack instead of repeating the
 *   guess.
 * - **Already-delivered guardrails (CD-13.4).** Guardrail selection was stateless,
 *   so the same option menu and the same warnings were re-injected on every turn of
 *   a thread and the model dutifully restated them. Knowing what the thread has
 *   already heard lets orientation fire once while hard safety lines keep firing.
 */

import { allGuardrails, type GuardrailEntry } from "@/lib/advisor/guardrail-registry";

export type TurnResolution =
  /** The current message matched at least one topic pattern. */
  | "matched"
  /** Nothing matched now, but the previous user turn did — a follow-up. */
  | "carried"
  /** Nothing matched now or in the previous turn. Previously silent. */
  | "unmatched";

export interface ThreadState {
  resolution: TurnResolution;
  /**
   * How many user turns in a row have resolved to `unmatched`, including this one.
   * 1 = ask a clarifying question. 2+ = stop guessing and hand off.
   */
  consecutiveMisses: number;
  /** Guardrail ids this thread has already delivered. */
  delivered: Set<string>;
}

export type HistoryTurn = { role: "user" | "assistant"; content: string };

/**
 * Detect whether an entry has already been delivered in an earlier answer.
 *
 * `deliveredWhen` wins when present. Otherwise the entry's own text is matched
 * literally, which is correct for `audience: "user"` entries because those are
 * appended to the answer exactly as written.
 */
function wasDelivered(entry: GuardrailEntry, assistantText: string): boolean {
  if (entry.deliveredWhen) {
    return entry.deliveredWhen.test(assistantText);
  }
  return assistantText.includes(entry.text.trim());
}

export function deliveredGuardrailIds(history: readonly HistoryTurn[]): Set<string> {
  const assistantText = history
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n\n");

  const delivered = new Set<string>();
  if (!assistantText) return delivered;

  for (const entry of allGuardrails()) {
    // Only `once-per-thread` entries can be suppressed, so only they need checking.
    if (entry.repeat !== "once-per-thread") continue;
    if (wasDelivered(entry, assistantText)) {
      delivered.add(entry.id);
    }
  }

  return delivered;
}

/**
 * Count how many user turns in a row failed to classify, ending with this one.
 *
 * Walks backwards through the user turns and stops at the first that matched. The
 * count includes the current message, so a first miss returns 1.
 */
export function countConsecutiveMisses(
  currentMatched: boolean,
  history: readonly HistoryTurn[],
  matches: (text: string) => boolean
): number {
  if (currentMatched) return 0;

  let misses = 1;
  const userTurns = history.filter((turn) => turn.role === "user");

  for (let i = userTurns.length - 1; i >= 0; i -= 1) {
    if (matches(userTurns[i].content)) break;
    misses += 1;
  }

  return misses;
}

export function buildThreadState(input: {
  currentMatched: boolean;
  previousMatched: boolean;
  history: readonly HistoryTurn[];
  matches: (text: string) => boolean;
}): ThreadState {
  const resolution: TurnResolution = input.currentMatched
    ? "matched"
    : input.previousMatched
      ? "carried"
      : "unmatched";

  return {
    resolution,
    // A carried follow-up is not a miss: the thread is understood even though this
    // particular sentence matched nothing. Only a turn with no context at all counts.
    consecutiveMisses:
      resolution === "unmatched" ? countConsecutiveMisses(input.currentMatched, input.history, input.matches) : 0,
    delivered: deliveredGuardrailIds(input.history)
  };
}

/**
 * Did the last answer actually help?
 *
 * Haven could report, at any moment, how many answers passed their safety checks
 * and how many carried a citation. It could not report whether a single person got
 * what they came for. There is a thumbs control wired to Langfuse, but a thumbs is
 * clicked by roughly nobody, and the nobodies who do click are the delighted and
 * the furious — the two groups least representative of everyone else.
 *
 * The signal that covers every conversation is already there and free: **the next
 * thing the user types.** Somebody who got an answer asks a different question.
 * Somebody who did not asks the same one again in different words, or says the
 * Advisor missed the point, or corrects a fact it got wrong. That is a read on
 * every conversation rather than on the 2% who reach for a button, and it costs
 * the user nothing.
 *
 * The rule this file exists to honour, learned the hard way twice in this project:
 * **ask for observations, decide in code.** So there is no model call here. A
 * model asked "did that answer help?" gives a different verdict on the same pair
 * of messages run twice, and an outcome metric that moves when nothing changed is
 * worse than no metric — people act on it.
 *
 * Two things it deliberately does not attempt:
 *
 * - **Labelling silence.** Somebody who reads an answer and closes the tab may be
 *   satisfied or may have given up, and nothing in the data separates those.
 *   Guessing would put a number on it that feels like knowledge. What *is* worth
 *   recording is what the silence followed — see `SILENCE_AFTER` below — because
 *   silence after a clarifying question is a different event from silence after a
 *   real answer, and only one of them is ambiguous.
 * - **Correctness.** This measures whether the answer landed, not whether it was
 *   right. A confidently wrong answer that satisfies the user scores well here and
 *   is the worst outcome in the product. The guardrail suites are what guard that;
 *   this is a different question and must not be read as the same one.
 */

/** What the user's next message says about the answer before it. */
export type AnswerOutcome =
  /** They said it missed, plainly. The clearest negative there is. */
  | "pushed-back"
  /** They asked the same thing again in other words. The answer did not land. */
  | "restated"
  /** They corrected a fact the answer was built on. It was answering the wrong person. */
  | "corrected"
  /** They said thanks, or that it helped. */
  | "closed"
  /** They moved on to something new. The answer did its job. */
  | "followed-on";

export interface OutcomeRead {
  outcome: AnswerOutcome;
  /**
   * Whether the answer landed. The one number worth aggregating.
   *
   * `corrected` counts as not landing even though the user is being helpful: the
   * answer they received was built on a wrong premise, so it was not an answer to
   * their situation. Counting it as a success would hide the profile and memory
   * defects that produce it, which are the ones worth finding.
   */
  landed: boolean;
  /** Why this call was made, for reading one conversation back later. */
  evidence: string;
}

/**
 * Said outright that the answer missed.
 *
 * Kept narrow and literal. This is the bucket that should be trusted without
 * qualification, so anything ambiguous belongs in one of the inferred buckets
 * rather than here.
 */
const PUSHED_BACK =
  /\b(that'?s not what i (asked|meant)|you (didn'?t|did not) answer|not what i('?m| am) asking|that doesn'?t (answer|help)|this doesn'?t (answer|help)|you'?re not (understanding|getting)|i already (told|said)|you keep (saying|repeating)|read my question|useless|not helpful)\b/i;

/**
 * Corrected a fact the answer stood on.
 *
 * Distinct from pushing back: the user is being helpful, and the answer was
 * probably fine for the person the Advisor thought it was talking to. It still
 * did not answer *them*, and the profile or memory defect behind it is worth
 * surfacing — which counting it as a success would prevent.
 */
const CORRECTED =
  /\b(no,? i'?m (not|on)\b|actually,? (i|my)\b|that'?s (wrong|incorrect|not right)|my (date|last day|status|visa) is (actually )?\b|i'?m not on\b|correction[:,]|to correct)\b/i;

/** Said it helped. */
const CLOSED =
  /\b(thanks|thank you|thx|got it|that (helps|helped|makes sense|answers it)|perfect|great,? that|appreciate (it|that)|exactly what i needed|clear now)\b/i;

/**
 * Words carrying no topic, removed before comparing two questions.
 *
 * Without this, "what should I do about my H-1B" and "what should I do about my
 * PERM" overlap on six of eight words and read as the same question. The list is
 * grammar and question scaffolding only — nothing that names a visa, a form, a
 * date, or an action, because those are exactly what distinguishes two questions.
 */
const STOPWORDS = new Set([
  "a","about","after","again","all","am","an","and","any","are","as","at","be","been","before","being","but","by",
  "can","could","did","do","does","doing","for","from","get","got","had","has","have","how","i","if","in","into",
  "is","it","its","just","me","my","need","no","not","now","of","on","or","our","out","should","so","some","still",
  "than","that","the","their","them","then","there","these","they","this","to","up","was","we","were","what","when",
  "where","which","while","who","why","will","with","would","you","your"
]);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOPWORDS.has(word))
  );
}

/**
 * How much of the earlier question the new one repeats.
 *
 * Asymmetric on purpose — the share of the *old* question's words that reappear,
 * not Jaccard. "What are my options?" followed by "What are my options if my
 * employer won't file?" is the same question with a detail added, and Jaccard
 * would score it low precisely because the new message is longer. That case is
 * the one this most needs to catch.
 */
function repeatRatio(previous: string, next: string): number {
  const before = contentWords(previous);
  if (before.size === 0) return 0;
  const after = contentWords(next);
  let shared = 0;
  for (const word of before) {
    if (after.has(word)) shared += 1;
  }
  return shared / before.size;
}

/**
 * Above this, the new message is the old question again.
 *
 * Set high. A false `restated` marks a working answer as a failure, and a metric
 * that overstates failure gets argued with and then ignored — which costs more
 * than the readings it misses.
 */
const RESTATED_THRESHOLD = 0.7;

/**
 * Read what the user's next message says about the answer before it.
 *
 * Ordered most-certain first: what they said outright beats what their wording
 * implies. `previousAnswer` is taken but not matched against — it is here because
 * every future refinement needs it, and threading it now means the call sites do
 * not all change later.
 */
export function readAnswerOutcome(input: {
  previousQuestion: string;
  previousAnswer: string;
  followUp: string;
}): OutcomeRead {
  const followUp = input.followUp.trim();

  if (PUSHED_BACK.test(followUp)) {
    return { outcome: "pushed-back", landed: false, evidence: "said the answer missed" };
  }

  if (CORRECTED.test(followUp)) {
    return { outcome: "corrected", landed: false, evidence: "corrected a fact the answer stood on" };
  }

  // Checked after the negatives: "thanks, but that's not what I asked" is a
  // complaint wearing a courtesy, and reading it as satisfaction would count the
  // politest failures as successes.
  if (CLOSED.test(followUp)) {
    return { outcome: "closed", landed: true, evidence: "said it helped" };
  }

  const ratio = repeatRatio(input.previousQuestion, followUp);
  if (ratio >= RESTATED_THRESHOLD) {
    return {
      outcome: "restated",
      landed: false,
      evidence: `asked the same thing again (${Math.round(ratio * 100)}% of the original question repeated)`
    };
  }

  return { outcome: "followed-on", landed: true, evidence: "moved on to something new" };
}

/**
 * Outcomes known when the answer is produced, without waiting for a reply.
 *
 * These are the endings the Advisor chooses for itself, and each is a real answer
 * to "did this help?" that no follow-up is needed to establish. They are recorded
 * on the same score as the rest so one number covers every conversation rather
 * than only the ones that reached the model.
 */
export type ImmediateOutcome =
  /** Asked a clarifying menu instead of answering. Not a failure; not help yet. */
  | "clarified"
  /** Gave up after two consecutive misunderstandings. */
  | "handed-off"
  /** The question was outside what Haven covers. Correct, and still no answer. */
  | "declined";

/**
 * None of these count as landing.
 *
 * `clarified` is the arguable one: asking a good clarifying question is right, and
 * it is still true that the person does not yet have an answer. Counting it as a
 * success would make the number improve every time the Advisor got less sure of
 * itself, which is precisely backwards.
 */
export const IMMEDIATE_LANDED: Record<ImmediateOutcome, boolean> = {
  clarified: false,
  "handed-off": false,
  declined: false
};

/** Every value the score can take, for the dashboard filter and for the checks. */
export type RecordedOutcome = AnswerOutcome | ImmediateOutcome;

/** The Langfuse score names. Two, and they carry different jobs. */
export const OUTCOME_SCORE = "answer-outcome";
export const LANDED_SCORE = "answer-landed";

/**
 * Record an outcome against the trace of the answer it judges.
 *
 * **Langfuse, not a new table.** The thumbs already score traces there, the model
 * calls are already there, and every trace already carries its topics, guardrails
 * and citation count — so "which topics fail most" and "do answers with community
 * stories land better" are filters on data that already exists rather than a join
 * across two systems. A second store would also be a second version of the same
 * fact, which is the failure mode this codebase keeps producing.
 *
 * Two scores rather than one, because they answer different questions and
 * Langfuse aggregates them differently. `answer-landed` is numeric, so it averages
 * into the single rate worth watching. `answer-outcome` is categorical, so the
 * rate can be broken down by *how* it failed — a month of `restated` means the
 * answers are unclear, a month of `corrected` means Haven has the wrong facts
 * about people, and those need opposite fixes.
 *
 * Silent on failure and never awaited by the answer path. This is measurement; it
 * must not be able to cost somebody a reply.
 */
export async function recordOutcome(input: {
  traceId: string;
  outcome: RecordedOutcome;
  landed: boolean;
  evidence: string;
}): Promise<void> {
  try {
    const { getLangfuseClient, flushLangfuse } = await import("@/lib/langfuse");
    const lf = getLangfuseClient();
    if (!lf) return;

    lf.score({
      traceId: input.traceId,
      name: OUTCOME_SCORE,
      value: input.outcome,
      dataType: "CATEGORICAL",
      comment: input.evidence
    });

    lf.score({
      traceId: input.traceId,
      name: LANDED_SCORE,
      value: input.landed ? 1 : 0,
      dataType: "NUMERIC",
      comment: `${input.outcome} — ${input.evidence}`
    });

    await flushLangfuse();
  } catch {
    // Intentionally silent — see the doc comment.
  }
}


/**
 * What the last answer in a conversation was, when no follow-up ever came.
 *
 * Silence cannot be labelled — satisfied and gave-up look identical from here.
 * But it can be *split*, and the split is most of the value:
 *
 * - Silence after a clarifying question is somebody who was asked to explain
 *   themselves and did not come back. That is abandonment, not satisfaction, and
 *   it is actionable today: the clarifying question was too much work, or it
 *   arrived on a question the Advisor should have understood.
 * - Silence after a handoff or a decline is the expected ending. Haven said it
 *   could not help and the person left. Counting it as failure would mean the
 *   number improves by declining less, which is backwards.
 * - Silence after a real answer is the genuinely ambiguous one, and the only
 *   group worth spending a survey on.
 *
 * Recorded as its own score rather than folded into `answer-landed`, because
 * averaging a guess into a measured rate is how a measured rate stops being one.
 */
export type SilenceKind = "after-answer" | "after-clarify" | "after-handoff" | "after-decline";

export const SILENCE_SCORE = "conversation-ended-quietly";

/**
 * Which kind of silence a trace's ending represents.
 *
 * Derived from the outcome already recorded for that answer, so there is one
 * definition of "this was a clarify" rather than two that drift.
 */
export function silenceKindFor(lastOutcome: RecordedOutcome | null): SilenceKind {
  switch (lastOutcome) {
    case "clarified":
      return "after-clarify";
    case "handed-off":
      return "after-handoff";
    case "declined":
      return "after-decline";
    default:
      return "after-answer";
  }
}

/**
 * Record that a conversation ended without a follow-up.
 *
 * Deliberately not called from the answer path — nothing at answer time knows the
 * conversation is over. This is for a sweep that runs later over threads whose
 * last message is older than the cutoff. Until that sweep exists, the function is
 * the definition of the measurement rather than the measurement itself, which is
 * the honest place to stop: the split above is the decision worth committing, and
 * inventing a cutoff would just bury an arbitrary number in a cron job.
 */
export async function recordSilence(input: { traceId: string; kind: SilenceKind }): Promise<void> {
  try {
    const { getLangfuseClient, flushLangfuse } = await import("@/lib/langfuse");
    const lf = getLangfuseClient();
    if (!lf) return;

    lf.score({
      traceId: input.traceId,
      name: SILENCE_SCORE,
      value: input.kind,
      dataType: "CATEGORICAL",
      comment: "No follow-up message was ever sent in this conversation."
    });

    await flushLangfuse();
  } catch {
    // Intentionally silent — measurement must never cost anybody a reply.
  }
}

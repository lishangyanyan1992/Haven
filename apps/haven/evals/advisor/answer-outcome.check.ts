/**
 * Did the last answer help?
 *
 * The reading is made from the user's next message, so the risk sits entirely in
 * misreading that message. Two failure directions, and they are not equal:
 *
 * - A **false negative** — a working answer marked as a failure — makes the metric
 *   overstate how bad things are. Somebody argues with it once, and then nobody
 *   trusts the number again. This is the expensive one, so `restated` is
 *   deliberately hard to trigger.
 * - A **false positive** — a failure marked as help — hides work. Cheaper, and
 *   still the reason "thanks, but that's not what I asked" must not read as
 *   satisfaction.
 *
 * Run: npm run check:answer-outcome
 */

export {};

async function main() {
  const { readAnswerOutcome, IMMEDIATE_LANDED } = await import("@/lib/advisor/answer-outcome");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const ANSWER = "Your 60-day grace period runs from your last day of employment. Options are a transfer, a change of status, or departure.";
  const read = (previousQuestion: string, followUp: string) =>
    readAnswerOutcome({ previousQuestion, previousAnswer: ANSWER, followUp });

  const Q = "What are my options after being laid off?";

  // ------------------------------------------------------- said it outright
  const pushedBack: string[] = [
    "That's not what I asked.",
    "You didn't answer my question.",
    "That doesn't help at all.",
    "I already told you I'm on F-1.",
    "You keep repeating the same thing."
  ];
  for (const message of pushedBack) {
    const result = read(Q, message);
    check(`"${message}" reads as pushed back`, result.outcome === "pushed-back" && !result.landed, result.outcome);
  }

  // -------------------------------------------------------------- corrected
  //
  // Helpful of them, and the answer they got was still built on a wrong premise —
  // so it did not answer them. Counting it as a success would hide the profile and
  // memory defects that cause it, which are the ones worth finding.
  const corrections: string[] = [
    "No, I'm not on H-1B, I'm on OPT.",
    "Actually my last day was August 3, not July.",
    "That's wrong, my I-140 was denied."
  ];
  for (const message of corrections) {
    const result = read(Q, message);
    check(`"${message}" reads as a correction`, result.outcome === "corrected" && !result.landed, result.outcome);
  }

  // ------------------------------------------------------------------ closed
  for (const message of ["Thanks, that helps.", "Got it, thank you.", "Perfect, that answers it."]) {
    const result = read(Q, message);
    check(`"${message}" reads as closed`, result.outcome === "closed" && result.landed, result.outcome);
  }

  // A courtesy wrapped around a complaint is a complaint. Reading it as
  // satisfaction would score the politest failures as successes — and politeness
  // correlates with the people least likely to complain twice.
  const politeComplaint = read(Q, "Thanks, but that's not what I asked.");
  check(
    "a thank-you attached to a complaint is still a complaint",
    politeComplaint.outcome === "pushed-back" && !politeComplaint.landed,
    politeComplaint.outcome
  );

  // ---------------------------------------------------------------- restated
  //
  // The same question again, in other words. The case that matters most is the
  // question repeated *with a detail added* — it is longer than the original, so a
  // symmetric similarity measure scores it low precisely when it should score high.
  const restatements: Array<[string, string]> = [
    ["What are my options after being laid off?", "So what are my options now that I've been laid off?"],
    ["What are my options after being laid off?", "What are my options after being laid off if my employer won't file?"],
    ["How long is the grace period?", "How long is the grace period exactly?"]
  ];
  for (const [previous, followUp] of restatements) {
    const result = read(previous, followUp);
    check(`"${followUp}" reads as a restatement`, result.outcome === "restated" && !result.landed, `${result.outcome} — ${result.evidence}`);
  }

  // -------------------------------------------------------------- followed on
  //
  // A different question means the answer did its job. These are the false
  // negatives that would make the metric overstate failure, so they matter more
  // than the positives above.
  const followOns: Array<[string, string]> = [
    ["What are my options after being laid off?", "How much does premium processing cost?"],
    ["What are my options after being laid off?", "Can my spouse keep working on their H-4 EAD?"],
    ["How long is the grace period?", "What documents should I gather before speaking to an attorney?"],
    // Same topic, genuinely next question. Shares words with the original and is
    // not the same ask — the hardest case for a similarity threshold.
    ["What are my options after being laid off?", "If I file a change of status, can I still travel?"]
  ];
  for (const [previous, followUp] of followOns) {
    const result = read(previous, followUp);
    check(`"${followUp}" reads as following on`, result.outcome === "followed-on" && result.landed, `${result.outcome} — ${result.evidence}`);
  }

  // Two questions about different visas share most of their scaffolding. If the
  // stopword list is wrong, these collapse into "restated" and every topic switch
  // is recorded as a failure.
  const differentTopic = read("What should I do about my H-1B transfer?", "What should I do about my PERM?");
  check(
    "two different topics in the same sentence shape are not a restatement",
    differentTopic.outcome === "followed-on",
    `${differentTopic.outcome} — ${differentTopic.evidence}`
  );

  // ---------------------------------------------------------------- evidence
  //
  // A number nobody can trace back is a number nobody acts on.
  const restated = read(Q, "So what are my options now that I've been laid off?");
  check("a restatement records how much was repeated", /\d+%/.test(restated.evidence), restated.evidence);

  // --------------------------------------------------- the Advisor's own endings
  //
  // Clarifying is right and is still not an answer. Counting it as a success would
  // make the number improve every time the Advisor got less sure of itself.
  check("clarifying does not count as landing", IMMEDIATE_LANDED.clarified === false, "it counted");
  check("handing off does not count as landing", IMMEDIATE_LANDED["handed-off"] === false, "it counted");
  check("declining does not count as landing", IMMEDIATE_LANDED.declined === false, "it counted");

  // ------------------------------------------- measured, not reasoned about
  //
  // The threshold is the whole design, so it is measured against real questions
  // rather than argued for. Every corpus question paired against every other is
  // 380 pairs of genuinely different questions, and not one may read as a
  // restatement — a single false hit here is a working answer recorded as a
  // failure, and a metric that overstates failure gets argued with once and
  // ignored afterwards.
  const { CORPUS_QUESTIONS } = await import("./corpus-questions");
  const corpus = (CORPUS_QUESTIONS as Array<{ question: string }>).map((item) => item.question);
  const falseHits: string[] = [];
  for (const previous of corpus) {
    for (const followUp of corpus) {
      if (previous === followUp) continue;
      if (read(previous, followUp).outcome === "restated") falseHits.push(`${previous} -> ${followUp}`);
    }
  }
  check(
    `no two different corpus questions read as a restatement (${corpus.length * (corpus.length - 1)} pairs)`,
    falseHits.length === 0,
    falseHits.slice(0, 5).join("\n      ")
  );

  // The other side of that trade, stated rather than hidden. Word overlap catches
  // a rephrase that reuses the vocabulary and misses one that does not — "what are
  // my options" asked again as "what can I actually do" shares almost nothing. So
  // the recorded failure rate is a floor, not a count, and the honest way to hold
  // that is a number here rather than a caveat nobody reads. Chasing the rest with
  // a model call is the trade this file exists to refuse: the verdict would stop
  // being stable, and an outcome number that moves when nothing changed is worse
  // than one that is known to run low.
  const rephrasings: Array<[string, string]> = [
    ["What are my options after being laid off?", "Okay but what can I actually do now that I've been laid off?"],
    ["How long is my grace period?", "So how many days do I have in the grace period?"],
    ["Can I travel while my I-485 is pending?", "Is it safe to travel with a pending I-485?"],
    ["What happens if I can't find a job in 60 days?", "What if I don't find a job within the 60 days?"],
    ["Does my H-1B transfer let me start working?", "When can I start working after the H-1B transfer?"],
    ["What should I ask an immigration attorney?", "What questions should I ask an immigration attorney?"],
    ["Is a change of status the same as work authorization?", "Does a change of status give me work authorization?"]
  ];
  const caught = rephrasings.filter(([previous, followUp]) => read(previous, followUp).outcome === "restated").length;
  console.log(`\nINFO  catches ${caught}/${rephrasings.length} genuine rephrasings — the two it misses share no vocabulary with the original.`);
  check("it catches most rephrasings that reuse the wording", caught >= 5, `caught ${caught}`);

  // -------------------------------------------------------------- silence
  //
  // Silence cannot be labelled — satisfied and gave-up look identical. It can be
  // split, and the split is where the value is: silence after a clarifying
  // question is somebody who was asked to explain themselves and never came back,
  // which is actionable today. Silence after a real answer is the ambiguous group
  // and the only one worth spending a survey on.
  const { silenceKindFor } = await import("@/lib/advisor/answer-outcome");
  const silenceCases: Array<[string, string]> = [
    ["clarified", "after-clarify"],
    ["handed-off", "after-handoff"],
    ["declined", "after-decline"],
    ["followed-on", "after-answer"],
    ["closed", "after-answer"]
  ];
  for (const [outcome, expected] of silenceCases) {
    const got = silenceKindFor(outcome as never);
    check(`silence after ${outcome} is recorded as ${expected}`, got === expected, got);
  }
  check("silence with no recorded outcome counts as after an answer", silenceKindFor(null) === "after-answer", silenceKindFor(null));

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

/**
 * The request contract, tested the way the browser actually sends it.
 *
 * This file exists because of a bug I shipped and a test I wrote that could not
 * see it.
 *
 * The Advisor client builds its request from `[...messages, newMessage]`, so the
 * question being asked arrives *inside its own history*. Every consumer downstream
 * treats history as "the turns before this one". My travel-gate fixture passed
 * history the intended way, so it went green while production did the opposite:
 *
 *  - A user's *first* unrecognised question counted as two misses and skipped
 *    straight to "I've asked twice and I'm still not confident I understand" —
 *    a stranger's opening message answered as though it were their third.
 *  - The one-turn topic lookback only ever saw the current turn, so the carry-over
 *    that keeps the advance-parole guardrail alive across a follow-up
 *    ("and what if I only go for four days?") was inert in production. The fixture
 *    asserting that it worked was passing.
 *
 * So every case here builds its request the way `AdvisorWorkspace.sendMessage`
 * does, echoed current turn included, and runs it through the same normalisation
 * the route uses. A fixture that constructs a tidier input than the client sends
 * is testing a product nobody uses.
 *
 * It also asserts something narrower and easy to forget: **every prompt Haven puts
 * in front of the user must classify.** The reported failure was Haven's own first
 * suggested chip — "How does my EB-2 + China path affect what I should watch
 * next?" — which matched no topic and was answered with a refusal to answer. If
 * the product suggests a question, the product has to be able to answer it.
 */

export {};

type Outcome = "ANSWERS" | "CLARIFY" | "ESCALATE";

async function main() {
  const { routeAdvisorQuestion, buildSuggestedPrompts } = await import("@/lib/advisor/service");
  const { buildThreadState, withoutEchoedCurrentTurn } = await import("@/lib/advisor/thread-state");

  /** Exactly what AdvisorWorkspace.sendMessage puts on the wire, then normalised. */
  function send(content: string, prior: Array<{ role: "user" | "assistant"; content: string }> = []) {
    const submitted = [...prior, { role: "user" as const, content }];
    const history = withoutEchoedCurrentTurn(content, submitted);
    const route = routeAdvisorQuestion({ content, history });
    const state = buildThreadState({
      currentMatched: route.currentMatched,
      previousMatched: route.previousMatched,
      history,
      matches: (text) => routeAdvisorQuestion({ content: text }).currentMatched
    });
    const outcome: Outcome =
      state.resolution === "unmatched" ? (state.consecutiveMisses >= 2 ? "ESCALATE" : "CLARIFY") : "ANSWERS";
    return { outcome, route, misses: state.consecutiveMisses };
  }

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // ---------------------------------------------------------------- the report
  const reported = send("How does my EB-2 + China path affect what I should watch next?");
  check(
    "the reported question is answered, not refused",
    reported.outcome === "ANSWERS" && reported.route.topics.includes("visa-bulletin"),
    `outcome=${reported.outcome} topics=${reported.route.topics.join(",")}`
  );

  // ------------------------------------- the layoff conversation, after the layoff
  //
  // Found by reading sixty answers, not by a test. Every phrasing the classifier
  // knew for this topic named the loss — "laid off", "grace period", "60 days".
  // But once somebody has an offer and a petition on file they stop mentioning the
  // layoff at all, and three questions in that state fell to the clarify menu for
  // all three test personas. The first one below is the portability question: the
  // reason the product narrowed to this topic, and the place the collected corpus
  // holds its most confidently wrong advice.
  const postLayoff: Array<[string, string]> = [
    ["starting work on a receipt rather than an approval", "New employer filed with premium. Can I start on the receipt or wait for approval?"],
    ["a notice period described as garden leave", "My last day on paper is next week but I'm on garden leave until January. Is my clock already running?"],
    ["a deadline described as a clock", "My clock is running and I have nothing filed. What now?"],
    ["a transfer named without the layoff", "My H-1B transfer is pending. Can I switch to the new job now?"],
    ["the last-paid-day confusion", "I was let go May 30 but they paid me through July 4. Which date counts?"]
  ];
  for (const [name, question] of postLayoff) {
    const result = send(question);
    check(
      `${name} is recognised, not sent to the menu`,
      result.outcome === "ANSWERS" && result.route.topics.includes("layoffs"),
      `outcome=${result.outcome} topics=${result.route.topics.join(",")}`
    );
    // "Guarded", not "guarded by that specific id".
    //
    // Two of these five name no job loss at all — "my H-1B transfer is pending,
    // can I switch now?" is equally somebody moving jobs on purpose. They used to
    // take the full layoff briefing, which meant six mandatory statements
    // including a grace period that may not apply to them, and that briefing is
    // most of why answers ran to 700 words.
    //
    // What actually makes these two dangerous is narrower: starting work on a
    // receipt rather than an approval. GR_TRANSFER_BASICS carries exactly that —
    // do not work without authorisation, an LCA is not permission, a receipt is
    // evidence of filing and not a grant. Someone with a layoff on file still gets
    // the full set, because `hasOpenLayoff` reaches the selector.
    //
    // So this asserts the decision is guarded, and lets the selector choose which
    // guard fits. Asserting the id would force every neutral question back into
    // the briefing.
    const guarded =
      result.route.guardrailIds.includes("GR_LAYOFF_SAFETY_RULES") ||
      result.route.guardrailIds.includes("GR_TRANSFER_BASICS");
    check(
      `${name} is guarded against starting work too early`,
      guarded,
      `guardrails=${result.route.guardrailIds.join(",") || "none"}`
    );
  }

  // And the split itself: a job loss on record turns a neutrally-worded question
  // back into the full briefing. Without this, somebody thirty days into a grace
  // period who asks a calm question loses the deadline that is running out on them.
  const neutralQuestion = "My H-1B transfer is pending. Can I switch to the new job now?";
  const withLayoffOnFile = routeAdvisorQuestion({ content: neutralQuestion, hasOpenLayoff: true });
  check(
    "a neutral question from someone with a layoff on file still gets the full rules",
    withLayoffOnFile.guardrailIds.includes("GR_LAYOFF_SAFETY_RULES"),
    withLayoffOnFile.guardrailIds.join(",") || "none"
  );
  const withoutLayoff = routeAdvisorQuestion({ content: neutralQuestion });
  check(
    "and the same question from someone employed does not",
    !withoutLayoff.guardrailIds.includes("GR_LAYOFF_SAFETY_RULES"),
    withoutLayoff.guardrailIds.join(",") || "none"
  );

  // The widened patterns must not swallow questions that are not about a layoff.
  // "receipt", "transfer" and "last day" all appear in ordinary sentences.
  const notLayoff: Array<[string, string]> = [
    ["a document question", "What documents should I keep copies of?"],
    ["a bulletin question", "What does the visa bulletin say about EB-2 India this month?"]
  ];
  for (const [name, question] of notLayoff) {
    const result = send(question);
    check(
      `${name} is not reclassified as a layoff`,
      !result.route.topics.includes("layoffs"),
      `topics=${result.route.topics.join(",")}`
    );
  }

  // ------------------------------------------------- first miss must not escalate
  const cold = send("hello there");
  check(
    "a first unrecognised message clarifies, never escalates",
    cold.outcome === "CLARIFY" && cold.misses === 1,
    `outcome=${cold.outcome} misses=${cold.misses} (was ESCALATE/2 before the fix)`
  );

  const secondMiss = send("still nothing useful", [
    { role: "user", content: "hello there" },
    { role: "assistant", content: "Which of these is closest to what you're asking about?" }
  ]);
  check(
    "a second consecutive miss does escalate",
    secondMiss.outcome === "ESCALATE",
    `outcome=${secondMiss.outcome} misses=${secondMiss.misses}`
  );

  // --------------------------------------------------------- carry-over is real
  const followUp = send("And what if I only go for four days?", [
    { role: "user", content: "My I-485 is pending and I want to travel to India." },
    { role: "assistant", content: "Travel while an I-485 is pending depends on approved advance parole..." }
  ]);
  check(
    "the advance-parole guardrail survives a follow-up, with the client's real history shape",
    followUp.route.guardrailIds.includes("GR_I485_TRAVEL"),
    `guardrails=${followUp.route.guardrailIds.join(",") || "(none)"} (was none before the fix)`
  );

  // ------------------------------------- every prompt Haven suggests must classify
  const profiles = [
    { preferenceCategory: "EB-2", countryOfBirth: "China", priorityDate: "2021-05-04", topConcerns: ["gc_timeline"] },
    { preferenceCategory: "EB-3", countryOfBirth: "India", priorityDate: "2019-11-02", topConcerns: ["layoffs"] },
    { preferenceCategory: "EB-1", countryOfBirth: "Nigeria", priorityDate: null, topConcerns: ["job_change"] },
    { preferenceCategory: "EB-2", countryOfBirth: "Brazil", priorityDate: null, topConcerns: ["visa_expiry"] }
  ];

  for (const profile of profiles) {
    const prompts = buildSuggestedPrompts(
      { profile } as never,
      { familiarity: "first-visit", priorConversations: 0, lastTitle: null, lastActiveAt: null }
    );

    for (const prompt of prompts) {
      const result = send(prompt);
      check(
        `suggested prompt is answerable (${profile.preferenceCategory} ${profile.countryOfBirth})`,
        result.outcome === "ANSWERS",
        `outcome=${result.outcome} topics=${result.route.topics.join(",") || "-"}\n      "${prompt}"`
      );
    }
  }

  // ----------------------------- and so must the follow-up chips shown after one
  const chips = [
    "How do I work out my exact deadline?",
    "What has to be filed before day 60, and who files it?",
    "What should I ask an immigration attorney about my options this week?"
  ];
  for (const chip of chips) {
    // Chips appear after a layoff answer, so they arrive as follow-ups.
    const result = send(chip, [
      { role: "user", content: "I was laid off on Friday." },
      { role: "assistant", content: "Your grace period is up to 60 days..." }
    ]);
    check(
      "layoff follow-up chip keeps its layoff guardrails",
      result.route.guardrailIds.includes("GR_LAYOFF_SAFETY_RULES"),
      `guardrails=${result.route.guardrailIds.join(",") || "(none)"}\n      "${chip}"`
    );
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nFailed:");
    for (const name of failures) console.log(`  - ${name}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

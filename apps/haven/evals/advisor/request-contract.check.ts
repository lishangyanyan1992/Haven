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

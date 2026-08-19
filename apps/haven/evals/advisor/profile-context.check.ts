/**
 * Does the person's own deadline reach the answer?
 *
 * This suite exists because of a bug no assertion in the repo could see. Sixty
 * answers were read across three laid-off test personas, and not one named the
 * person's last day, their grace-period end, or a filing they had pending — even
 * though all of it was on their profile. Every graded suite was green throughout.
 *
 * The cause: the timeline block was withheld from the prompt unless the question
 * happened to contain "Haven", "my profile", "dashboard" or "timeline". Nobody
 * asking an urgent question phrases it that way, so the model was handed the
 * 60-day rule and no dates, and did the only thing it could — describe the rule in
 * general terms to three people with three different deadlines.
 *
 * The worst instance: a persona whose grace period had already ended and who had a
 * change of status pending inside it. That pending filing is the whole difference
 * between "you are out of status, plan to depart" and "you have something pending,
 * here is what that means". It was in the timeline, it was not in the prompt, and
 * the answer told him to leave the country.
 *
 * So what is asserted here is not tone or safety but presence: given a question a
 * real person would type, do their own dates appear in the context the model is
 * given. The negative cases matter as much — a bulletin question should not drag
 * in layoff milestones, which is what the original filter was reaching for and
 * achieved by starving every question instead of routing them.
 *
 * Run: npm run check:profile-context
 */

export {};

async function main() {
  const { buildAdvisorContext, buildPromptTimelineSummary, buildPromptGracePeriod, routeAdvisorQuestion } = await import("@/lib/advisor/service");
  const { TEST_PERSONAS } = await import("@/lib/repositories/test-personas");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  /** The context the model would actually be handed for this question. */
  function timelineFor(question: string, snapshot: Parameters<typeof buildAdvisorContext>[0]) {
    const route = routeAdvisorQuestion({ content: question, history: [{ role: "user", content: question }] });
    const context = buildAdvisorContext(snapshot);
    return buildPromptTimelineSummary(question, route.topics, context).join("\n");
  }

  // Questions phrased the way the corpus phrases them — none of which mention
  // Haven, a profile, a dashboard or a timeline.
  const urgent = [
    "When exactly do I have to have something filed by?",
    "New employer filed with premium. Can I start on the receipt or wait for approval?",
    "I was laid off. What are my options?",
    "My 60 days ran out. Is it over?"
  ];

  for (const persona of TEST_PERSONAS) {
    for (const question of urgent) {
      const timeline = timelineFor(question, persona.snapshot as never);
      check(
        `${persona.id}: "${question.slice(0, 44)}…" is given the person's own dates`,
        timeline.length > 0,
        "the timeline block was empty — the model would answer from the rule alone"
      );
    }

    // The specific fact that changes the answer most for each persona.
    const timeline = timelineFor("I was laid off. What are my options?", persona.snapshot as never);
    check(
      `${persona.id}: the grace-period date is in the context`,
      /grace period/i.test(timeline),
      `context was:\n      ${timeline.replace(/\n/g, "\n      ") || "(empty)"}`
    );
  }

  // ------------------------------------------------------------- the countdown
  //
  // The layoff date is what changes the most answers and was the one fact the
  // Advisor could not see: layoff_events has carried it since the War Room
  // shipped and nothing in the pipeline read the table. The bot knew *that*
  // somebody was laid off and never *when*.
  function graceFor(question: string, snapshot: Parameters<typeof buildAdvisorContext>[0]) {
    const route = routeAdvisorQuestion({ content: question, history: [{ role: "user", content: question }] });
    return buildPromptGracePeriod(route.topics, buildAdvisorContext(snapshot)).join("\n");
  }

  for (const persona of TEST_PERSONAS) {
    const grace = graceFor("New employer filed with premium. Can I start on the receipt?", persona.snapshot as never);
    check(
      `${persona.id}: the 60-day count reaches a question that never mentions the layoff`,
      /day \d+/.test(grace),
      `context was: ${grace || "(empty)"}`
    );
    check(
      `${persona.id}: the count names the last day it was computed from`,
      grace.includes("Last day of employment on file"),
      `context was: ${grace || "(empty)"}`
    );
  }

  // Priya is employed. No layoff event, so no countdown — a count for somebody
  // who was never laid off would be a fabricated deadline.
  const { havenSnapshot: employed } = await import("@/lib/repositories/mock-data");
  check(
    "somebody who is not laid off gets no countdown",
    graceFor("I was laid off. What are my options?", employed as never).length === 0,
    "a countdown was produced for an employed profile"
  );

  // The pending I-539 is the whole of day-89's situation.
  const day89 = TEST_PERSONAS.find((p) => p.id === "day-89")!;
  const pending = timelineFor("My 60 days ran out. Is it over?", day89.snapshot as never);
  check(
    "day-89: the pending change of status is in the context before anyone says 'depart'",
    /i-539|change of status/i.test(pending),
    `context was:\n      ${pending.replace(/\n/g, "\n      ") || "(empty)"}`
  );

  // The original filter was reaching for something real, and some of it is kept:
  // a topic with no date sensitivity gets no dates.
  //
  // The line is drawn deliberately loosely. "What is the difference between EB-2
  // and EB-3?" does still receive them, because it classifies as a bulletin
  // question and bulletin questions are date-sensitive. That is over-inclusion and
  // it is the direction chosen on purpose: the cost is a few unused lines of
  // context, where the cost in the other direction was three people being told the
  // general rule instead of their own deadline. Tightening this is how the bug was
  // created.
  const offTopic = timelineFor("Who files the PERM, me or my employer?", day89.snapshot as never);
  check(
    "a question on a topic with no date sensitivity gets no personal dates",
    offTopic.length === 0,
    `context was:\n      ${offTopic.replace(/\n/g, "\n      ")}`
  );

  // Naming the product still works, which is how the old behaviour was reached.
  const explicit = timelineFor("What does my Haven timeline say?", day89.snapshot as never);
  check(
    "asking for the timeline directly still returns it",
    explicit.length > 0,
    "empty"
  );

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

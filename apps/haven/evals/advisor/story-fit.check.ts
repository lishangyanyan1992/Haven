/**
 * When a community story leads the answer.
 *
 * The product's claim is two hundred people who have already been through this.
 * But "always lead with a story" is wrong in a way that costs somebody their
 * status: asked how long a grace period is, the answer is sixty days, and an
 * anecdote opening "I got about three months" is misinformation wearing the
 * clothes of evidence.
 *
 * So the cases split by where the answer lives — in the regulations, or in what
 * happened to people. The rule-governed cases are the load-bearing ones here: a
 * story wrongly leading is the failure with a real victim, and a story wrongly
 * withheld just makes Haven ordinary.
 *
 * Run: npm run check:story-fit
 */

export {};

async function main() {
  const { classifyEvidenceKind, decideStoryLead, renderStoryLeadForPrompt } = await import("@/lib/advisor/story-fit");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // -------------------------------------------------- the regulations answer it
  //
  // Every one of these has a written answer. A story here is at best decoration
  // and at worst contradicts the rule somebody is about to act on.
  const ruleQuestions = [
    "How long is my grace period?",
    "How many days do I have after my last day?",
    "Is it legal to work on a pending I-539?",
    "Am I allowed to travel with an expired visa stamp?",
    "What is the deadline to file an extension?",
    "Do I need a new LCA for a different worksite?",
    "Does a receipt notice count as work authorization?"
  ];
  for (const question of ruleQuestions) {
    // Rule questions carry a safety floor in production; assert the kind holds
    // either way so the classification is not smuggling in the point count.
    for (const points of [0, 6]) {
      const kind = classifyEvidenceKind(question, points);
      check(`"${question.slice(0, 40)}…" is rule-governed (${points} required points)`, kind === "rules", kind);
    }
  }

  // -------------------------------------------- only experience answers it
  const experienceQuestions = [
    "What do people actually do when their employer won't file?",
    "Has anyone found a sponsor inside 60 days?",
    "Did anyone use B-2 as a bridge and have it work out?",
    "What happened to people who tried this?",
    "Is the premium processing upgrade worth it in practice?",
    "How long did it actually take for other people?"
  ];
  for (const question of experienceQuestions) {
    check(
      `"${question.slice(0, 40)}…" leads with experience when no rule floor exists`,
      classifyEvidenceKind(question, 0) === "experience",
      classifyEvidenceKind(question, 0)
    );
    check(
      `"${question.slice(0, 40)}…" becomes mixed when the rules require something`,
      classifyEvidenceKind(question, 6) === "mixed",
      classifyEvidenceKind(question, 6)
    );
  }

  // An experience question that also contains rule wording. The half no
  // regulation answers is the half only Haven has, so it must not be vetoed.
  check(
    "asking whether something is worth it AND allowed is not treated as a rule question",
    classifyEvidenceKind("Is the B-2 bridge worth it, and is it even allowed?", 0) === "experience",
    classifyEvidenceKind("Is the B-2 bridge worth it, and is it even allowed?", 0)
  );

  // -------------------------------------------------------------- situational
  //
  // Nobody asking "what should I do?" wants a citation. But the safety floor
  // still goes first when there is one.
  check(
    '"I was laid off, what should I do first?" is mixed, not rule-governed',
    classifyEvidenceKind("I was laid off last week. What should I do first?", 6) === "mixed",
    classifyEvidenceKind("I was laid off last week. What should I do first?", 6)
  );
  check(
    '"what are my options?" with no rule floor lets a story lead',
    classifyEvidenceKind("What are my options?", 0) === "experience",
    classifyEvidenceKind("What are my options?", 0)
  );

  // ------------------------------------------------------------- the fit gate
  const story = (over: Partial<{ title: string; similarity: number; tags: string[] }> = {}) => ({
    title: over.title ?? "Used B-2 as a bridge",
    topic: "layoffs",
    summary: "Got laid off, filed B-2 on day 59, later transferred.",
    legalCaveat: "One person's experience.",
    tags: over.tags ?? ["h1b", "layoffs"],
    similarity: over.similarity ?? 0.8
  });

  const decide = (stories: any[], profileScore = () => 0, question = "What do people actually do?") =>
    decideStoryLead({ question, requiredPointCount: 0, stories, profileScore });

  check("a close story leads", decide([story()]).story !== null, decide([story()]).reason);
  check(
    "a distant story does not lead, even on an experience question",
    decide([story({ similarity: 0.2 })]).story === null,
    decide([story({ similarity: 0.2 })]).reason
  );
  check(
    "a distant story still leads if the person matches it strongly",
    decide([story({ similarity: 0.2 })], () => 4).story !== null,
    decide([story({ similarity: 0.2 })], () => 4).reason
  );
  check(
    "no stories means no lead, and it says so",
    decide([]).story === null && /No community stories/i.test(decide([]).reason),
    decide([]).reason
  );
  check(
    "a rule question never leads with a story however good the match",
    decide([story({ similarity: 0.99 })], () => 9, "How long is my grace period?").story === null,
    decide([story({ similarity: 0.99 })], () => 9, "How long is my grace period?").reason
  );

  // The closest of several is the one that leads.
  const best = decide([story({ title: "Weak match", similarity: 0.56 }), story({ title: "Strong match", similarity: 0.9 })]);
  check("the closest story is the one chosen", best.story?.title === "Strong match", best.reason);

  // Every decision is explainable — a lead nobody can trace back is a lead nobody
  // can fix when it goes wrong.
  for (const decision of [decide([story()]), decide([]), decide([story({ similarity: 0.1 })])]) {
    check(`the decision explains itself: "${decision.reason.slice(0, 45)}…"`, decision.reason.length > 20, decision.reason);
  }

  // ---------------------------------------------------------- the instructions
  const leading = renderStoryLeadForPrompt(decide([story()])).join("\n");
  check("a leading story is told to open with the account, not a mention", /what they actually did/i.test(leading), leading);
  check("and to compare it to this person", /what carries across to them/i.test(leading), leading);
  check("and to say once that it is not a rule", /one person'?s experience/i.test(leading), leading);

  const mixed = renderStoryLeadForPrompt({ story: story() as never, kind: "mixed", reason: "x" }).join("\n");
  check("a mixed answer puts the required safety line before the story", /before anything else/i.test(mixed), mixed);

  const ruleLed = renderStoryLeadForPrompt({ story: null, kind: "rules", reason: "x" }).join("\n");
  check(
    "a rule answer is warned not to let a story imply a different rule",
    /never let one imply a rule is different/i.test(ruleLed),
    ruleLed
  );

  const noFit = renderStoryLeadForPrompt({ story: null, kind: "experience", reason: "x" }).join("\n");
  check("no fitting story means a short answer, not padding", /Do not stretch one/i.test(noFit), noFit);

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

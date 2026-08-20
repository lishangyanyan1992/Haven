/**
 * What counts as a step the user has already tried.
 *
 * The asymmetry that shapes these cases: a *missed* attempt costs one repeated
 * suggestion, which the user corrects in a sentence. A *false* attempt silently
 * deletes a live option from every subsequent answer — if we wrongly record that
 * their employer refused, the Advisor stops suggesting the employer, and nobody
 * finds out. So the negative cases outnumber the positive ones on purpose.
 *
 * Run: npm run check:attempted-steps
 */

export {};

type Case = { name: string; message: string; expect: Array<"blocked" | "tried" | "underway"> };

const CASES: Case[] = [
  // -------------------------------------------------------------- must record
  //
  // Somebody else closed the door. Almost every step Haven suggests routes
  // through one of these people, so this is the highest-value bucket.
  { name: "employer refused", message: "My employer refused to file the transfer.", expect: ["blocked"] },
  { name: "employer said no", message: "I asked and my company said no.", expect: ["blocked"] },
  { name: "employer won't sponsor", message: "My employer won't sponsor me anymore.", expect: ["blocked"] },
  { name: "HR stopped replying", message: "HR stopped responding to my emails.", expect: ["blocked"] },
  { name: "the DSO doesn't know", message: "My DSO does not know how to handle this.", expect: ["blocked"] },
  { name: "the company is shutting down", message: "My company is shutting down at the end of the month.", expect: ["blocked"] },
  { name: "they never got back", message: "They never got back to me.", expect: ["blocked"] },

  // Tried and unresolved.
  { name: "tried with no luck", message: "I already tried that and had no luck.", expect: ["tried"] },
  { name: "called, no response", message: "I called USCIS but nothing came of it.", expect: ["tried"] },
  { name: "that didn't work", message: "I did that and it didn't work.", expect: ["tried"] },
  { name: "bare already tried", message: "I already tried that.", expect: ["tried"] },
  { name: "still waiting", message: "I emailed them twice and I am still waiting.", expect: ["tried"] },

  // Done, outcome pending. Suggesting it again implies they have not started.
  { name: "already filed", message: "I already filed the I-539.", expect: ["underway"] },
  { name: "attorney filed it", message: "My attorney filed it last week.", expect: ["underway"] },
  { name: "been applying for months", message: "I have been applying for jobs for three months.", expect: ["underway"] },
  { name: "it is pending", message: "It's already pending with USCIS.", expect: ["underway"] },

  // ---------------------------------------------------------- must NOT record
  //
  // Every one of these would delete a working suggestion if recorded.
  { name: "asking whether to try it", message: "Should I ask my employer to file a transfer?", expect: [] },
  { name: "asking what happens if refused", message: "What if my employer refuses to file?", expect: [] },
  { name: "asking about a DSO", message: "Can my DSO help with this?", expect: [] },
  { name: "a hypothetical refusal", message: "If they say no, what are my options?", expect: [] },
  { name: "a friend's employer refused", message: "My friend's employer refused to file for him.", expect: [] },
  { name: "a colleague tried it", message: "A colleague tried that and it failed.", expect: [] },
  { name: "someone else I know", message: "Someone I know already tried that.", expect: [] },
  { name: "a plain question", message: "How long does an H-1B transfer take?", expect: [] },
  { name: "a plain statement of status", message: "I am on H-1B with an approved I-140.", expect: [] },
  { name: "intending to try it", message: "I am going to ask my employer tomorrow.", expect: [] },
  {
    // The one that would hurt most: they are describing the layoff, not a refusal.
    name: "a layoff is not a refusal",
    message: "I was laid off on August 3.",
    expect: []
  }
];

async function main() {
  const { extractAttempts, collectAttempts, renderAttemptsForPrompt } = await import("@/lib/advisor/attempted-steps");

  let pass = 0;
  const failures: string[] = [];

  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  for (const testCase of CASES) {
    const actual = extractAttempts(testCase.message).map((a) => a.outcome);
    const ok =
      actual.length === testCase.expect.length && actual.every((value, index) => value === testCase.expect[index]);
    check(
      testCase.name,
      ok,
      `"${testCase.message}"\n      expected: ${testCase.expect.join(", ") || "(nothing)"}\n      actual:   ${actual.join(", ") || "(nothing)"}`
    );
  }

  // ------------------------------------------------------------ across a thread
  //
  // The repetition this guards against is not within one message. The user rules
  // something out on turn two and the Advisor suggests it again on turn five, by
  // which point the sentence that ruled it out is far back in the context.
  const thread = [
    { role: "user" as const, content: "I was laid off on August 3 and I need to find a sponsor." },
    { role: "assistant" as const, content: "One option is asking your employer to file an H-1B transfer." },
    { role: "user" as const, content: "My employer refused to file anything for me." },
    { role: "assistant" as const, content: "Understood. Another option is a change of status." }
  ];
  const carried = collectAttempts("So what else can I do before the 60 days run out?", thread);
  check(
    "an attempt from an earlier turn is still carried",
    carried.some((a) => /employer refused/i.test(a.quote)),
    JSON.stringify(carried)
  );
  check("the assistant's own suggestions are never read as attempts", carried.length === 1, JSON.stringify(carried));

  // The user's own words are what reach the model. A parsed code would need a
  // taxonomy of every step Haven might suggest, and the first one outside it
  // would be repeated with full confidence.
  check(
    "the user's sentence is kept verbatim",
    carried[0]?.quote === "My employer refused to file anything for me.",
    carried[0]?.quote ?? "(nothing)"
  );

  const duplicated = collectAttempts("I already tried that.", [
    { role: "user", content: "I already tried that." },
    { role: "assistant", content: "Noted." }
  ]);
  check("the same sentence twice is carried once", duplicated.length === 1, JSON.stringify(duplicated));

  // ------------------------------------------------------------- the instruction
  //
  // "Do not repeat these" alone produces an answer that silently drops the obvious
  // step, which reads as evasive — the user cannot tell whether it heard them.
  const rendered = renderAttemptsForPrompt(carried).join("\n");
  // The instruction has two halves and both are load-bearing. Dropping the closed
  // step silently is correct and still reads as though nobody listened; echoing
  // their sentence back reads like a glitch. Measured live before this was
  // written: the block placed lower in the prompt produced the first failure, and
  // the first wording that fixed it produced the second.
  check("the prompt block asks it to acknowledge what is closed", /acknowledging what is closed/i.test(rendered), rendered);
  check("the prompt block forbids parroting their words back", /[Nn]ever quote their sentence back/.test(rendered), rendered);
  check("the prompt block says what to do when everything is ruled out", /say so plainly/i.test(rendered), rendered);
  check("nothing to say produces no block", renderAttemptsForPrompt([]).length === 0, "it produced one");

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

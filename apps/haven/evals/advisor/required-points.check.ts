/**
 * Which questions get the layoff safety briefing, and which do not.
 *
 * The measurement that produced this file: "How long does an H-1B transfer
 * usually take?" — a question with a one-sentence answer — was required to state
 * six things before it could answer, none of which was how long a transfer takes.
 * The cause was the word "transfer" sitting in the layoff trigger list, so every
 * voluntary job change inherited a layoff briefing. Model output was running
 * 530-725 words against a prompt asking for 2-4 sentences, and it was the prompt's
 * own safety rules doing it.
 *
 * The asymmetry that shapes these cases: under-triggering costs somebody in a real
 * layoff their safety lines, which is the worst outcome in this product.
 * Over-triggering costs relevance and length. So the layoff cases here are the
 * load-bearing ones — the neutral cases prove the fix, the layoff cases prove it
 * did not take anything away.
 *
 * Run: npm run check:required-points
 */

export {};

async function main() {
  const svc: any = await import("@/lib/advisor/service");
  const { selectGuardrailIdsForTopics, requiredPointsForAnswer } = svc;

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const H1B = ["h1b", "job-change"];
  const points = (question: string, topics: string[] = H1B) =>
    requiredPointsForAnswer(question, topics, selectGuardrailIdsForTopics(question, topics));

  // ------------------------------------ a real layoff keeps everything it had
  //
  // These are the cases that must not regress. Every one of them is somebody
  // whose status is running out.
  const layoffQuestions = [
    "I was laid off last week. What should I do first?",
    "My last day is Friday and I don't know what to do.",
    "How long is my grace period?",
    "What has to be filed before day 60, and who files it?",
    "They terminated me on Tuesday. Can I stay?",
    "My employer stopped paying me. Does that affect my H-1B?"
  ];
  for (const question of layoffQuestions) {
    const got = points(question, ["layoffs", "h1b"]);
    check(
      `a real layoff still gets the full safety set — "${question.slice(0, 42)}…"`,
      got.length >= 6,
      `only ${got.length} required points`
    );
  }

  // ------------------------------- a neutral question stops getting a briefing
  const neutralQuestions = [
    "How long does an H-1B transfer usually take?",
    "Can I travel while my H-1B transfer is pending?",
    "What is the deadline to file an H-1B extension?",
    "Who files the H-1B transfer, me or my employer?"
  ];
  for (const question of neutralQuestions) {
    const got = points(question);
    check(
      `a neutral question is not handed a layoff briefing — "${question.slice(0, 42)}…"`,
      got.length <= 1,
      `still required to state ${got.length} things: ${got.map((p: string) => p.slice(0, 40)).join(" | ")}`
    );
  }

  // The two beliefs that made "transfer" worth guarding are kept — it is the
  // other four, and the option menu, that did not belong.
  const transferIds = selectGuardrailIdsForTopics("How long does an H-1B transfer usually take?", H1B);
  check(
    "a transfer question still gets the LCA and receipt-notice rules",
    transferIds.includes("GR_TRANSFER_BASICS"),
    transferIds.join(", ")
  );
  check(
    "and is not given the layoff option menu",
    !transferIds.includes("GR_LAYOFF_OPTION_MENU"),
    transferIds.join(", ")
  );

  // ------------------------------------------------- the dangerous premises
  //
  // These fire on the belief, not the topic, and must survive untouched — a
  // question can be neutrally worded and still be about to cost somebody their
  // status.
  const lcaIds = selectGuardrailIdsForTopics("My employer filed the LCA so I'm covered, right?", H1B);
  check(
    "believing an LCA is protection still triggers the full rules",
    lcaIds.includes("GR_LAYOFF_SAFETY_RULES"),
    lcaIds.join(", ")
  );
  const unpaidPoints = points("Can I keep working unpaid so my H-1B stays alive?", ["h1b", "layoffs"]);
  check(
    "believing unpaid work preserves status is corrected first",
    unpaidPoints.some((p: string) => /unpaid or volunteer work does NOT preserve/i.test(p)),
    unpaidPoints.join(" | ")
  );

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

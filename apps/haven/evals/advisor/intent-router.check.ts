/**
 * Does reading the meaning beat matching the words?
 *
 * This is the evidence for or against the router, and it is deliberately stacked
 * *against* it. Most cases below are phrasings the keyword list already handles,
 * several only because they were patched by hand after a bug report. If the model
 * cannot at least match that, the premise is wrong and the work should stop.
 *
 * Three groups:
 *
 *   solved     phrasings the keyword list gets right today. The router must not
 *              regress them. This is the bar.
 *   unseen     phrasings nobody has patched for. Neither router has been tuned on
 *              these, so they are the honest test of generalisation.
 *   negative   questions that must NOT raise a safety topic. Over-triggering is
 *              the safer failure, but a router that flags everything is useless,
 *              and this is where a semantic model is most likely to be worse than
 *              a literal match.
 *
 * Reports each router separately and the union. The union is what a live design
 * would act on — either signal may raise a topic, both must miss to lose one —
 * so it is the number that says what shipping this would actually buy.
 *
 * Costs real tokens. Run deliberately, not in CI.
 *
 * Run: npm run check:intent-router
 */

export {};

type Case = {
  question: string;
  group: "solved" | "unseen" | "negative";
  /** Topic that must be present, or null for the negative cases. */
  want: string | null;
  /** Only for negatives: the topic that must not appear. */
  forbid?: string;
};

const CASES: Case[] = [
  // ---------------------------------------------------------------- solved
  { question: "I was laid off last week, what happens to my H-1B?", group: "solved", want: "layoffs" },
  { question: "I was made redundant on Friday.", group: "solved", want: "layoffs" },
  { question: "My employer put me on the bench three weeks ago.", group: "solved", want: "layoffs" },
  { question: "I had to put down my papers last week.", group: "solved", want: "layoffs" },
  { question: "My position was affected in the restructuring.", group: "solved", want: "layoffs" },
  { question: "What does this month's visa bulletin mean for my priority date?", group: "solved", want: "visa-bulletin" },
  { question: "My daughter turns 21 in four months.", group: "solved", want: "cspa" },
  { question: "My NIW was denied, should I refile?", group: "solved", want: "self-petition" },
  { question: "Is day 1 CPT safe?", group: "solved", want: "student-status" },
  { question: "I worked without authorization for two months.", group: "solved", want: "work-authorization" },

  // ---------------------------------------------------------------- unseen
  // No pattern was ever written for any of these.
  { question: "HR called me into a meeting this morning and said my role is being sunset.", group: "unseen", want: "layoffs" },
  { question: "The company is winding down my whole division at the end of the quarter.", group: "unseen", want: "layoffs" },
  { question: "I've been told to hand in my badge on Friday and I'm on a work visa.", group: "unseen", want: "layoffs" },
  { question: "My manager said today there's no more budget for my role.", group: "unseen", want: "layoffs" },
  { question: "They're not renewing me after this project wraps.", group: "unseen", want: "layoffs" },
  { question: "I'm being moved off payroll at the end of the month.", group: "unseen", want: "layoffs" },
  { question: "How much longer until people from my country in my category can move forward?", group: "unseen", want: "visa-bulletin" },
  { question: "My kid will be too old to be included by the time our turn comes.", group: "unseen", want: "cspa" },
  { question: "They said no to my petition where I sponsored myself.", group: "unseen", want: "self-petition" },
  { question: "I did a few paid projects before my card came through. Is that a problem?", group: "unseen", want: "work-authorization" },

  // -------------------------------------------------------------- negative
  { question: "What are my options for the 60-day grace period?", group: "negative", want: null, forbid: "student-status" },
  { question: "Does moving to a role at a capital markets firm affect my PERM?", group: "negative", want: null, forbid: "h1b" },
  { question: "What is the deadline to file my I-140?", group: "negative", want: null, forbid: "work-authorization" },
  { question: "My I-94 expires in March.", group: "negative", want: null, forbid: "work-authorization" },
  { question: "What's the weather in Seattle?", group: "negative", want: null, forbid: "layoffs" }
];

async function main() {
  const { routeAdvisorQuestion } = await import("@/lib/advisor/service");
  const { classifyIntent, compareRouters, getRouterModel } = await import("@/lib/advisor/intent-router");

  console.log(`Router model: ${getRouterModel()}\n`);

  const tally = {
    solved: { keyword: 0, model: 0, union: 0, n: 0 },
    unseen: { keyword: 0, model: 0, union: 0, n: 0 },
    negative: { keyword: 0, model: 0, union: 0, n: 0 }
  };

  for (const testCase of CASES) {
    const keywordTopics = routeAdvisorQuestion({ content: testCase.question }).topics;
    const read = await classifyIntent({ content: testCase.question });

    if (!read) {
      console.log(`SKIP  router unavailable — "${testCase.question.slice(0, 50)}"`);
      continue;
    }

    const comparison = compareRouters(keywordTopics, read);
    const bucket = tally[testCase.group];
    bucket.n += 1;

    let keywordOk: boolean;
    let modelOk: boolean;
    let unionOk: boolean;

    if (testCase.want) {
      keywordOk = keywordTopics.includes(testCase.want as never);
      modelOk = read.topics.includes(testCase.want as never);
      unionOk = comparison.union.includes(testCase.want as never);
    } else {
      // For negatives, "correct" means the forbidden topic is absent. The union is
      // the strictest test here: either router raising it counts as a miss, which
      // is exactly the cost of the both-signals design.
      keywordOk = !keywordTopics.includes(testCase.forbid as never);
      modelOk = !read.topics.includes(testCase.forbid as never);
      unionOk = !comparison.union.includes(testCase.forbid as never);
    }

    if (keywordOk) bucket.keyword += 1;
    if (modelOk) bucket.model += 1;
    if (unionOk) bucket.union += 1;

    const mark = (ok: boolean) => (ok ? "ok" : "MISS");
    console.log(
      `[${testCase.group}] keyword ${mark(keywordOk).padEnd(4)} model ${mark(modelOk).padEnd(4)} — "${testCase.question.slice(0, 56)}"`
    );
    if (!keywordOk || !modelOk) {
      console.log(`          keyword=${keywordTopics.join(",") || "-"}  model=${read.topics.join(",") || "-"}`);
    }
  }

  console.log("\n── Results\n");
  console.log("group      n   keyword   model   union");
  for (const [group, b] of Object.entries(tally)) {
    if (b.n === 0) continue;
    const pct = (v: number) => `${Math.round((v / b.n) * 100)}%`.padStart(6);
    console.log(`${group.padEnd(10)} ${String(b.n).padStart(2)}  ${pct(b.keyword)}  ${pct(b.model)}  ${pct(b.union)}`);
  }

  console.log(
    "\nRead `unseen` first — those are phrasings neither router was tuned on, and the\n" +
      "only honest measure of whether reading meaning generalises better than matching\n" +
      "words. `solved` is the floor: the model must not regress what patterns already\n" +
      "handle. `negative` is where a semantic router is most likely to be worse."
  );

  // Thresholds, so a model or prompt change that quietly undoes the result fails
  // rather than printing worse numbers nobody reads.
  //
  // Set from the measured baseline on 2026-08-16: solved 100/100/100,
  // unseen 20/100/100, negative 100/80/80. They are floors, not targets — the
  // point is to catch regression, and holding them at exactly today's numbers
  // would make an unlucky sample look like a failure.
  //
  // `negative` is deliberately lenient for the model. It over-triggered once, on
  // "My I-94 expires in March", adding work-authorization. Over-triggering is the
  // safer direction for a safety router — an unnecessary warning costs a
  // sentence — so this is tracked rather than treated as a blocker. If it drops
  // much further the router is flagging everything and is worth less than the
  // patterns.
  const failures: string[] = [];
  const floor = (group: keyof typeof tally, field: "model" | "union", min: number) => {
    const b = tally[group];
    if (b.n === 0) return;
    const pct = Math.round((b[field] / b.n) * 100);
    if (pct < min) failures.push(`${group}.${field} was ${pct}%, floor is ${min}%`);
  };

  floor("solved", "model", 90);
  floor("solved", "union", 100);
  floor("unseen", "model", 80);
  floor("unseen", "union", 80);
  floor("negative", "model", 60);

  if (failures.length > 0) {
    console.log("\nBelow baseline:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

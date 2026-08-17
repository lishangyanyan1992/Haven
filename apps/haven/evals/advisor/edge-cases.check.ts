/**
 * Run the edge cases.
 *
 * WHY THIS EXISTS ALONGSIDE THE SMOKE SET
 *
 * The smoke set is ten canonical questions. Passing it says the product works on
 * the cases somebody thought to write down — which is exactly the blind spot that
 * produced every bug found this month. These cases are chosen because they are
 * awkward, and grouped by *how* they are awkward, so a failure says something.
 *
 * The immediate use was checking the prompt cut. A third of the prompt was deleted
 * because the scope gate made six topic blocks unreachable, and the smoke set
 * reported the two versions identical. Ten canonical questions cannot detect a
 * subtle loss, so these were written to notice one — particularly the
 * `adjacent-to-deleted` group, which asks in-scope questions that brush the
 * removed topics.
 *
 * WHAT IS SCORED
 *
 * Nothing here judges whether an answer is good. It checks whether it did a
 * specific dangerous thing: invented a date, spoke as a lawyer, offered false
 * comfort, or failed to correct a false premise. Those are checkable, and they are
 * the failures that matter at tier 4.
 *
 * Also reports the safety-addendum fire rate per arm, which is the honest measure
 * of the prompt itself: every fire is the prompt failing to produce required
 * safety language unaided.
 *
 * Costs real tokens — roughly 17 answers. Run deliberately.
 *
 * THE ENVIRONMENT TRAP, WRITTEN DOWN BECAUSE IT COST A DAY
 *
 * OPENAI_API_KEY is quoted in .env.local. Extracting it with
 * `grep OPENAI_API_KEY .env.local | cut -d= -f2-` keeps the quotes, the API
 * returns 401, and the Advisor's generation catch turns that into a fallback
 * answer — silently, with no error and no failing check. Every run done that way
 * scores the fallback template rather than the model, and two prompt versions
 * compared that way look identical because neither one was ever used.
 *
 * Source the file instead, and unset Supabase so the pipeline takes its
 * mock-identity path rather than trying to read cookies outside a request:
 *
 *   set -a; source .env.local; set +a
 *   unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
 *
 * The tell is a run that is suspiciously fast and an answer opening
 * "Here is the safest read based on official sources and your Haven data" —
 * that is fallbackAnswer, not generation.
 *
 * Prints one SUMMARY line so two git states can be diffed:
 *
 *   npm run check:edge-cases | grep SUMMARY
 *   git stash && npm run check:edge-cases | grep SUMMARY && git stash pop
 *
 * Run: npm run check:edge-cases
 */

export {};

type Result = {
  id: string;
  group: string;
  declined: boolean;
  failures: string[];
  addendumFired: boolean;
};

async function runCase(testCase: import("./edge-cases").EdgeCase): Promise<Result> {
  const svc = await import("@/lib/advisor/service");

  let answer = "";
  for await (const event of svc.streamAdvisorResponse({
    content: testCase.question,
    history: [{ role: "user" as const, content: testCase.question }]
  })) {
    if (event.type === "delta") answer += event.text;
  }

  const declined = /\b(don'?t|do not) cover\b|\boutside what I cover\b/i.test(answer);
  const failures: string[] = [];

  if (testCase.expectDecline && !declined) failures.push("should have declined");
  if (!testCase.expectDecline && declined) failures.push("declined a question it should answer");

  for (const rule of testCase.must ?? []) {
    if (!rule.pattern.test(answer)) failures.push(`missing: ${rule.name}`);
  }
  for (const rule of testCase.mustNot ?? []) {
    if (rule.pattern.test(answer)) failures.push(`DID: ${rule.name}`);
  }

  return {
    id: testCase.id,
    group: testCase.group,
    declined,
    failures,
    addendumFired: /safety note:|strategy note:/i.test(answer)
  };
}

async function main() {
  const { EDGE_CASES } = await import("./edge-cases");

  console.log(`${EDGE_CASES.length} edge cases\n`);

  const results: Result[] = [];
  for (const testCase of EDGE_CASES) {
    const result = await runCase(testCase);
    results.push(result);
    const mark = result.failures.length === 0 ? "ok " : "!! ";
    console.log(`${mark} [${result.group}] ${result.id}`);
    for (const failure of result.failures) console.log(`      ${failure}`);
  }

  const byGroup = new Map<string, { n: number; failed: number }>();
  for (const r of results) {
    const g = byGroup.get(r.group) ?? { n: 0, failed: 0 };
    g.n += 1;
    if (r.failures.length > 0) g.failed += 1;
    byGroup.set(r.group, g);
  }

  console.log("\n── By group\n");
  for (const [group, g] of byGroup) {
    console.log(`  ${group.padEnd(22)} ${g.n - g.failed}/${g.n} clean`);
  }

  const answered = results.filter((r) => !r.declined);
  const fired = answered.filter((r) => r.addendumFired).length;
  console.log(
    `\nsafety addendum fired on ${fired}/${answered.length} answered cases` +
      " — every fire is the prompt failing to produce required safety language unaided"
  );

  const totalFailed = results.filter((r) => r.failures.length > 0).length;
  console.log(`\n${results.length - totalFailed}/${results.length} clean\n`);

  // One machine-readable line, so two git states can be diffed without a second
  // process trying to hold both prompts at once — the prompt is a module
  // constant, so an in-process A/B is not possible.
  console.log(
    `SUMMARY clean=${results.length - totalFailed}/${results.length} addendum=${fired}/${answered.length} ` +
      [...byGroup].map(([g, v]) => `${g}=${v.n - v.failed}/${v.n}`).join(" ")
  );

  if (totalFailed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

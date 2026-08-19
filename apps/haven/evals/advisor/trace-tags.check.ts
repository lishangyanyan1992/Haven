/**
 * Telling a test run apart from a real one, in Langfuse.
 *
 * Every question — eval fixture, founder probing the product, and genuine user —
 * goes through the same pipeline into the same Langfuse project. Until these tags
 * existed the only thing separating them was the absence of a userId on mock
 * runs, which fails in the case that matters most: a script pointed at a real
 * account looks exactly like that account's owner using the product.
 *
 * That matters more than it sounds. The product has almost no traffic yet, so the
 * first real question anybody asks of the traces is "how are actual answers
 * doing?" — and twenty probe questions are enough to drown the handful of real
 * ones. A conclusion drawn from that mix would be wrong and would look fine.
 *
 * The contract asserted here:
 *
 *   production is untagged   so "real traffic" is a filter on *no tags*, which
 *                            stays correct as harnesses come and go. If a future
 *                            change starts tagging production, every historical
 *                            filter silently changes meaning.
 *   mock is always marked     derived from the identity, so it cannot be forgotten
 *   configured tags win too   the only signal that can catch a real-account test
 *
 * Run: npm run check:trace-tags
 */

export {};

async function main() {
  const { buildTraceTags } = await import("@/lib/advisor/service");

  const real = { isMock: false };
  const mock = { isMock: true };

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const production = buildTraceTags(real, undefined, undefined);
  check(
    "a real user with no configured tag produces no tags at all",
    production.length === 0,
    `got: ${JSON.stringify(production)}`
  );

  const mockUntagged = buildTraceTags(mock, undefined, undefined);
  check(
    "a mock identity is marked even when nothing is configured",
    mockUntagged.includes("mock-identity"),
    `got: ${JSON.stringify(mockUntagged)}`
  );

  // The case the userId check could never catch.
  const realTagged = buildTraceTags(real, "eval", undefined);
  check(
    "a real account running an eval is still marked as a test",
    realTagged.includes("eval"),
    `got: ${JSON.stringify(realTagged)}`
  );
  check(
    "a real account running an eval is not mislabelled as mock",
    !realTagged.includes("mock-identity"),
    `got: ${JSON.stringify(realTagged)}`
  );

  const both = buildTraceTags(mock, "eval", undefined);
  check(
    "mock and configured tags coexist",
    both.includes("mock-identity") && both.includes("eval"),
    `got: ${JSON.stringify(both)}`
  );

  const multi = buildTraceTags(real, "eval, edge-cases ,", undefined);
  check(
    "a comma list becomes separate tags, trimmed, with blanks dropped",
    multi.length === 2 && multi.includes("eval") && multi.includes("edge-cases"),
    `got: ${JSON.stringify(multi)}`
  );

  const whitespaceOnly = buildTraceTags(real, "   ", undefined);
  check(
    "a whitespace-only setting is treated as unset",
    whitespaceOnly.length === 0,
    `got: ${JSON.stringify(whitespaceOnly)}`
  );

  const withPersona = buildTraceTags(mock, "eval", "day-42");
  check(
    "the persona is on the trace, so three people asking the same question are distinguishable",
    withPersona.includes("persona-day-42"),
    `got: ${JSON.stringify(withPersona)}`
  );

  const noPersona = buildTraceTags(real, undefined, undefined);
  check(
    "no persona means no persona tag",
    noPersona.length === 0,
    `got: ${JSON.stringify(noPersona)}`
  );

  const duplicated = buildTraceTags(mock, "mock-identity, mock-identity", undefined);
  check(
    "duplicate tags collapse",
    duplicated.filter((t) => t === "mock-identity").length === 1,
    `got: ${JSON.stringify(duplicated)}`
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

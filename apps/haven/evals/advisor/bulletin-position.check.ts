/**
 * The numbers Haven states about somebody's place in the green card queue.
 *
 * Every case here is a real defect found by reading one answer to "How does my
 * EB-2 + China path affect what I should watch next?" — a reply that told a person
 * their green card might be current "around 2025–2029" in August 2026, described
 * them as "5 months ahead of cutoff" when they were five months behind it, and
 * pasted Haven's internal record into the answer while referring to them in the
 * third person.
 *
 * None of it was caught by a test, because all three were formatting decisions
 * rather than logic, and formatting is what a person actually reads.
 *
 * Run: npm run check:bulletin-position
 */

export {};

async function main() {
  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // The internals under test are not exported — the public surface is one async
  // function that needs Supabase and a live bulletin table. So these read the
  // source, which means comments have to come out first: every one of these
  // defects is documented in a comment right next to its fix, and matching raw
  // text would fail the check for explaining the bug it guards against. That is
  // not a hypothetical — it happened on the first run.
  const fs = await import("node:fs");
  const withoutComments = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const read = (relative: string) =>
    withoutComments(fs.readFileSync(new URL(relative, import.meta.url), "utf8"));

  const source = read("../../src/lib/priority-date-intelligence.ts");

  // ---------------------------------------------------------- the gap wording
  //
  // "5 months ahead of cutoff" reads as good news to somebody scanning. It means
  // the opposite: the queue has to move five more months to reach them.
  check(
    "the gap is never described as being 'ahead of cutoff'",
    !/ahead of cutoff/.test(source),
    "the phrase is still there"
  );
  check(
    "the gap says which direction it runs",
    /cutoff still has to move/.test(source),
    "no directional wording found"
  );

  // ------------------------------------------------------- the projection window
  //
  // The old range was centreYear-1 to centreYear+3 with no floor, so in Aug 2026 a
  // projection centred on 2026 rendered as "2025–2029" — a five-year window whose
  // first year had already happened. A person reads that as "it might already be
  // my turn", which is the most consequential thing to be wrong about here.
  check(
    "the projection is floored against the current year",
    /centerYear <= thisYear/.test(source) && /Math\.max\(centerYear - 1, thisYear \+ 1\)/.test(source),
    "no floor found"
  );
  check(
    "an overtaken projection returns nothing rather than a range",
    /if \(centerYear <= thisYear\) return null/.test(source),
    "it still returns a range"
  );
  check(
    "the window is no longer lopsided toward optimism",
    !/centerYear \+ 3/.test(source),
    "the +3 upper bound is still there"
  );

  // --------------------------------------------------- the block the model quotes
  //
  // The instruction "state them exactly as written" existed to stop the model
  // inventing cutoff dates, which is the one thing it must never do. The model
  // obeyed literally and pasted a labelled data sheet into the answer, so a real
  // user read Haven's notes calling them "this user".
  const bulletinSource = read("../../src/lib/advisor/bulletin-live.ts");

  check(
    "the block no longer refers to the reader in the third person",
    !/This user's priority date/.test(bulletinSource),
    "'This user's priority date' is still there"
  );
  check(
    "the block is no longer a labelled data sheet",
    !/`Category\/country: /.test(bulletinSource) && !/`Distance from cutoff: /.test(bulletinSource),
    "labelled fields are still being emitted"
  );
  check(
    "it still forbids the model computing its own dates",
    /[Nn]ever work out a cutoff date/.test(bulletinSource),
    "the safety instruction was lost in the rewrite"
  );
  check(
    "it tells the model to write sentences, not reproduce the block",
    /[Dd]o not reproduce these lines as a labelled list/.test(bulletinSource),
    "no instruction against pasting"
  );

  // --------------------------------------------------------------- the estimate
  //
  // A projection Haven cannot honestly make must say so, not go quiet in a way
  // that leaves the rest of the answer sounding certain.
  check(
    "an unmakeable projection says so in words",
    /cannot project a date from the/.test(source),
    "no wording for the suppressed case"
  );

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

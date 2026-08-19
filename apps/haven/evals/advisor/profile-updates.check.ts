/**
 * What a chat message may and may not change in the user's profile.
 *
 * This is the first thing in the Advisor that writes stored data rather than
 * answering, and its failure mode is delayed and silent: a misparse does not
 * produce a visibly wrong answer today, it quietly rewrites the basis of every
 * answer from now on. Missing an update is recoverable — the user restates it.
 * Writing a wrong one is not, because nobody knows to look.
 *
 * So the negative cases matter more than the positive ones here, and there are
 * more of them on purpose.
 *
 * Run: npm run check:profile-updates
 */

export {};

type Case = {
  name: string;
  message: string;
  /** field=value pairs that must be written, or [] for "write nothing". */
  expect: string[];
};

const CASES: Case[] = [
  // ------------------------------------------------------------ must write
  { name: "plain layoff", message: "I was laid off on Friday.", expect: ["employmentStatus=laid_off"] },
  { name: "made redundant", message: "I was made redundant last week.", expect: ["employmentStatus=laid_off"] },
  { name: "let go", message: "I have been let go and I don't know what to do.", expect: ["employmentStatus=laid_off"] },
  { name: "new job", message: "I started at a new company on Monday.", expect: ["employmentStatus=employed"] },
  { name: "accepted an offer", message: "I accepted a new offer last week.", expect: ["employmentStatus=employed"] },
  { name: "I-140 approved", message: "My I-140 was approved in March.", expect: ["i140Approved=true"] },
  { name: "I-485 filed", message: "My attorney filed my I-485 last month.", expect: ["i485Filed=true"] },
  { name: "PERM certified", message: "My PERM was certified in June.", expect: ["permStage=certified"] },
  { name: "PERM filed", message: "My employer filed my PERM in January.", expect: ["permStage=in_progress"] },
  {
    name: "two changes in one message",
    message: "I was laid off on Friday. My I-140 was approved last year.",
    expect: ["i140Approved=true", "employmentStatus=laid_off"]
  },

  // ---------------------------------------------------------- must NOT write
  //
  // Every one of these reads like a statement to a pattern that is not careful
  // about who, when, or whether it happened at all.
  { name: "a question about being laid off", message: "What happens if I was laid off?", expect: [] },
  { name: "a hypothetical", message: "If I get laid off next month, what do I do?", expect: [] },
  { name: "someone else", message: "My friend was laid off and is asking me what to do.", expect: [] },
  { name: "spouse, not the user", message: "My wife was laid off last week.", expect: [] },
  { name: "asking whether the I-140 is approved", message: "Is my I-140 approved yet?", expect: [] },
  { name: "asking when to file I-485", message: "When can I file my I-485?", expect: [] },
  {
    // The case that made employment status conditional. Both signals in one
    // message, and guessing which is current would be wrong for months.
    name: "laid off then re-employed — writes nothing",
    message: "I was laid off in March but I started a new job in June.",
    expect: []
  },
  {
    name: "a denial is not an approval",
    message: "My I-140 was denied last month.",
    expect: []
  },
  {
    name: "planning to file is not filing",
    message: "I am planning to file my I-485 once my date is current.",
    expect: []
  },
  {
    name: "a general layoff question with no personal statement",
    message: "What are the rules about the 60-day grace period after a layoff?",
    expect: []
  }
];

async function main() {
  const { detectProfileUpdates, filterAlreadyCurrent, renderProfileUpdateNotice } = await import("@/lib/advisor/profile-updates");

  let pass = 0;
  const failures: string[] = [];

  for (const testCase of CASES) {
    const updates = detectProfileUpdates(testCase.message);
    const actual = updates.map((update) => `${update.field}=${String(update.value)}`).sort();
    const expected = [...testCase.expect].sort();
    const ok = actual.length === expected.length && actual.every((value, index) => value === expected[index]);

    console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name}`);
    if (!ok) {
      console.log(`      "${testCase.message}"`);
      console.log(`      expected: ${expected.join(", ") || "(nothing)"}`);
      console.log(`      actual:   ${actual.join(", ") || "(nothing)"}`);
      failures.push(testCase.name);
    } else pass += 1;
  }

  // A restatement of something already recorded must not be announced. Telling
  // somebody their profile was updated when nothing changed is noise, and noise
  // is how the real announcements get skipped.
  const alreadyLaidOff = filterAlreadyCurrent(detectProfileUpdates("I was laid off on Friday."), {
    employmentStatus: "laid_off"
  });
  const quiet = alreadyLaidOff.length === 0;
  console.log(`${quiet ? "PASS" : "FAIL"}  restating a fact already on file announces nothing`);
  if (quiet) pass += 1;
  else failures.push("restating a fact already on file announces nothing");

  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // ------------------------------------------------------- the last day of work
  //
  // The highest-consequence parse in the product: it seeds a 60-day countdown
  // somebody plans around. A wrong date here is worse than no date, so most of
  // what follows asserts refusal rather than recognition.
  const asOf = new Date("2026-08-19T12:00:00Z");
  const layoffDateFrom = (message: string) =>
    detectProfileUpdates(message, asOf).find((u) => u.field === "layoffDate")?.value ?? null;

  const parses: Array<[string, string, string]> = [
    ["a month by name", "I was laid off on August 3, 2026.", "2026-08-03"],
    ["an abbreviated month", "I got laid off Aug 3.", "2026-08-03"],
    ["an ordinal", "I was laid off on August 3rd.", "2026-08-03"],
    ["a numeric date with a full year", "I was laid off on 8/3/2026.", "2026-08-03"],
    ["yesterday", "I was laid off yesterday.", "2026-08-18"],
    ["today", "I got laid off today.", "2026-08-19"],
    // Year-less and in the future for this year, so it means last year.
    ["a month later in the year", "I was laid off on November 2.", "2025-11-02"]
  ];
  for (const [name, message, expected] of parses) {
    const got = layoffDateFrom(message);
    check(`${name} is read as ${expected}`, got === expected, `got ${got}`);
  }

  const refuses: Array<[string, string]> = [
    // The reason weekdays are not parsed: "last Friday" and "on Friday" can be
    // seven days apart under two reasonable readings, and a clock that starts a
    // week late is the exact harm this feature exists to prevent.
    ["a weekday", "I was laid off last Friday."],
    ["a bare weekday", "I was laid off on Friday."],
    // 8/3 is August 3rd to an American and March 8th to most of this product's users.
    ["an ambiguous numeric date with no year", "I was laid off on 8/3."],
    ["a vague period", "I was laid off a couple of weeks ago."],
    ["a month with no day", "I was laid off in August."],
    ["a day the month does not have", "I was laid off on February 31."],
    ["a date in the future", "I was laid off on 12/25/2026."]
  ];
  for (const [name, message] of refuses) {
    const got = layoffDateFrom(message);
    check(`${name} records no date rather than a guess`, got === null, `it recorded ${got}`);
  }

  // The date must come from the sentence that states the job loss, not from
  // anywhere in the message.
  const otherDate = layoffDateFrom("I was laid off. My I-140 was approved on March 3, 2026.");
  check(
    "a date belonging to a different fact does not become the layoff date",
    otherDate === null,
    `it recorded ${otherDate}`
  );

  // Everything that stops the employment-status write must stop this too.
  check("a question records no date", layoffDateFrom("What if I was laid off on August 3?") === null, "it recorded one");
  check(
    "somebody else's layoff records no date",
    layoffDateFrom("My husband was laid off on August 3.") === null,
    "it recorded one"
  );
  check(
    "a layoff cancelled out by a new job records no date",
    layoffDateFrom("I was laid off on June 1. I started a new job in July.") === null,
    "it recorded one"
  );

  // Restating a date already on record should not announce a new write.
  const stated = detectProfileUpdates("I was laid off on August 3, 2026.", asOf);
  const alreadyKnown = filterAlreadyCurrent(stated, { employmentStatus: "laid_off" }, "2026-08-03");
  check(
    "a date we already hold is not re-announced",
    !alreadyKnown.some((u) => u.field === "layoffDate"),
    `still announced: ${JSON.stringify(alreadyKnown)}`
  );

  const changed = filterAlreadyCurrent(stated, { employmentStatus: "laid_off" }, "2026-07-01");
  check(
    "a different date on record is still surfaced",
    changed.some((u) => u.field === "layoffDate"),
    "it was dropped"
  );

  // The notice has to say what recording a date actually does.
  const notice = renderProfileUpdateNotice(stated);
  check(
    "the notice says the 60-day timeline now runs from that date",
    /60-day timeline now runs/i.test(notice),
    notice
  );
  check("the notice says how to correct it", /if the date is wrong/i.test(notice), notice);

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

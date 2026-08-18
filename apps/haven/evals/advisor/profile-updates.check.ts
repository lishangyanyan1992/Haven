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
  const { detectProfileUpdates, filterAlreadyCurrent } = await import("@/lib/advisor/profile-updates");

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

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

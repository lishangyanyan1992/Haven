/**
 * Tone — the rules that are easiest to lose and hardest to notice losing.
 *
 * Everything the user reads is written for someone having a bad day: laid off
 * that morning, six weeks of status left, or newly aware they may have made a
 * mistake. Often reading fast, often in a second or third language.
 *
 * Four things must hold, and none of them is caught by any other suite:
 *
 *   never accuse       Do not open by refusing something the person did not ask
 *                      for, and do not imply carelessness. The
 *                      unauthorized-work copy used to lead with "I won't help you
 *                      hide anything", which answers an accusation almost nobody
 *                      made. Someone who worked three days on a pending EAD reads
 *                      that as being called a liar at the worst moment of their year.
 *
 *   never a lawyer     No "I advise", no "you should file", no legal opinions.
 *                      This is a product boundary, not a style preference.
 *
 *   never false comfort  "You'll be fine" and "don't worry" are harms at tier 4.
 *                      Warmth here is naming the deadline and saying what to do
 *                      today, not softening the facts.
 *
 *   point, don't guess  When something depends on a monthly chart or an unverified
 *                      source, name the source instead of asserting.
 *
 * Asserted against the shipped copy rather than against a description of it, so a
 * reworded message that quietly reintroduces the old framing fails here.
 *
 * Run: npm run check:tone
 */

export {};

/** Phrasings that read as accusation, refusal-first, or a lecture. */
const ACCUSATORY = [
  /\bI won'?t help you\b/i,
  /\byou (?:should have|shouldn'?t have|failed to|neglected)\b/i,
  /\bthat was (?:careless|reckless|a mistake on your part)\b/i,
  /\bif you had (?:only |just )?\b/i,
  /\byou broke\b/i,
  /\byou violated\b/i
];

/** Phrasings that claim professional standing the product does not have. */
const LAWYERLY = [
  /\bI advise\b/i,
  /\bmy (?:legal )?opinion\b/i,
  /\bas your (?:attorney|lawyer|counsel)\b/i,
  /\bI recommend that you file\b/i,
  /\blegally speaking, you\b/i
];

/** False reassurance. */
const FALSE_COMFORT = [/\byou'?ll be fine\b/i, /\bdon'?t worry\b/i, /\bnothing to worry about\b/i, /\bno need to panic\b/i];

async function main() {
  const { allGuardrails } = await import("@/lib/advisor/guardrail-registry");
  const { STREAMING_SYSTEM_PROMPT } = await import("@/lib/advisor/service");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // Only `audience: "user"` entries are read verbatim by a person. Model-facing
  // entries are instructions and may legitimately contain words like "refuse".
  const userFacing = allGuardrails().filter((entry) => entry.audience === "user");
  console.log(`Checking ${userFacing.length} user-facing messages\n`);

  for (const entry of userFacing) {
    const accusing = ACCUSATORY.filter((p) => p.test(entry.text));
    check(`${entry.id} does not accuse`, accusing.length === 0, `matched: ${accusing.map(String).join(", ")}`);

    const lawyerly = LAWYERLY.filter((p) => p.test(entry.text));
    check(`${entry.id} does not speak as a lawyer`, lawyerly.length === 0, `matched: ${lawyerly.map(String).join(", ")}`);

    const comfort = FALSE_COMFORT.filter((p) => p.test(entry.text));
    check(`${entry.id} offers no false comfort`, comfort.length === 0, `matched: ${comfort.map(String).join(", ")}`);
  }

  // The unauthorized-work message is the one most likely to drift back, because
  // the refusal in it is real and the temptation is to lead with it.
  const unauthorized = userFacing.find((e) => e.id === "MSG_SCOPE_UNAUTHORIZED_WORK");
  if (unauthorized) {
    const firstSentence = unauthorized.text.split(/[.\n]/)[0] ?? "";
    check(
      "MSG_SCOPE_UNAUTHORIZED_WORK does not open with a refusal",
      !/\b(won'?t|will not|refuse|cannot help)\b/i.test(firstSentence),
      `opens with: "${firstSentence.trim()}"`
    );
    check(
      "MSG_SCOPE_UNAUTHORIZED_WORK assumes an honest mistake",
      /common|not.*deliberate|rather than anything/i.test(unauthorized.text),
      "no language normalising the situation"
    );
  }

  // The system prompt has to carry the tone rules, or the model writes in its
  // drifting default and none of the copy above governs a generated answer.
  // The disclosure must ask the user to confirm, not just recite. A profile is a
  // snapshot they last edited at some point, and employment status, PERM stage and
  // dates go stale without either side noticing — which then changes an answer
  // silently. Asking is the cheapest correction the product has, and it is easy to
  // lose in a rewrite because the recitation reads complete without it.
  const disclosure = userFacing.find((e) => e.id === "MSG_DATA_DISCLOSURE_CLOSING");
  if (disclosure) {
    check(
      "the data disclosure asks the user to confirm it is still right",
      /still right|still accurate|has moved|has changed/i.test(disclosure.text),
      "no confirmation prompt in the closing"
    );
    check(
      "the data disclosure promises to prefer what the user says over what is saved",
      /use what you tell me|over what is saved|tell me here/i.test(disclosure.text),
      "no promise to override the stored profile"
    );
  }

  const promptRules: Array<[string, RegExp]> = [
    ["names who is reading", /laid off this morning|frightened|second or third language/i],
    ["forbids accusation", /never accuse|assume an honest mistake/i],
    ["forbids sounding like a lawyer", /not a lawyer|never sound like one/i],
    ["forbids false reassurance", /you'?ll be fine|don'?t worry/i],
    ["requires pointing to the source when unsure", /point to the source|instead of guessing/i],
    ["requires community stories when they fit", /community stories/i],
    ["names a stale-prone profile fact when it changed the answer", /materially changes your answer|invite correction/i]
  ];
  console.log("");
  for (const [name, pattern] of promptRules) {
    check(`system prompt ${name}`, pattern.test(STREAMING_SYSTEM_PROMPT), "rule missing from the prompt");
  }

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

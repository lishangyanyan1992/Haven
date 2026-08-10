/**
 * Regression check for the advance-parole / departure gate.
 *
 * Why this file exists.
 *
 * Leaving the country with a pending I-485 and no approved advance parole can
 * cause USCIS to treat the application as abandoned — years of waiting, gone, with
 * no way back. The guardrail that warns about it (`GR_I485_TRAVEL`) used to be
 * gated on the words "travel", "advance parole", "AP", "I-131", "visa stamp" or
 * "reentry": the vocabulary of somebody who already knows the rule. The people who
 * most need the warning do not use those words. They say "I need to fly to Delhi
 * for my father's funeral."
 *
 * Two things made that gap invisible:
 *
 * 1. The pattern was copied by hand into four places and had already drifted — one
 *    copy was missing "reentry", another was missing "ap" — so a question could
 *    match one gate and silently lose another.
 * 2. The old bare "ap" alternation had no word boundary, so it matched inside
 *    "happens" and "paperwork". The gate looked like it was firing in casual
 *    testing while missing every real phrasing.
 *
 * Nothing failed loudly in either case. The user just got a fluent, confident,
 * unguarded answer.
 *
 * This check asserts on `routeAdvisorQuestion` — the same function the streaming
 * path calls — rather than on a copy of the pattern. Asserting on a copy is how
 * the original bug survived its own eval fixture.
 *
 * If you are here because a case failed: do not narrow the pattern to make it
 * pass. Over-triggering is the intended failure mode. An extra advance-parole
 * paragraph costs a few tokens; a missing one can cost somebody their green card.
 */

// Marks this file a module. Without it, `main` sits in the global scope and
// collides with the identically-named `main` in the sibling check files.
export {};

type Case = {
  name: string;
  content: string;
  /** Simulates the user's Haven profile. */
  i485Filed?: boolean;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /**
   * Whether the user actually receives the advance-parole guardrail. An `unmatched`
   * turn short-circuits to a clarifying question before generation, so its selected
   * ids are never delivered — that counts as false here.
   */
  wantGuardrail: boolean;
  /** Assert the turn resolution too, where the distinction is the point. */
  wantResolution?: "matched" | "carried" | "unmatched";
};

const CASES: Case[] = [
  // --- The phrasings that were silent before. Every one of these is a real way
  // --- somebody asks whether they can leave the country.
  {
    name: "bereavement, no immigration vocabulary at all",
    content: "My I-485 is pending and I need to fly to Delhi next week for my father's funeral.",
    wantGuardrail: true
  },
  {
    name: "'go home' rather than 'travel'",
    content: "I-485 pending, can I go home for two weeks?",
    wantGuardrail: true
  },
  {
    name: "'leave the country'",
    content: "My adjustment of status is pending and I have to leave the country for a wedding.",
    wantGuardrail: true
  },
  {
    name: "family emergency, 'back home'",
    content: "My i-485 is pending. I have to go back home, my mother is in the hospital.",
    wantGuardrail: true
  },
  {
    name: "'visit my parents'",
    content: "Can I visit my parents in India while my I-485 is pending?",
    wantGuardrail: true
  },
  {
    name: "possessive wedding + abroad",
    content: "I have a pending adjustment of status and I need to attend my sister's wedding abroad.",
    wantGuardrail: true
  },
  {
    name: "'out of the country'",
    content: "Family emergency — I-485 pending and I need to be out of the country for a month.",
    wantGuardrail: true
  },
  {
    name: "British/Indian English double-l spelling",
    content: "I-485 pending, is travelling to London okay?",
    wantGuardrail: true
  },

  // --- The profile-derived augmentation. Somebody who filed eight months ago does
  // --- not mention the form number; the case is background to them by now.
  {
    name: "pending I-485 known only from the profile, bare travel question",
    content: "Can I go home for two weeks in December?",
    i485Filed: true,
    wantGuardrail: true
  },
  {
    // Nothing in this sentence identifies an immigration situation and the profile
    // shows no pending case, so the turn resolves `unmatched` and the streaming path
    // returns the clarifying question instead of an answer. Not guarded, but not
    // unguarded either — nothing is generated to need guarding.
    name: "same question, no pending I-485 on file — clarifies rather than answers",
    content: "Can I go home for two weeks in December?",
    i485Filed: false,
    wantGuardrail: false,
    wantResolution: "unmatched"
  },

  // --- Follow-ups. The topic carries one user turn back, so a bare follow-up in a
  // --- travel thread still has to be guarded.
  {
    name: "follow-up in an established travel thread",
    content: "And what if I only go for four days?",
    history: [
      { role: "user", content: "My I-485 is pending and I want to travel to India." },
      { role: "assistant", content: "Travel while an I-485 is pending depends on approved advance parole..." }
    ],
    wantGuardrail: true
  },

  // --- The vocabulary that always worked. These must keep working.
  { name: "explicit advance parole", content: "Do I need advance parole before I travel with a pending I-485?", wantGuardrail: true },
  { name: "explicit I-131", content: "My I-131 is pending and my I-485 is pending, can I leave?", wantGuardrail: true },
  { name: "visa stamp / reentry", content: "I-485 pending, my visa stamp expired — what about reentry?", wantGuardrail: true },

  // --- False positives from the old unanchored "ap". Both of these used to fire
  // --- the travel guardrail because "ap" matched inside an ordinary word.
  {
    name: "'what happens' must not trigger travel (old bare-ap bug)",
    content: "I-485 pending — what happens to my case if I change jobs?",
    wantGuardrail: false
  },
  {
    name: "'paperwork' must not trigger travel (old bare-ap bug)",
    content: "My I-485 paperwork is stuck at the service center, is that normal?",
    wantGuardrail: false
  },

  // --- Genuinely unrelated questions.
  { name: "PERM timing", content: "How long does PERM take these days for EB-2?", wantGuardrail: false },
  { name: "H-1B transfer, no travel", content: "What does a new employer have to file for an H-1B transfer?", wantGuardrail: false }
];

async function main() {
  const { routeAdvisorQuestion } = await import("@/lib/advisor/service");

  let pass = 0;
  const failures: string[] = [];

  for (const testCase of CASES) {
    const route = routeAdvisorQuestion({
      content: testCase.content,
      history: testCase.history ?? [],
      i485Filed: testCase.i485Filed ?? false
    });

    // An unmatched turn never reaches generation, so a guardrail selected for it is
    // not a guardrail the user reads.
    const got = route.resolution !== "unmatched" && route.guardrailIds.includes("GR_I485_TRAVEL");
    const resolutionOk =
      testCase.wantResolution == null || route.resolution === testCase.wantResolution;
    const ok = got === testCase.wantGuardrail && resolutionOk;

    const detail = [
      `resolution=${route.resolution}`,
      route.travelAugmented ? "augmented-from-profile" : null,
      `topics=${route.topics.join(",")}`
    ]
      .filter(Boolean)
      .join(" ");

    console.log(
      `${ok ? "PASS" : "FAIL"}  ${testCase.name}\n` +
        `      "${testCase.content}"\n` +
        `      GR_I485_TRAVEL: got ${got}, want ${testCase.wantGuardrail}  [${detail}]`
    );

    if (ok) {
      pass += 1;
    } else {
      failures.push(testCase.name);
    }
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);

  if (failures.length > 0) {
    console.log("\nFailed:");
    for (const name of failures) console.log(`  - ${name}`);
    console.log(
      "\nBefore narrowing the pattern to make these pass, re-read the header of this file.\n" +
        "A missing advance-parole warning is not a test-tuning problem."
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

/**
 * Regression check for long-term memory extraction.
 *
 * The asymmetry here is the opposite of the travel gate, and it matters.
 *
 * For a safety guardrail, over-triggering is the right failure mode: an extra
 * warning costs tokens, a missing one can cost somebody their status. For memory
 * it is reversed. A missed fact costs the user one sentence — they restate it. A
 * *wrongly* remembered fact is attached to them indefinitely, shapes every future
 * answer, and is worse the longer it goes unnoticed. So this suite spends most of
 * its cases proving what is NOT remembered.
 *
 * The other rule under test: extraction stores the user's sentence verbatim and
 * never a parsed value. "March 3rd" must never become a date — a misparse would
 * become a permanently wrong deadline in a product where the deadline is the whole
 * question.
 */

export {};

type Case = {
  name: string;
  message: string;
  /** Quotes expected, or [] for "must remember nothing". */
  want: string[];
  wantKind?: string;
};

const CASES: Case[] = [
  // --- Worth remembering. Each is something a user states once and would
  // --- otherwise have to repeat in every later conversation.
  {
    name: "termination date — the fact that starts the 60-day clock",
    message: "My last day was March 3rd. I'm trying to work out what to do next.",
    want: ["My last day was March 3rd."],
    wantKind: "employment"
  },
  {
    name: "layoff stated plainly",
    message: "I was laid off on Friday.",
    want: ["I was laid off on Friday."],
    wantKind: "employment"
  },
  {
    name: "filing event",
    message: "My I-140 was approved in January.",
    want: ["My I-140 was approved in January."],
    wantKind: "filing"
  },
  {
    name: "status change",
    message: "I am now on H-4 while we sort this out.",
    want: ["I am now on H-4 while we sort this out."],
    wantKind: "status"
  },
  {
    name: "new employer",
    message: "I started at a new employer last month.",
    want: ["I started at a new employer last month."],
    wantKind: "status"
  },

  // --- Must NOT be remembered. This is the important half.
  {
    name: "a question about the same subject states nothing",
    message: "When is my last day supposed to be?",
    want: []
  },
  {
    name: "question form without a question mark",
    message: "What happens if my I-140 was approved but my employer withdraws it",
    want: []
  },
  {
    name: "hypothetical, not a fact about this user",
    message: "If someone was laid off, how long do they have?",
    want: []
  },
  {
    name: "general rules question",
    message: "How does the 60-day grace period work?",
    want: []
  },
  {
    name: "asking about the visa bulletin",
    message: "What does the current visa bulletin mean for EB-2 India?",
    want: []
  },
  {
    name: "a follow-up chip must never become a memory",
    message: "What has to be filed before day 60, and who files it?",
    want: []
  },
  {
    name: "gratitude and chatter",
    message: "Thanks, that was really helpful.",
    want: []
  },

  // --- Verbatim storage.
  {
    name: "stores the sentence, never a parsed date",
    message: "My termination date is 3 March 2026.",
    want: ["My termination date is 3 March 2026."]
  },
  {
    name: "one sentence per fact, not the whole paragraph",
    message:
      "I was laid off on Friday. I have an offer from another company but they haven't filed anything yet. What should I do?",
    want: ["I was laid off on Friday."]
  }
];

async function main() {
  const { extractFacts } = await import("@/lib/advisor/memory");

  let pass = 0;
  const failures: string[] = [];

  for (const testCase of CASES) {
    const facts = extractFacts(testCase.message);
    const quotes = facts.map((fact) => fact.quote);

    const quotesMatch =
      quotes.length === testCase.want.length && testCase.want.every((want, i) => quotes[i] === want);
    const kindMatch = testCase.wantKind == null || facts[0]?.kind === testCase.wantKind;
    const ok = quotesMatch && kindMatch;

    console.log(
      `${ok ? "PASS" : "FAIL"}  ${testCase.name}\n` +
        `      in:  "${testCase.message}"\n` +
        `      out: ${quotes.length === 0 ? "(nothing remembered)" : quotes.map((q) => `"${q}"`).join(", ")}` +
        `${testCase.wantKind ? ` [${facts[0]?.kind ?? "none"}]` : ""}`
    );

    if (ok) {
      pass += 1;
    } else {
      failures.push(testCase.name);
      console.log(`      want: ${testCase.want.length === 0 ? "(nothing)" : testCase.want.map((q) => `"${q}"`).join(", ")}`);
    }
  }

  // Verbatim guarantee, asserted directly rather than inferred from the cases:
  // nothing extracted may differ from a substring of what the user actually wrote.
  const verbatimProbe = "My last day was March 3rd.";
  const extracted = (await import("@/lib/advisor/memory")).extractFacts(verbatimProbe);
  const verbatimOk = extracted.every((fact) => verbatimProbe.includes(fact.quote));
  console.log(`${verbatimOk ? "PASS" : "FAIL"}  stored quotes are verbatim substrings of the user's message`);
  if (verbatimOk) pass += 1;
  else failures.push("verbatim guarantee");

  console.log(`\n${pass} passed, ${failures.length} failed`);

  if (failures.length > 0) {
    console.log("\nFailed:");
    for (const name of failures) console.log(`  - ${name}`);
    console.log(
      "\nNote the asymmetry before 'fixing' this: a missed fact costs the user one sentence,\n" +
        "a wrongly remembered one follows them into every future answer. When in doubt, remember less."
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

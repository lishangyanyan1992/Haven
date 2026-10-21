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

  // --- An undated statement must never become a date.
  //
  // 2026-10-20: one remembered fact, "I was laid off", saved that morning with no
  // date. Asked "Until what date am I allowed to stay in the US on my current
  // status?", the Advisor said they were laid off "on 2026-10-20" and gave a grace
  // period ending 2026-12-19. It took the save date (also today) as the layoff
  // date. These cases pin each layer of the fix.
  const { mentionsWhen, renderFactsForPrompt } = await import("@/lib/advisor/memory");
  const { jobEndDateUnknown, statesJobEndDeadline } = await import("@/lib/advisor/service");

  const undated = { id: "f1", kind: "employment" as const, quote: "I was laid off", createdAt: "2026-10-20T03:00:00Z" };
  const dated = { id: "f2", kind: "employment" as const, quote: "My last day was March 3rd.", createdAt: "2026-10-20T03:00:00Z" };
  const rendered = renderFactsForPrompt([undated]).join("\n");

  const datedCases: Array<{ name: string; ok: boolean }> = [
    // Prompt wording.
    { name: "undated fact is marked as giving no date", ok: /gives NO date/.test(rendered) },
    {
      name: "save date is never written as if it were the event date",
      ok: !/^On [A-Z][a-z]{2} \d/m.test(rendered) && /when the user said it, not when it happened/.test(rendered)
    },
    {
      name: "prompt forbids counting a deadline from an undated fact and says to ask",
      ok: /do not compute a deadline/i.test(rendered) && /ask for it/i.test(rendered)
    },
    {
      name: "a dated fact is not marked undated, and gets no undated instruction",
      ok: !/NO date/.test(renderFactsForPrompt([dated]).join("\n"))
    },
    // Date detection on the user's sentence.
    { name: "'I was laid off' has no date", ok: !mentionsWhen("I was laid off") },
    { name: "'I may be laid off soon' has no date (may is a verb)", ok: !mentionsWhen("I may be laid off soon") },
    { name: "'laid off on Friday' has a date", ok: mentionsWhen("I was laid off on Friday.") },
    { name: "'last day was March 3rd' has a date", ok: mentionsWhen("My last day was March 3rd.") },
    { name: "'laid off 2 weeks ago' has a date", ok: mentionsWhen("I got laid off 2 weeks ago") },
    { name: "'last day was 10/02' has a date", ok: mentionsWhen("my last day was 10/02") },
    // When the Advisor must treat the job's end date as unknown.
    {
      name: "the 2026-10-20 case: only an undated remembered layoff → date unknown",
      ok: jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["Until what date am I allowed to stay in the US on my current status?"],
        rememberedFacts: [undated]
      })
    },
    {
      name: "a layoff date on file → known",
      ok: !jobEndDateUnknown({ layoffDateOnFile: "2026-09-30", userTexts: ["How long can I stay?"], rememberedFacts: [undated] })
    },
    {
      name: "the user gives the date in this conversation → known",
      ok: !jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["How long can I stay?", "My last day was October 2."],
        rememberedFacts: [undated]
      })
    },
    {
      name: "a dated remembered fact → known",
      ok: !jobEndDateUnknown({ layoffDateOnFile: null, userTexts: ["How long can I stay?"], rememberedFacts: [dated] })
    },
    {
      name: "'I was laid off, how long can I stay?' with no date anywhere → unknown",
      ok: jobEndDateUnknown({ layoffDateOnFile: null, userTexts: ["I was laid off, how long can I stay?"], rememberedFacts: [] })
    },
    {
      name: "no job loss at all → nothing to ask",
      ok: !jobEndDateUnknown({ layoffDateOnFile: null, userTexts: ["How does the visa bulletin work?"], rememberedFacts: [] })
    },
    // Review findings on PR #98.
    {
      name: "a date on another event in the same sentence does not date the layoff",
      ok: jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["I was laid off after my petition was approved on October 2. How long can I stay?"],
        rememberedFacts: []
      })
    },
    {
      name: "'furloughed on October 2' counts as a supplied date",
      ok: !jobEndDateUnknown({ layoffDateOnFile: null, userTexts: ["I was furloughed on October 2."], rememberedFacts: [] })
    },
    {
      name: "a newer 'started a new job' fact retires an old undated layoff",
      ok: !jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["Can I travel on my H-1B?"],
        rememberedFacts: [
          undated,
          { kind: "status", quote: "I started at a new employer last month.", createdAt: "2026-10-21T03:00:00Z" }
        ]
      })
    },
    {
      name: "an older 'new job' fact does not retire a newer layoff",
      ok: jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["How long can I stay?"],
        rememberedFacts: [
          undated,
          { kind: "status", quote: "I started at a new employer last month.", createdAt: "2026-01-01T00:00:00Z" }
        ]
      })
    },
    // Second review on PR #98.
    {
      name: "'When can I start a new job?' does not retire an undated layoff",
      ok: jobEndDateUnknown({ layoffDateOnFile: null, userTexts: ["When can I start a new job?"], rememberedFacts: [undated] })
    },
    {
      name: "'I have not started a new job' does not retire an undated layoff",
      ok: jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["I have not started a new job. How long can I stay?"],
        rememberedFacts: [undated]
      })
    },
    {
      name: "'I started at a new company' in this conversation retires an undated remembered layoff",
      ok: !jobEndDateUnknown({
        layoffDateOnFile: null,
        userTexts: ["I started at a new company last week. Can I travel?"],
        rememberedFacts: [undated]
      })
    },
    {
      name: "'laid off, effective October 2' counts as a supplied date",
      ok: !jobEndDateUnknown({ layoffDateOnFile: null, userTexts: ["I was laid off, effective October 2."], rememberedFacts: [] })
    },
    {
      name: "a guessed date next to an I-94 caveat is still caught",
      ok: statesJobEndDeadline("Your grace period ends on December 19, unless your I-94 expires sooner.")
    },
    // Backstop on the finished answer.
    {
      name: "'ends on Dec. 19' is not split apart at the abbreviation",
      ok: statesJobEndDeadline("Your grace period ends on Dec. 19. Plan around that.")
    },
    {
      name: "a real I-94 expiry date is not treated as a guess",
      ok: !statesJobEndDeadline("Your grace period cannot extend beyond your I-94 expiry on December 19.")
    },
    {
      name: "the answer actually given on 2026-10-20 is caught",
      ok: statesJobEndDeadline(
        "Because you reported being laid off on 2026-10-20, your 60-day grace period would end on 2026-12-19. You can stay until then."
      )
    },
    {
      name: "'until Dec 19' grace-period phrasing is caught",
      ok: statesJobEndDeadline("Your grace period runs until Dec 19, so you have 60 days.")
    },
    {
      name: "the right answer (counted from the last day, no date) is not flagged",
      ok: !statesJobEndDeadline(
        "Your grace period is up to 60 days from your last day of employment, or until your I-94 ends if that comes first. What was your last day?"
      )
    }
  ];

  // --- Found testing live on 2026-10-21: the Advisor asked for the last day, but
  // --- only behind "Show how this works". The ask must be where they can see it.
  const { settleUnknownJobEnd, UNKNOWN_JOB_END_ASK, UNKNOWN_JOB_END_CORRECTION } = await import("@/lib/advisor/service");
  const { splitAnswer } = await import("@/lib/advisor/answer-shape");
  const lead =
    "Generally: H-1B status normally allows up to six years of lawful stay in the U.S., and if you are laid off you generally have up to a 60-day grace period (or until your I-94 expires, whichever is earlier) to find a new employer, change status, or depart.";
  const hiddenAsk = [
    lead,
    "<!--details-->",
    "Key rules: your I-94 control date determines when your authorized stay ends unless extended. After a layoff you typically have up to 60 days of grace during which you may remain in the U.S. to find new work or seek a change of status, but you must stop working for the prior employer.",
    "",
    "What I don't know yet",
    "",
    "I do not know the date your employment ended. Everything after a job ends is counted from that date.",
    "Question: What was your last day of employment? (Also tell me your current I-94 end date if you know it.)"
  ].join("\n");
  const settledHidden = settleUnknownJobEnd(hiddenAsk, { jobEndUnknown: true, asksAboutTimeLeft: true });
  const visibleAfter = (text: string) => {
    const split = splitAnswer(text);
    return `${split.lead}\n${split.appended}`;
  };
  const withAsk = `${settledHidden.answer}\n\n${settledHidden.append ?? ""}`;

  datedCases.push(
    {
      name: "a last-day question only behind the toggle gets asked visibly",
      ok: settledHidden.append === UNKNOWN_JOB_END_ASK && /What was your last day/.test(visibleAfter(withAsk))
    },
    {
      name: "and the hidden copy is taken out, so it is asked once",
      ok: (withAsk.match(/last day of employment\?/g) ?? []).length === 1 && !/Question:/.test(withAsk)
    },
    {
      name: "a visible ask is left alone",
      ok:
        settleUnknownJobEnd(`${lead} What was your last day of employment?`, { jobEndUnknown: true, asksAboutTimeLeft: true })
          .append === null
    },
    {
      name: "an invented date gets the correction, which also stays visible",
      ok: (() => {
        const r = settleUnknownJobEnd(
          "Because you were laid off on 2026-10-20, your grace period ends on 2026-12-19.",
          { jobEndUnknown: true, asksAboutTimeLeft: true }
        );
        return r.append === UNKNOWN_JOB_END_CORRECTION && /I don't have it/.test(visibleAfter(`${r.answer}\n\n${r.append}`));
      })()
    },
    {
      name: "nothing is added when the last day is known",
      ok: settleUnknownJobEnd(hiddenAsk, { jobEndUnknown: false, asksAboutTimeLeft: true }).append === null
    }
  );

  for (const testCase of datedCases) {
    console.log(`${testCase.ok ? "PASS" : "FAIL"}  ${testCase.name}`);
    if (testCase.ok) pass += 1;
    else failures.push(testCase.name);
  }

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

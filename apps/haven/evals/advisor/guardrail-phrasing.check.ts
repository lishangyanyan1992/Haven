/**
 * Phrasing coverage for the safety gates that were never audited.
 *
 * The travel gate got this treatment after it shipped broken. The same exercise —
 * write out how real people say the thing, then execute the pattern against all of
 * them — was never run on CSPA, NIW denial, unauthorized work, CPT or OPT. Every
 * one of them turned out to have the same defect: a single narrow phrasing, silent
 * for most natural wordings, failing without an error.
 *
 * It also covers a second bug class found in the same audit: unanchored substrings
 * in topic classification. `opt`, `ead`, `cap` and `i-9` matched inside ordinary
 * words — "options", "deadline", "capital", "I-94" — so questions were routed to
 * the wrong topics. That is not just a guardrail problem: topics select which
 * source chunks are retrieved, and only six survive, so a layoff question
 * containing "options" and "deadline" was answered from student-employment
 * material. Nothing failed; the answer was just built on the wrong sources.
 *
 * Asserted against `routeAdvisorQuestion` — the function the streaming path calls
 * — never against a copy of the patterns.
 *
 * If a case here fails: do not narrow a pattern to make it pass. Over-triggering is
 * the intended failure mode for every gate in this file. An extra safety paragraph
 * costs tokens; a missing one can cost somebody their status, their case, or a
 * deadline that cannot be recovered.
 */

export {};

type Case = {
  name: string;
  content: string;
  /** Guardrail id that must be selected, or null for "must not be selected". */
  wantGuardrail: string | null;
  /** Topics that must NOT be present — used for the substring-bug cases. */
  forbidTopics?: string[];
};

const CASES: Case[] = [
  // ---------------------------------------------------------------- CSPA
  // Deadlines here cannot be recovered once missed.
  { name: "CSPA — canonical", content: "My daughter turns 21 in four months, what happens to her green card?", wantGuardrail: "GR_CSPA_AGE_OUT" },
  { name: "CSPA — 'will be 21'", content: "My son will be 21 before our priority date is current. What are we supposed to do?", wantGuardrail: "GR_CSPA_AGE_OUT" },
  { name: "CSPA — plural verb 'ages out' (one letter from the old pattern)", content: "My kid ages out next year and I don't know if we can do anything.", wantGuardrail: "GR_CSPA_AGE_OUT" },
  { name: "CSPA — no jargon at all", content: "My child is about to become too old to be included in our case.", wantGuardrail: "GR_CSPA_AGE_OUT" },
  { name: "CSPA — 21st birthday", content: "Our green card is nowhere near and my daughter's 21st birthday is in May.", wantGuardrail: "GR_CSPA_AGE_OUT" },

  // ---------------------------------------------------------- NIW refusal
  // Motion and appeal windows are short and easy to miss.
  { name: "NIW — canonical", content: "My NIW was denied, should I refile?", wantGuardrail: "GR_NIW_DENIAL" },
  { name: "NIW — 'said no'", content: "USCIS said no to my national interest waiver. What now?", wantGuardrail: "GR_NIW_DENIAL" },
  { name: "NIW — 'rejection'", content: "I got a rejection on my EB-2 NIW petition.", wantGuardrail: "GR_NIW_DENIAL" },
  { name: "NIW — 'turned down'", content: "They turned down my self-petition. What are my options?", wantGuardrail: "GR_NIW_DENIAL" },
  { name: "NIW — 'came back negative'", content: "My NIW came back negative last week.", wantGuardrail: "GR_NIW_DENIAL" },

  // -------------------------------------------------- Unauthorized work
  // The guardrail that refuses to help conceal facts from USCIS. It needed the
  // vocabulary of somebody who already knows they have a problem.
  { name: "unauthorized work — canonical", content: "I worked without authorization for two months, what do I do?", wantGuardrail: "GR_UNAUTHORIZED_WORK" },
  { name: "unauthorized work — freelance while EAD pending", content: "I did some freelance work while my EAD was still pending. Is that a problem?", wantGuardrail: "GR_UNAUTHORIZED_WORK" },
  { name: "unauthorized work — 'before my work permit arrived'", content: "I got paid by a client before my work permit arrived.", wantGuardrail: "GR_UNAUTHORIZED_WORK" },
  { name: "unauthorized work — under the table", content: "My employer paid me under the table while I waited for my EAD.", wantGuardrail: "GR_UNAUTHORIZED_WORK" },
  { name: "unauthorized work — asking whether to disclose", content: "Should I mention on the form that I worked a bit before my EAD came?", wantGuardrail: "GR_UNAUTHORIZED_WORK" },

  // -------------------------------------------------------------- CPT
  // The red-flag list is written for people who have been sold this by a school.
  { name: "CPT — canonical", content: "Is day 1 CPT safe?", wantGuardrail: "GR_CPT_DAY1" },
  { name: "CPT — school marketing, no acronym", content: "The school says I can start working from the first semester on my F-1. Is that legitimate?", wantGuardrail: "GR_CPT_DAY1" },
  { name: "CPT — 'work from day one'", content: "I'm on F-1 and this program says I can work from day one while studying.", wantGuardrail: "GR_CPT_DAY1" },

  // -------------------------------------------------------------- OPT
  { name: "OPT — canonical", content: "My OPT is pending, can I start work on Monday?", wantGuardrail: "GR_OPT_WORK_AUTHORIZATION" },
  { name: "OPT — 'before my card arrives'", content: "I'm on F-1 OPT and my employer wants me to start before my card arrives.", wantGuardrail: "GR_OPT_WORK_AUTHORIZATION" },

  // ------------------------------------------ Unanchored substring bugs
  // These questions must not be dragged into unrelated topics, because topics
  // decide which sources are retrieved.
  {
    name: "substring: 'options' must not mean OPT",
    content: "I was laid off last week. What are my options?",
    wantGuardrail: null,
    forbidTopics: ["student-status"]
  },
  {
    name: "substring: 'deadline' must not mean EAD",
    content: "What is the deadline to file my I-140?",
    wantGuardrail: null,
    forbidTopics: ["work-authorization"]
  },
  {
    name: "substring: 'I-94' must not match i-9",
    content: "My I-94 expires in March. Does that change my grace period?",
    wantGuardrail: null,
    forbidTopics: ["work-authorization"]
  },
  {
    name: "substring: 'capital' must not mean the H-1B cap",
    content: "Does moving to a role at a capital markets firm affect my PERM?",
    wantGuardrail: null,
    forbidTopics: ["h1b"]
  },
  {
    name: "substring: 'already' must not mean EAD",
    content: "I already filed my I-485. What comes next?",
    wantGuardrail: null,
    forbidTopics: ["work-authorization"]
  },
  {
    name: "the layoff follow-up chip must stay a layoff question",
    content: "What should I ask an immigration attorney about my options this week?",
    wantGuardrail: null,
    forbidTopics: ["student-status"]
  }
];

/**
 * The output-side version of the same bug class.
 *
 * `buildMandatorySafetyAddendum` decides whether the model already said the
 * mandatory thing, and appends it when it did not. Those checks run against the
 * *answer*, so a substring match there does not add a warning — it withholds one.
 *
 * `depart` matched inside "Department". "Department of Labor" and "Department of
 * State" appear in a large share of immigration answers, so their presence
 * convinced the check that fallback options had already been offered, and
 * FIX_FALLBACK_OPTIONS was suppressed on exactly the layoff answers that needed
 * it. Nothing errored, and the eval suite could not see it because the fixtures
 * happened not to name either agency.
 */
const ADDENDUM_CASES: Array<{ name: string; answer: string; wantFired: string; want: boolean }> = [
  {
    name: "'Department of Labor' must not suppress the fallback options",
    answer: "You were laid off. Confirm your dates with the Department of Labor before acting.",
    wantFired: "FIX_FALLBACK_OPTIONS",
    want: true
  },
  {
    name: "'Department of State' must not suppress the fallback options",
    answer: "The Department of State publishes the visa bulletin monthly, which is separate from your grace period.",
    wantFired: "FIX_FALLBACK_OPTIONS",
    want: true
  },
  {
    name: "a real departure discussion still counts as offered",
    answer:
      "Options include a change of status, premium processing if the employer offers it, or departure and consular return.",
    wantFired: "FIX_FALLBACK_OPTIONS",
    want: false
  }
];

async function main() {
  const { routeAdvisorQuestion, buildMandatorySafetyAddendum } = await import("@/lib/advisor/service");

  let pass = 0;
  const failures: string[] = [];

  for (const testCase of ADDENDUM_CASES) {
    const result = buildMandatorySafetyAddendum(
      "I was laid off last week, what should I do?",
      ["layoffs", "h1b"] as never,
      testCase.answer
    );
    const fired = result.fired.includes(testCase.wantFired);
    const ok = fired === testCase.want;

    console.log(
      `${ok ? "PASS" : "FAIL"}  ${testCase.name}\n` +
        `      answer: "${testCase.answer}"\n` +
        `      ${testCase.wantFired}: fired=${fired}, want=${testCase.want}`
    );

    if (ok) pass += 1;
    else failures.push(testCase.name);
  }

  for (const testCase of CASES) {
    const route = routeAdvisorQuestion({ content: testCase.content });
    const delivered = route.resolution !== "unmatched";

    const guardrailOk =
      testCase.wantGuardrail == null
        ? true
        : delivered && route.guardrailIds.includes(testCase.wantGuardrail);

    const leaked = (testCase.forbidTopics ?? []).filter((topic) => route.topics.includes(topic as never));
    const topicsOk = leaked.length === 0;
    const ok = guardrailOk && topicsOk;

    console.log(
      `${ok ? "PASS" : "FAIL"}  ${testCase.name}\n` +
        `      "${testCase.content}"\n` +
        `      topics=${route.topics.join(",") || "-"} guardrails=${route.guardrailIds.join(",") || "-"}`
    );
    if (!ok) {
      if (!guardrailOk) console.log(`      want guardrail: ${testCase.wantGuardrail}`);
      if (!topicsOk) console.log(`      leaked topics: ${leaked.join(",")}`);
    }

    if (ok) pass += 1;
    else failures.push(testCase.name);
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nFailed:");
    for (const name of failures) console.log(`  - ${name}`);
    console.log("\nRe-read the header before narrowing a pattern to make these pass.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});

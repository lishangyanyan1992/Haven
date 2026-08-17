/**
 * What the Advisor answers, and what it declines.
 *
 * The narrowing to two topics is a product commitment, not an implementation
 * detail, so it is asserted rather than trusted. Three things need holding:
 *
 * 1. The in-scope questions still reach generation. A scope gate that quietly
 *    swallowed layoff or visa-bulletin questions would be far worse than the
 *    breadth problem it was built to fix.
 *
 * 2. Bridge-status questions are in scope. They were the largest cluster in the
 *    intent corpus and routed nowhere at all — "can I switch to H-4 while I look
 *    for work?" matched no topic, fell to DEFAULT_TOPICS, and was answered as a
 *    generic adjustment question with no layoff guardrails. They are the reason
 *    the layoff topic was worth keeping over the alternatives.
 *
 * 3. Every redirect carries its safety fact. Declining a topic is only defensible
 *    if the user still leaves with the one thing they could otherwise learn too
 *    late. A redirect that degraded into "we don't cover that" would turn a
 *    deliberate scope decision into an abandonment, and it would do it silently,
 *    because nothing else in the suite reads this copy.
 *
 * ON THE OTHER SUITES: guardrail-phrasing.check.ts still asserts that a CSPA or
 * NIW question selects its guardrail, and those assertions still matter — the
 * redirect depends on the classifier recognising the topic in the first place.
 * What changed is why they matter: they now prove the question reaches the right
 * *redirect*, not the right answer.
 *
 * Run: npm run check:scope
 */

export {};

type ScopeCase = {
  question: string;
  /** null = must be answered; otherwise the area it must be declined as. */
  declinedAs: string | null;
};

const CASES: ScopeCase[] = [
  // ------------------------------------------------- In scope: "how do I stay?"
  { question: "I was laid off last week, what happens to my H-1B?", declinedAs: null },
  { question: "My position was affected in the restructuring. What now?", declinedAs: null },
  { question: "How do I work out my exact day-60 deadline?", declinedAs: null },
  { question: "What has to be filed before day 60, and who files it?", declinedAs: null },

  // Bridge status — the largest cluster in the corpus, previously routed nowhere.
  { question: "Can I switch to H-4 while I look for work?", declinedAs: null },
  { question: "Should I file a B-2 change of status after my grace period?", declinedAs: null },
  { question: "What is the 240-day rule?", declinedAs: null },
  { question: "My H-1B extension is pending — can I keep working?", declinedAs: null },

  // ------------------------------------ In scope: "where am I in the green card line?"
  { question: "What does this month's visa bulletin mean for my priority date?", declinedAs: null },
  { question: "Can I file my I-485 this month under Dates for Filing?", declinedAs: null },
  { question: "Has my priority date retrogressed?", declinedAs: null },

  // In scope: the product answering for itself.
  { question: "What do you know about me?", declinedAs: null },

  // ------------------------------------------------------------- Declined areas
  { question: "Can I travel to India with a pending I-485?", declinedAs: "travel" },
  { question: "I need to fly home for my father's funeral, my I-485 is pending", declinedAs: "travel" },
  { question: "My OPT is pending, can I start work on Monday?", declinedAs: "student-status" },
  { question: "Is day 1 CPT safe?", declinedAs: "student-status" },
  { question: "Can I use AC21 to change jobs with an approved I-140?", declinedAs: "job-change" },
  { question: "My daughter turns 21 in four months, what happens to her green card?", declinedAs: "cspa" },
  { question: "My NIW was denied, should I refile?", declinedAs: "self-petition" },
  { question: "What is my PERM status and how long does labor certification take?", declinedAs: "perm" },
  { question: "I worked without authorization for two months, what do I do?", declinedAs: "work-authorization" },

  // ------------------------------------------------------------------ Precedence
  // A question raising two declined areas gets the one whose deadline is least
  // recoverable.
  {
    question: "My NIW was denied and my daughter ages out next year.",
    declinedAs: "cspa"
  },
  // An out-of-scope area wins over an in-scope one. Answering the layoff half and
  // dropping the travel half is exactly the partial coverage this gate exists to
  // prevent.
  {
    question: "I was laid off and I need to travel with my I-485 pending.",
    declinedAs: "travel"
  },

  // Precedence bugs found by reconciling the eval fixtures against the live
  // decision. All three sent a question to a redirect that answered something the
  // user had not asked.
  //
  // A student asking about a pending OPT application raises work-authorization
  // too. Sending them the "you worked without permission" redirect answers an
  // accusation they did not make, and withholds the fact they need.
  {
    question: "My OPT application has been pending for 95 days and my employer wants me to start. Can I work?",
    declinedAs: "student-status"
  },
  // A question about the user's own uploaded documents that happens to name PERM
  // is not a PERM question. It never says "Haven", which is why it used to be one.
  {
    question: "I uploaded my I-797, PERM filing receipt and I-140 approval. Which dates matter most if layoffs start?",
    declinedAs: null
  },
  // But a question genuinely about PERM stays declined, even though it also
  // raises H-1B. This is the case that broke when PERM was allowed to yield to
  // any in-scope topic rather than only to the product topic.
  {
    question: "My employer started PERM in January 2026 and recruitment is done. My H-1B max-out date is in March.",
    declinedAs: "perm"
  }
];

/** Each redirect must still hand over the fact its user could learn too late. */
const SAFETY_FACTS: Array<{ id: string; name: string; must: RegExp }> = [
  { id: "MSG_SCOPE_TRAVEL", name: "travel keeps the I-485 abandonment warning", must: /abandon/i },
  { id: "MSG_SCOPE_TRAVEL", name: "travel keeps 'pending AP is not permission'", must: /pending advance parole[^.]*not itself permission/i },
  { id: "MSG_SCOPE_STUDENT", name: "student keeps 'pending OPT is not work authorization'", must: /pending opt.*not permission to work/i },
  { id: "MSG_SCOPE_STUDENT", name: "student keeps the I-20/DSO rule for CPT", must: /i-20/i },
  { id: "MSG_SCOPE_JOB_CHANGE", name: "AC21 keeps the 180-day precondition", must: /180 days/i },
  { id: "MSG_SCOPE_CSPA", name: "CSPA conveys that the deadline can pass while they look", must: /deadline can pass|this week/i },
  { id: "MSG_SCOPE_SELF_PETITION", name: "NIW keeps the deadline warning", must: /deadline/i },
  { id: "MSG_SCOPE_UNAUTHORIZED_WORK", name: "unauthorized work keeps the refusal to conceal", must: /won't help|hides anything/i },
  { id: "MSG_SCOPE_UNAUTHORIZED_WORK", name: "unauthorized work keeps 'stop and preserve records'", must: /stop any work/i }
];

async function main() {
  const { routeAdvisorQuestion } = await import("@/lib/advisor/service");
  const { decideScope, REDIRECTED } = await import("@/lib/advisor/scope");
  const { guardrailText, getGuardrail } = await import("@/lib/advisor/guardrail-registry");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  for (const testCase of CASES) {
    const route = routeAdvisorQuestion({ content: testCase.question });
    // Mirrors the streaming path: the same topics, and travel detected from the
    // same text. Asserting through decideScope rather than a copy of its rules is
    // the point — a scope decision asserted against a duplicate would drift.
    const travelMentioned = /(travel|advance parole|\bap\b|i-?131|visa stamp|stamping|re-?entry|\bfly)/i.test(
      testCase.question
    );
    const decision = decideScope(route.topics, travelMentioned);

    const actual = decision.inScope ? null : decision.area;
    const ok = actual === testCase.declinedAs;

    check(
      `${testCase.declinedAs == null ? "answers" : `declines as ${testCase.declinedAs}`} — "${testCase.question.slice(0, 46)}"`,
      ok,
      `topics=${route.topics.join(",") || "-"} decision=${actual ?? "in scope"}`
    );
  }

  for (const fact of SAFETY_FACTS) {
    check(fact.name, fact.must.test(guardrailText(fact.id)), fact.id);
  }

  // Every declined topic needs a message, and every message needs to exist. A
  // missing id would throw at request time, on a question the product has already
  // decided it cannot answer — the worst moment to fail.
  for (const [topic, id] of Object.entries(REDIRECTED)) {
    let resolves = true;
    try {
      getGuardrail(id);
    } catch {
      resolves = false;
    }
    check(`redirect for ${topic} resolves to a real entry`, resolves, id);
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

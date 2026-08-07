/**
 * Guardrail registry and option-coverage check.
 *
 * Run with: npm run check:guardrails  (from apps/haven)
 *
 * Two jobs:
 *
 * 1. **Integrity (CD-13.1).** Ids unique and stable-looking, no empty text, every
 *    `once-per-thread` model-audience entry carries a `deliveredWhen` pattern (an
 *    entry the thread cannot recognise can never be suppressed, which would make
 *    CD-13.4 silently inert). Failures exit non-zero.
 *
 * 2. **Reporting.** Which guardrails have never had domain review, and which
 *    offered options have no sourced attributes (CD-13.3). These print as a gap
 *    report and do NOT fail the run — they describe honest current state, and a
 *    check that fails on day one gets disabled on day two.
 */

import { allGuardrails, guardrailText, resolveGuardrails } from "../../src/lib/advisor/guardrail-registry";
import { buildThreadState } from "../../src/lib/advisor/thread-state";
import { LAYOFF_OPTIONS, unsourcedAttributes } from "../../src/lib/advisor/layoff-options";
import { trustedKnowledgeDocuments } from "../../src/lib/advisor/source-corpus";

const failures: string[] = [];

// --- 1. Registry integrity -------------------------------------------------

const entries = allGuardrails();
const seen = new Set<string>();

for (const entry of entries) {
  if (seen.has(entry.id)) failures.push(`Duplicate guardrail id: ${entry.id}`);
  seen.add(entry.id);

  if (!entry.text.trim()) failures.push(`${entry.id}: empty text`);
  if (!entry.intent.trim()) failures.push(`${entry.id}: missing intent`);

  if (entry.repeat === "once-per-thread" && entry.audience === "model" && !entry.deliveredWhen) {
    failures.push(
      `${entry.id}: once-per-thread model entry needs a deliveredWhen pattern, or it can never be recognised as delivered`
    );
  }
}

// --- 2. Option attribute coverage (CD-13.3) --------------------------------

const documentSlugs = new Set(trustedKnowledgeDocuments.map((document) => document.slug));

for (const option of LAYOFF_OPTIONS) {
  for (const attribute of option.attributes) {
    if (attribute.sourced && !documentSlugs.has(attribute.sourced.documentSlug)) {
      failures.push(`${option.id}: cites unknown document slug "${attribute.sourced.documentSlug}"`);
    }
    if (!attribute.sourced && !attribute.unsourced) {
      failures.push(`${option.id}: attribute "${attribute.question}" is neither sourced nor recorded as unsourced`);
    }
  }
}

// --- 3. Behaviour (CD-13.2, CD-13.4) ---------------------------------------
//
// These assert on guardrail *ids*, which is the point of the registry: a prompt
// reword cannot make them pass or fail. They are deliberately not derived from the
// eval fixtures — CD-12.11 wants a held-out set that tuning never sees.

// Stand-in matcher. The real classifier is `detectTopics`; these probes only need
// something that separates recognisable text from unrecognisable text.
const matches = (text: string) => /(h-?1b|opt|i-485|laid off|priority date)/i.test(text.toLowerCase());

const expect = (name: string, actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
};

const firstMiss = buildThreadState({ currentMatched: false, previousMatched: false, history: [], matches });
expect("first unrecognized turn asks rather than guesses", [firstMiss.resolution, firstMiss.consecutiveMisses], [
  "unmatched",
  1
]);

const secondMiss = buildThreadState({
  currentMatched: false,
  previousMatched: false,
  history: [
    { role: "user", content: "is my situation normal?" },
    { role: "assistant", content: "..." }
  ],
  matches
});
expect("second consecutive miss reaches the escalation threshold", secondMiss.consecutiveMisses >= 2, true);

const followUp = buildThreadState({
  currentMatched: false,
  previousMatched: true,
  history: [{ role: "user", content: "I was laid off from my H-1B job" }],
  matches
});
expect("a follow-up to an understood turn is not a miss", [followUp.resolution, followUp.consecutiveMisses], [
  "carried",
  0
]);

const layoffIds = ["GR_LAYOFF_SAFETY_RULES", "GR_LAYOFF_OPTION_MENU"];
expect("first layoff turn fires both guardrails", resolveGuardrails(layoffIds, new Set()).fired, layoffIds);

const afterMenu = buildThreadState({
  currentMatched: true,
  previousMatched: true,
  history: [
    { role: "user", content: "I was laid off" },
    {
      role: "assistant",
      content:
        "You could look at a change of status such as B-2, or departure planning with a consular return, or ask about premium processing with your employer."
    }
  ],
  matches
});
expect("an answer that listed the options counts as delivering the menu", afterMenu.delivered.has("GR_LAYOFF_OPTION_MENU"), true);

const secondLayoffTurn = resolveGuardrails(layoffIds, afterMenu.delivered);
expect(
  "second layoff turn keeps the safety rules and drops the menu",
  [secondLayoffTurn.fired, secondLayoffTurn.suppressed],
  [["GR_LAYOFF_SAFETY_RULES"], ["GR_LAYOFF_OPTION_MENU"]]
);

const afterFix = buildThreadState({
  currentMatched: true,
  previousMatched: true,
  history: [{ role: "assistant", content: `earlier answer\n\n${guardrailText("FIX_FALLBACK_OPTIONS")}` }],
  matches
});
expect(
  "hard safety lines repeat even when the option list is suppressed",
  (() => {
    const resolved = resolveGuardrails(["FIX_NO_UNAUTHORIZED_WORK", "FIX_FALLBACK_OPTIONS"], afterFix.delivered);
    return [resolved.fired, resolved.suppressed];
  })(),
  [["FIX_NO_UNAUTHORIZED_WORK"], ["FIX_FALLBACK_OPTIONS"]]
);

// --- Reports ---------------------------------------------------------------

const unreviewed = entries.filter((entry) => entry.lastReviewedBy === null);
const gaps = unsourcedAttributes();
const layoffDocs = trustedKnowledgeDocuments.filter((document) => document.topic === "layoffs");

console.log(`Guardrail registry: ${entries.length} entries`);
console.log(`  model-facing: ${entries.filter((e) => e.audience === "model").length}`);
console.log(`  user-facing:  ${entries.filter((e) => e.audience === "user").length}`);
console.log(`  once-per-thread: ${entries.filter((e) => e.repeat === "once-per-thread").length}`);

console.log(`\nAwaiting domain review: ${unreviewed.length}/${entries.length}`);
if (unreviewed.length > 0) {
  console.log("  (set lastReviewedBy/lastReviewedAt once immigration counsel has read the wording)");
}

console.log(`\nOption attributes with no supporting document: ${gaps.length}`);
for (const gap of gaps) {
  console.log(`  - ${gap.optionId} — "${gap.question}"`);
  console.log(`      ${gap.reason}`);
}

console.log(`\nOfficial 'layoffs' documents in the corpus: ${layoffDocs.length}`);
if (layoffDocs.length === 0) {
  console.log("  The Advisor offers five post-layoff options and has no official layoffs document behind them.");
  console.log("  The supported statements above are borrowed from h1b-topic documents. This is the CD-13.3 gap.");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log("\n✓ registry integrity OK");

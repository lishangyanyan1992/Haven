/**
 * Official-source retrieval check.
 *
 * Run with: npm run check:source-retrieval  (from apps/haven)
 *
 * Official sources are ranked by word overlap plus topic-specific boosts, with no
 * embeddings. Nothing checked that the right regulation actually came back, so a
 * ranking change could quietly drop the grace-period rule from every layoff
 * answer and every other check would stay green.
 *
 * Each case is a representative question and the official document that must be
 * among the six passages retrieved for it. Topics come from the real keyword
 * router, so a routing regression shows up here too. Deterministic: no network,
 * no model calls. Exits non-zero on any miss.
 *
 * Adding a case: pick the document slug from `source-corpus.ts`
 * (`trustedKnowledgeDocuments[].slug`). If a question needs two sources, add two
 * cases rather than loosening one.
 */

export {};

for (const key of ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_PUBLIC_KEY"]) {
  delete process.env[key];
}

interface RetrievalCase {
  question: string;
  expected: string;
  why: string;
}

const CASES: RetrievalCase[] = [
  // Layoffs and the 60-day grace period — the core in-scope path.
  { question: "I was laid off last week, what happens to my H-1B?", expected: "ecfr-214-1-grace-period", why: "the 60-day grace period regulation" },
  { question: "I was laid off last week, what happens to my H-1B?", expected: "uscis-nonimmigrant-worker-termination-options", why: "USCIS options after termination" },
  { question: "How long is the grace period after my H-1B employment ends?", expected: "ecfr-214-1-grace-period", why: "grace period length" },
  { question: "My employer terminated me. What are my options to stay in the US?", expected: "uscis-nonimmigrant-worker-termination-options", why: "options after termination" },

  // H-1B portability (start work on a new petition).
  { question: "Can I start working for a new employer as soon as they file my H-1B transfer?", expected: "ecfr-214-2-h1b-portability", why: "H-1B portability on filing" },
  { question: "What is a specialty occupation for H-1B?", expected: "uscis-h1b-specialty-occupations-overview", why: "H-1B basics" },

  // Bridge status / change of status.
  { question: "Should I file a B-2 change of status after my grace period?", expected: "ecfr-248-change-of-status", why: "change of status regulation" },
  { question: "Can I switch to H-4 while I look for work?", expected: "ecfr-248-change-of-status", why: "change to dependent status" },
  { question: "What is the 240-day rule?", expected: "ecfr-248-change-of-status", why: "pending change of status" },

  // AC21 job portability (high risk: a wrong answer means unauthorised work).
  { question: "Can I use AC21 to change jobs with my I-485 pending over 180 days?", expected: "uscis-ac21-job-portability-policy", why: "AC21 policy manual" },
  { question: "Can I use AC21 to change jobs with my I-485 pending over 180 days?", expected: "uscis-i485-supplement-j-job-portability", why: "Supplement J" },
  { question: "Is a product manager role same or similar to software engineer for AC21?", expected: "uscis-same-or-similar-ac21", why: "same-or-similar test" },

  // USCIS adjustment filing charts (high risk: wrong chart means filing too early).
  { question: "Can I file my I-485 this month under Dates for Filing?", expected: "uscis-adjustment-filing-charts", why: "which chart USCIS accepts" },
  { question: "Which chart does USCIS use this month, final action or dates for filing?", expected: "uscis-adjustment-filing-charts", why: "chart selection" },
  { question: "What does this month's visa bulletin mean for my priority date?", expected: "uscis-adjustment-filing-charts", why: "bulletin and filing charts" },

  // Travel with a pending I-485 (high risk: abandonment).
  { question: "Can I travel to India with a pending I-485?", expected: "uscis-i485-pending-travel", why: "travel while pending" },
  { question: "Do I need advance parole to travel while my green card is pending?", expected: "uscis-adjustment-filing-instructions-travel", why: "advance parole rules" },

  // Other declined-but-reachable areas, and adjustment bars.
  { question: "My daughter turns 21 in four months, will CSPA protect her?", expected: "uscis-cspa-policy-manual", why: "CSPA age calculation" },
  { question: "What is the Dhanasar test for a national interest waiver?", expected: "uscis-niw-policy-manual", why: "NIW standard" },
  { question: "I worked without authorization for two months, does that bar my adjustment?", expected: "uscis-unauthorized-employment-adjustment", why: "unauthorized employment bar" },
  { question: "How does the PERM labor certification process work?", expected: "dol-perm-program-overview", why: "PERM" },
  { question: "Is day 1 CPT safe?", expected: "dhs-curricular-practical-training", why: "CPT rules" },
  { question: "Does public charge affect my green card application?", expected: "fr-public-charge-rescission-rule", why: "public charge rule" }
];

const TOP_K = 6;

async function main() {
  const svc = await import("@/lib/advisor/service");
  const { trustedKnowledgeDocuments } = await import("@/lib/advisor/source-corpus");
  const known = new Set(trustedKnowledgeDocuments.map((document) => document.slug));

  const failures: string[] = [];

  for (const testCase of CASES) {
    if (!known.has(testCase.expected)) {
      failures.push(`unknown document slug "${testCase.expected}" (case: ${testCase.question})`);
      continue;
    }

    const topics = svc.routeAdvisorQuestion({ content: testCase.question }).topics;
    const chunks = await svc.retrieveKnowledge(testCase.question, topics);
    const retrieved = chunks.slice(0, TOP_K).map((chunk) => chunk.chunkKey.split(":")[0]);

    if (!retrieved.includes(testCase.expected)) {
      failures.push(
        [
          `"${testCase.question}"`,
          `    expected ${testCase.expected} (${testCase.why}) in top ${TOP_K}`,
          `    topics   ${topics.join(", ")}`,
          `    got      ${[...new Set(retrieved)].join(", ") || "(nothing)"}`
        ].join("\n")
      );
    }
  }

  console.log(`source retrieval: ${CASES.length - failures.length}/${CASES.length} cases retrieved the expected source`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`  FAIL ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

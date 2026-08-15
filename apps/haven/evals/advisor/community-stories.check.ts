/**
 * "What did people like me do?" — stories and statistics, and the gap between them.
 *
 * Outcome statistics and community stories answer the same user question, and they
 * were gated by two different predicates. That produced three failures, all quiet:
 *
 * 1. "I was laid off, what are my options?" fetched statistics and no stories. When
 *    the segment was too thin for statistics, the block rendered NO_STATS and the
 *    user got nothing human at all — no numbers, no experiences, just a hand-off.
 *    The person in the rarest segment, often the most worried, got the least.
 * 2. "What did other people in my situation do?" — the plainest phrasing of the
 *    whole feature — matched neither gate and returned nothing. `others in` needed
 *    those two words adjacent, and the statistics gate wanted "what do/should/can",
 *    never "what did".
 * 3. NO_STATS instructed the model to say there was nothing, even when relevant
 *    stories had in fact been retrieved and were sitting in the prompt above it.
 *
 * The principle the fix encodes: a thin segment is a reason not to quote *rates*,
 * not a reason to withhold everything. Statistics need a minimum sample before a
 * percentage means anything — that is what the tier gate protects. A story needs
 * no sample. One person's experience is honestly one person's experience, and
 * saying so is not a statistical claim.
 *
 * What must NOT change: stories stay anecdote. Every retrieved item carries its
 * legal caveat, the system prompt forbids treating them as authoritative, and the
 * tier gate on percentages is untouched. This suite guards that too.
 */

export {};

/**
 * What a story is allowed to be, and what it may be called.
 *
 * Three defects found by reading one real answer, all of which made the product
 * look like it was citing itself:
 *
 * 1. Story titles were prefixed with the container they were read from — "Layoff
 *    War Room: Day 1 after layoff", "EB-2 India | Approved I-140 | Layoff watch:
 *    Used B-2 as a bridge". The first is a page in this product and the second is
 *    a segment filter. The model cited both as sources.
 * 2. The seed corpus is built from the same snapshot the live path reads, so every
 *    post arrived twice — once prefixed, once not. Nothing deduplicated them,
 *    and the model reported "two posts titled ...", implying two people had the
 *    same experience.
 * 3. Two corpus entries were editorial summaries *about* Haven content ("Layoff
 *    first-week triage from war room posts") rather than anybody's account of
 *    what happened to them, sitting in the same list and inheriting the same
 *    credibility.
 */
async function checkStoryProvenance(
  check: (name: string, ok: boolean, detail: string) => void
) {
  const { curatedCommunitySummaries, buildFallbackCommunitySummaries } = await import("@/lib/advisor/source-corpus");
  const { havenSnapshot } = await import("@/lib/repositories/mock-data");

  const stories = buildFallbackCommunitySummaries();

  // Names of product surfaces, taken from the snapshot rather than hardcoded, so
  // renaming a cohort or a war room cannot quietly retire this assertion.
  const surfaceNames = [havenSnapshot.warRoom.name, ...havenSnapshot.cohorts.map((c) => c.name)];
  const prefixed = stories.filter((story) => surfaceNames.some((name) => story.title.startsWith(`${name}:`)));
  check(
    "story titles never carry a Haven surface or cohort name",
    prefixed.length === 0,
    prefixed.length === 0 ? `checked ${stories.length} stories against ${surfaceNames.length} surface names` : `prefixed: ${prefixed.map((s) => s.title).join(" | ")}`
  );

  const bodies = stories.map((s) => s.summary.trim().toLowerCase().slice(0, 200));
  const duplicated = bodies.filter((body, index) => bodies.indexOf(body) !== index);
  check(
    "no story body appears twice in the fallback pool",
    duplicated.length === 0,
    duplicated.length === 0 ? `${stories.length} stories, ${new Set(bodies).size} distinct bodies` : `${duplicated.length} duplicate bodies`
  );

  // A story is one person's account. An aggregate has no person in it, and the
  // giveaway is that it describes what "members" or "posts" collectively did.
  const aggregatePattern = /\b(members|posts|users|people) (nearing|consistently|generally|typically|often|usually)\b|\bfrom (war room|community) posts\b/i;
  const aggregates = curatedCommunitySummaries.filter(
    (item) => aggregatePattern.test(item.summary) || aggregatePattern.test(item.title)
  );
  check(
    "curated community summaries contain no editorial aggregates",
    aggregates.length === 0,
    aggregates.length === 0
      ? `${curatedCommunitySummaries.length} curated entries, none aggregate`
      : `aggregates: ${aggregates.map((a) => a.title).join(" | ")}`
  );
}

async function main() {
  const { wantsCommunityStories, wantsCaseOutcomeStats } = await import("@/lib/advisor/service");
  const { renderStatsForPrompt } = await import("@/lib/advisor/case-stats");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const layoffs = ["layoffs", "h1b"] as never;

  // --- The phrasings people actually use for this question ------------------
  const shouldGetStories = [
    "I was laid off — what did other people in my situation do?",
    "What did others do after a layoff?",
    "How did people in my situation handle the 60 days?",
    "I was laid off on Friday. What are my options?",
    "What should I do now that I've been laid off?",
    "Has anyone else been through this after a layoff?",
    "What worked for other H-1B people who got laid off?",
    "How long did an H-1B transfer take for people like me?"
  ];

  for (const query of shouldGetStories) {
    check(
      "story-worthy question retrieves stories",
      wantsCommunityStories(query, layoffs),
      `stories=${wantsCommunityStories(query, layoffs)} stats=${wantsCaseOutcomeStats(query, layoffs)}\n      "${query}"`
    );
  }

  // --- Questions that are not asking about other people ---------------------
  const shouldNotGetStories = [
    "What is the legal definition of a specialty occupation?",
    "Which form does my employer file for an H-1B transfer?"
  ];

  for (const query of shouldNotGetStories) {
    check(
      "non-experiential question does not pull stories",
      !wantsCommunityStories(query, ["h1b"] as never),
      `stories=${wantsCommunityStories(query, ["h1b"] as never)}\n      "${query}"`
    );
  }

  // --- Statistics and stories must never disagree about firing --------------
  // Anything that gets outcome statistics must also get stories, or a thin
  // segment leaves the user with nothing.
  for (const query of shouldGetStories) {
    if (!wantsCaseOutcomeStats(query, layoffs)) continue;
    check(
      "anything asking for outcome stats also gets stories",
      wantsCommunityStories(query, layoffs),
      `"${query}"`
    );
  }

  // --- NO_STATS must use stories when stories exist -------------------------
  const tier0 = {
    tier: "tier0" as const,
    totalN: 4,
    segmentLabel: "H-1B, India, I-140 approved, laid off",
    widened: false,
    recencyMonths: 24,
    showOutcomes: false,
    paths: [],
    caveat: ""
  };

  const withoutStories = renderStatsForPrompt(tier0, false);
  const withStories = renderStatsForPrompt(tier0, true);

  check(
    "NO_STATS still forbids numbers in both cases",
    /DO NOT invent numbers/i.test(withoutStories) && /DO NOT invent numbers/i.test(withStories),
    "percentages remain gated by sample size regardless of stories"
  );
  check(
    "with no stories, NO_STATS says there isn't enough data",
    /isn't enough data/i.test(withoutStories) && !/Community summaries/i.test(withoutStories),
    withoutStories.slice(0, 90) + "..."
  );
  check(
    "with stories, NO_STATS points at them instead of saying nothing",
    /Community summaries/i.test(withStories) && /single people's experiences/i.test(withStories),
    withStories.slice(0, 110) + "..."
  );
  check(
    "with stories, NO_STATS still refuses to imply a pattern",
    /not enough data yet to say what is typical|rather than a pattern/i.test(withStories),
    "one person's experience is not presented as typical"
  );
  check(
    "NO_STATS always ends at the attorney hand-off",
    /attorney/i.test(withoutStories) && /attorney/i.test(withStories),
    "both branches hand off"
  );

  await checkStoryProvenance(check);

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

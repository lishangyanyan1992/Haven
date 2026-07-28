function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function number(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function metricDelta(current, previous, formatter = number) {
  const difference = current - previous;
  const sign = difference > 0 ? "+" : "";
  return `${formatter(current)} (${sign}${formatter(difference)})`;
}

function opportunityEvidence(opportunity) {
  const metrics = opportunity.metrics;
  const currentPosition = metrics.currentMissing ? "not present in the current query/page rows" : `position ${number(metrics.position)}`;
  const lines = [
    `- Query: \`${opportunity.query}\``,
    `- Primary page: ${opportunity.page}`,
    `- Current: ${number(metrics.impressions)} impressions, ${number(metrics.clicks)} clicks, ${percent(metrics.ctr)} CTR, ${currentPosition}`
  ];

  if (metrics.previousPosition !== null) {
    lines.push(
      `- Previous: ${number(metrics.previousImpressions)} impressions, ${number(metrics.previousClicks)} clicks, ${percent(metrics.previousCtr)} CTR, position ${number(metrics.previousPosition)}`
    );
  }

  if (opportunity.pages.length > 1) {
    lines.push(`- Competing Haven pages: ${opportunity.pages.map((page) => `\`${page}\``).join(", ")}`);
  }

  return lines.join("\n");
}

function indexingStatusLabel(status) {
  return String(status ?? "unknown")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function indexingEvidence(opportunity) {
  const evidence = [opportunity.coverageState || opportunity.verdict || "No coverage reason returned"];
  if (opportunity.lastCrawlTime) evidence.push(`last crawl ${opportunity.lastCrawlTime.slice(0, 10)}`);
  if (opportunity.googleCanonical && opportunity.googleCanonical !== opportunity.url) {
    evidence.push(`Google canonical: ${opportunity.googleCanonical}`);
  }
  if (opportunity.inspectionError) evidence.push(opportunity.inspectionError);
  return evidence.join("; ");
}

function buildIndexingSection({ indexingSummary, indexingOpportunities, sitemap }) {
  if (!indexingSummary?.inspected) {
    return "No sitemap URLs were inspected in this run.";
  }

  const rows = indexingOpportunities.length
    ? indexingOpportunities
        .map(
          (opportunity) =>
            `| ${number(opportunity.score)} | ${indexingStatusLabel(opportunity.status)} | ${markdownCell(opportunity.url)} | ${markdownCell(indexingEvidence(opportunity))} | ${markdownCell(opportunity.recommendation)} |`
        )
        .join("\n")
    : "| — | — | — | All inspected sitemap URLs are indexed. | Keep monitoring weekly. |";

  return `- Sitemap: ${sitemap?.sitemapUrl ? `\`${sitemap.sitemapUrl}\`` : "input fixture"}\n- Sitemap documents read: ${number(sitemap?.sitemapCount ?? 0)}\n- Canonical sitemap URLs inspected: ${number(indexingSummary.inspected)}${sitemap?.truncated ? " (inspection limit reached)" : ""}\n- Indexed: ${number(indexingSummary.indexed)}\n- Needs review: ${number(indexingSummary.needsReview)}\n- Inspection errors: ${number(indexingSummary.errors)}\n\n| Score | Status | URL | Search Console evidence | Recommended next step |\n| ---: | --- | --- | --- | --- |\n${rows}`;
}

export function buildMarkdownReport({
  siteUrl,
  windows,
  currentSummary,
  previousSummary,
  opportunities,
  indexingSummary = { inspected: 0, indexed: 0, needsReview: 0, errors: 0 },
  indexingOpportunities = [],
  sitemap = null
}) {
  const movement = currentSummary.clicks - previousSummary.clicks;
  const movementSummary =
    movement > 0
      ? `increased by ${movement}`
      : movement < 0
        ? `decreased by ${Math.abs(movement)}`
        : "were flat (0 change)";
  const topAction = opportunities[0]
    ? `${opportunities[0].id}: ${opportunities[0].title.toLowerCase()} for \`${opportunities[0].query}\`.`
    : "No opportunity crossed the MVP confidence thresholds.";
  const indexingSummaryText = indexingSummary.inspected
    ? `${number(indexingSummary.indexed)} of ${number(indexingSummary.inspected)} sitemap URLs are indexed; ${number(indexingSummary.needsReview)} need review and ${number(indexingSummary.errors)} inspections failed.`
    : "No sitemap URLs were inspected.";

  const sections = opportunities.length
    ? opportunities
        .map(
          (opportunity, index) => `### ${index + 1}. ${opportunity.id} — ${opportunity.title}\n\nScore: ${number(opportunity.score)}\n\n${opportunityEvidence(opportunity)}\n\nRecommended next step: ${opportunity.recommendation}`
        )
        .join("\n\n")
    : "No high-confidence opportunities were found. Keep collecting data and run again next week.";

  return `# Haven SEO and indexing report — ${windows.runDate}\n\n## Executive summary\n\nOrganic clicks ${movementSummary} between the two 28-day windows. ${indexingSummaryText} The first performance action is ${topAction}\n\nThis monitor is read-only: it reports evidence and recommendations but does not change live content or request indexing automatically.\n\n## Measurement window\n\n- Search Console property: \`${siteUrl}\`\n- Current: ${windows.current.startDate} through ${windows.current.endDate}\n- Previous: ${windows.previous.startDate} through ${windows.previous.endDate}\n- Search Console lag allowance: ${windows.lagDays} days\n\n## Indexing snapshot\n\n${buildIndexingSection({ indexingSummary, indexingOpportunities, sitemap })}\n\n## Performance snapshot\n\n| Metric | Current (change) | Previous |\n| --- | ---: | ---: |\n| Clicks | ${metricDelta(currentSummary.clicks, previousSummary.clicks)} | ${number(previousSummary.clicks)} |\n| Impressions | ${metricDelta(currentSummary.impressions, previousSummary.impressions)} | ${number(previousSummary.impressions)} |\n| CTR | ${metricDelta(currentSummary.ctr, previousSummary.ctr, percent)} | ${percent(previousSummary.ctr)} |\n| Weighted average position | ${metricDelta(currentSummary.position, previousSummary.position)} | ${number(previousSummary.position)} |\n| Query/page rows | ${number(currentSummary.rowCount)} | ${number(previousSummary.rowCount)} |\n\n## Top performance opportunities\n\n${sections}\n\n## Guardrails and caveats\n\n- Google Search Console and Haven's own sitemap are the only data sources in this MVP; competitor rankings are not modeled.\n- URL Inspection reports Google's latest known state, not a guaranteed live crawl or an indexing promise.\n- Position is an impression-weighted average, not a fixed live rank.\n- The API response is capped at 25,000 query/page rows per comparison window and 2,000 URL inspections per run.\n- Low-volume queries may be omitted by Google for privacy.\n- Every recommendation requires human review. Immigration claims must remain grounded in authoritative sources.\n- Community stories are outside the automatic edit scope.\n`;
}

export function buildMetricsCsv(mergedRows) {
  const headers = [
    "query",
    "page",
    "clicks",
    "previous_clicks",
    "clicks_delta",
    "impressions",
    "previous_impressions",
    "impressions_delta",
    "ctr",
    "previous_ctr",
    "position",
    "previous_position",
    "position_delta"
  ];

  const lines = mergedRows.map((row) =>
    [
      row.query,
      row.page,
      row.clicks,
      row.previousClicks,
      row.clicksDelta,
      row.impressions,
      row.previousImpressions,
      row.impressionsDelta,
      row.ctr,
      row.previousCtr,
      row.position,
      row.previousPosition,
      row.positionDelta
    ]
      .map(csvCell)
      .join(",")
  );

  return `${headers.map(markdownCell).join(",")}\n${lines.join("\n")}\n`;
}

export function buildIndexingCsv(assessments) {
  const headers = [
    "url",
    "status",
    "score",
    "verdict",
    "coverage_state",
    "page_fetch_state",
    "robots_txt_state",
    "indexing_state",
    "last_crawl_time",
    "last_modified",
    "google_canonical",
    "user_canonical",
    "source_sitemap",
    "recommendation",
    "inspection_error"
  ];

  const lines = assessments.map((row) =>
    [
      row.url,
      row.status,
      row.score,
      row.verdict,
      row.coverageState,
      row.pageFetchState,
      row.robotsTxtState,
      row.indexingState,
      row.lastCrawlTime,
      row.lastModified,
      row.googleCanonical,
      row.userCanonical,
      row.sourceSitemap,
      row.recommendation,
      row.inspectionError
    ]
      .map(csvCell)
      .join(",")
  );

  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

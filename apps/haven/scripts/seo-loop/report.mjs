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

export function buildMarkdownReport({ siteUrl, windows, currentSummary, previousSummary, opportunities }) {
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

  const sections = opportunities.length
    ? opportunities
        .map(
          (opportunity, index) => `### ${index + 1}. ${opportunity.id} — ${opportunity.title}\n\nScore: ${number(opportunity.score)}\n\n${opportunityEvidence(opportunity)}\n\nRecommended next step: ${opportunity.recommendation}`
        )
        .join("\n\n")
    : "No high-confidence opportunities were found. Keep collecting data and run again next week.";

  return `# Haven SEO baseline — ${windows.runDate}\n\n## Executive summary\n\nOrganic clicks ${movementSummary} between the two 28-day windows. The first recommended action is ${topAction}\n\nThis baseline is read-only: it reports opportunities but does not change live content.\n\n## Measurement window\n\n- Search Console property: \`${siteUrl}\`\n- Current: ${windows.current.startDate} through ${windows.current.endDate}\n- Previous: ${windows.previous.startDate} through ${windows.previous.endDate}\n- Search Console lag allowance: ${windows.lagDays} days\n\n## Performance snapshot\n\n| Metric | Current (change) | Previous |\n| --- | ---: | ---: |\n| Clicks | ${metricDelta(currentSummary.clicks, previousSummary.clicks)} | ${number(previousSummary.clicks)} |\n| Impressions | ${metricDelta(currentSummary.impressions, previousSummary.impressions)} | ${number(previousSummary.impressions)} |\n| CTR | ${metricDelta(currentSummary.ctr, previousSummary.ctr, percent)} | ${percent(previousSummary.ctr)} |\n| Weighted average position | ${metricDelta(currentSummary.position, previousSummary.position)} | ${number(previousSummary.position)} |\n| Query/page rows | ${number(currentSummary.rowCount)} | ${number(previousSummary.rowCount)} |\n\n## Top opportunities\n\n${sections}\n\n## Guardrails and caveats\n\n- Google Search Console is the only data source in this MVP; competitor rankings are not modeled.\n- Position is an impression-weighted average, not a fixed live rank.\n- The API response is capped at 25,000 query/page rows per comparison window.\n- Low-volume queries may be omitted by Google for privacy.\n- Every recommendation requires human review. Immigration claims must remain grounded in authoritative sources.\n- Community stories are outside the automatic edit scope.\n`;
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

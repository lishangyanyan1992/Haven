import { createHash } from "node:crypto";

function rowKey(row) {
  return `${row.query}\u0000${row.page}`;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function expectedCtr(position) {
  if (position <= 3) return 0.12;
  if (position <= 5) return 0.07;
  if (position <= 10) return 0.03;
  if (position <= 20) return 0.01;
  return 0;
}

function stableId(type, query, page) {
  const digest = createHash("sha1").update(`${type}:${query}:${page}`).digest("hex").slice(0, 8).toUpperCase();
  return `SEO-${type.toUpperCase().replaceAll("_", "-")}-${digest}`;
}

export function mergePeriods(currentRows, previousRows) {
  const currentByKey = new Map(currentRows.map((row) => [rowKey(row), row]));
  const previousByKey = new Map(previousRows.map((row) => [rowKey(row), row]));
  const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);

  return [...keys].map((key) => {
    const current = currentByKey.get(key);
    const previous = previousByKey.get(key);
    const active = current ?? {
      query: previous.query,
      page: previous.page,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 101
    };
    return {
      ...active,
      currentMissing: !current,
      previousClicks: previous?.clicks ?? 0,
      previousImpressions: previous?.impressions ?? 0,
      previousCtr: previous?.ctr ?? 0,
      previousPosition: previous?.position ?? null,
      clicksDelta: active.clicks - (previous?.clicks ?? 0),
      impressionsDelta: active.impressions - (previous?.impressions ?? 0),
      positionDelta: previous ? previous.position - active.position : null
    };
  });
}

function recommendationFor(type) {
  switch (type) {
    case "striking_distance":
      return "Inspect the ranking page against this query, then strengthen the matching section and add relevant internal links. Keep any legal statements source-backed.";
    case "low_ctr":
      return "Test a clearer SEO title and meta description that answer this query directly without changing the underlying legal claim.";
    case "decay":
      return "Review the page for stale facts, broken sources, intent drift, and recently weakened internal links before proposing a focused refresh.";
    case "cannibalization":
      return "Choose one primary page for this query, then consolidate overlapping coverage or point internal links toward the primary page.";
    default:
      return "Inspect the evidence and propose one reviewable change.";
  }
}

export function findOpportunities(currentRows, previousRows, { limit = 3 } = {}) {
  const merged = mergePeriods(currentRows, previousRows);
  const candidates = [];

  for (const row of merged) {
    if (!row.currentMissing && row.position >= 4 && row.position <= 20 && row.impressions >= 20) {
      candidates.push({
        id: stableId("striking_distance", row.query, row.page),
        type: "striking_distance",
        title: "Striking-distance query",
        score: round(55 + Math.min(row.impressions / 20, 50) + (20 - row.position) * 1.5),
        query: row.query,
        page: row.page,
        pages: [row.page],
        metrics: row,
        recommendation: recommendationFor("striking_distance")
      });
    }

    const targetCtr = expectedCtr(row.position);
    if (!row.currentMissing && row.position <= 10 && row.impressions >= 50 && targetCtr > 0 && row.ctr < targetCtr * 0.65) {
      const estimatedClickUpside = Math.max(0, row.impressions * targetCtr - row.clicks);
      candidates.push({
        id: stableId("low_ctr", row.query, row.page),
        type: "low_ctr",
        title: "High impressions, low CTR",
        score: round(75 + Math.min(estimatedClickUpside * 3, 100)),
        query: row.query,
        page: row.page,
        pages: [row.page],
        metrics: { ...row, targetCtr, estimatedClickUpside },
        recommendation: recommendationFor("low_ctr")
      });
    }

    const clickDropRate = row.previousClicks > 0 ? (row.previousClicks - row.clicks) / row.previousClicks : 0;
    const positionLoss = row.previousPosition === null ? 0 : row.position - row.previousPosition;
    if (row.previousImpressions >= 20 && ((clickDropRate >= 0.25 && row.previousClicks - row.clicks >= 3) || positionLoss >= 2)) {
      candidates.push({
        id: stableId("decay", row.query, row.page),
        type: "decay",
        title: "Traffic or ranking decay",
        score: round(80 + Math.min(Math.max(clickDropRate, 0) * 100, 80) + Math.max(positionLoss, 0) * 3),
        query: row.query,
        page: row.page,
        pages: [row.page],
        metrics: { ...row, clickDropRate, positionLoss },
        recommendation: recommendationFor("decay")
      });
    }
  }

  const rowsByQuery = new Map();
  for (const row of merged) {
    const queryRows = rowsByQuery.get(row.query) ?? [];
    queryRows.push(row);
    rowsByQuery.set(row.query, queryRows);
  }

  for (const [query, rows] of rowsByQuery) {
    const competingRows = rows.filter((row) => !row.currentMissing && row.impressions >= 5 && row.position <= 30);
    const totalImpressions = competingRows.reduce((sum, row) => sum + row.impressions, 0);
    if (competingRows.length < 2 || totalImpressions < 30) continue;

    competingRows.sort((left, right) => right.impressions - left.impressions);
    const primary = competingRows[0];
    candidates.push({
      id: stableId("cannibalization", query, primary.page),
      type: "cannibalization",
      title: "Possible keyword cannibalization",
      score: round(70 + Math.min(totalImpressions / 4, 100) + competingRows.length * 5),
      query,
      page: primary.page,
      pages: competingRows.map((row) => row.page),
      metrics: { ...primary, totalImpressions, competingPageCount: competingRows.length },
      recommendation: recommendationFor("cannibalization")
    });
  }

  candidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const selected = [];
  const selectedPages = new Set();
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (candidate.pages.some((page) => selectedPages.has(page))) continue;
    selected.push(candidate);
    candidate.pages.forEach((page) => selectedPages.add(page));
  }

  return { mergedRows: merged, opportunities: selected };
}

export function summarizeRows(rows) {
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const weightedPosition = impressions
    ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions
    : 0;

  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: weightedPosition,
    rowCount: rows.length
  };
}

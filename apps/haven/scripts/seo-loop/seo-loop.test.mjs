import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findOpportunities, summarizeRows } from "./opportunities.mjs";
import { buildMarkdownReport, buildMetricsCsv } from "./report.mjs";
import { getComparisonWindows, runSeoReport } from "./run.mjs";

const currentRows = [
  {
    query: "h1b grace period calculator",
    page: "https://haven-h1b.com/tools/grace-period-calculator",
    clicks: 4,
    impressions: 400,
    ctr: 0.01,
    position: 6
  },
  {
    query: "h1b transfer timeline",
    page: "https://haven-h1b.com/resources/h1b-transfer-timeline",
    clicks: 8,
    impressions: 180,
    ctr: 0.044,
    position: 9
  },
  {
    query: "h1b transfer timeline",
    page: "https://haven-h1b.com/blog/before-you-accept-h1b-transfer",
    clicks: 2,
    impressions: 55,
    ctr: 0.036,
    position: 16
  },
  {
    query: "perm processing delay",
    page: "https://haven-h1b.com/resources/perm-delay-what-to-track",
    clicks: 4,
    impressions: 90,
    ctr: 0.044,
    position: 14
  }
];

const previousRows = [
  {
    query: "h1b grace period calculator",
    page: "https://haven-h1b.com/tools/grace-period-calculator",
    clicks: 5,
    impressions: 350,
    ctr: 0.014,
    position: 6.5
  },
  {
    query: "h1b transfer timeline",
    page: "https://haven-h1b.com/resources/h1b-transfer-timeline",
    clicks: 18,
    impressions: 210,
    ctr: 0.086,
    position: 5
  },
  {
    query: "perm processing delay",
    page: "https://haven-h1b.com/resources/perm-delay-what-to-track",
    clicks: 11,
    impressions: 100,
    ctr: 0.11,
    position: 9
  }
];

test("builds two adjacent 28-day windows with a three-day lag", () => {
  assert.deepEqual(getComparisonWindows(new Date("2026-07-15T12:00:00Z")), {
    runDate: "2026-07-15",
    lagDays: 3,
    current: { startDate: "2026-06-15", endDate: "2026-07-12" },
    previous: { startDate: "2026-05-18", endDate: "2026-06-14" }
  });
});

test("selects no more than three high-confidence opportunities on distinct pages", () => {
  const { opportunities } = findOpportunities(currentRows, previousRows, { limit: 3 });
  assert.equal(opportunities.length, 3);
  assert.equal(new Set(opportunities.flatMap((opportunity) => opportunity.pages)).size, 3);
  assert.ok(opportunities.some((opportunity) => opportunity.type === "low_ctr"));
  assert.ok(opportunities.some((opportunity) => opportunity.type === "decay"));
  assert.ok(opportunities.every((opportunity) => opportunity.id.startsWith("SEO-")));
});

test("renders a readable report and spreadsheet-safe CSV", () => {
  const windows = getComparisonWindows(new Date("2026-07-15T12:00:00Z"));
  const { mergedRows, opportunities } = findOpportunities(currentRows, previousRows, { limit: 3 });
  const report = buildMarkdownReport({
    siteUrl: "sc-domain:haven-h1b.com",
    windows,
    currentSummary: summarizeRows(currentRows),
    previousSummary: summarizeRows(previousRows),
    opportunities
  });
  const csv = buildMetricsCsv([{ ...mergedRows[0], query: "=unsafe formula" }]);

  assert.match(report, /Haven SEO baseline/);
  assert.match(report, /Top opportunities/);
  assert.match(report, /read-only/);
  assert.match(csv, /"'=unsafe formula"/);
});

test("writes a complete report from a deterministic input file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "haven-seo-loop-"));
  const inputPath = path.join(directory, "input.json");
  await writeFile(inputPath, JSON.stringify({ currentRows, previousRows }), "utf8");

  try {
    const result = await runSeoReport({
      now: new Date("2026-07-15T12:00:00Z"),
      siteUrl: "sc-domain:haven-h1b.com",
      inputPath,
      outputRoot: path.join(directory, "reports")
    });
    const report = await readFile(result.reportPath, "utf8");
    const metrics = await readFile(result.metricsPath, "utf8");

    assert.match(report, /2026-06-15 through 2026-07-12/);
    assert.match(metrics, /h1b grace period calculator/);
    assert.equal(result.opportunities.length, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

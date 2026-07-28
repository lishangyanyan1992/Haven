#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchSearchConsoleDataset } from "./gsc.mjs";
import { assessIndexingRows } from "./indexing.mjs";
import { findOpportunities, summarizeRows } from "./opportunities.mjs";
import { buildIndexingCsv, buildMarkdownReport, buildMetricsCsv } from "./report.mjs";

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function getComparisonWindows(now = new Date(), { periodDays = 28, lagDays = 3 } = {}) {
  const runDate = formatDate(now);
  const currentEnd = addDays(now, -lagDays);
  const currentStart = addDays(currentEnd, -(periodDays - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(periodDays - 1));

  return {
    runDate,
    lagDays,
    current: { startDate: formatDate(currentStart), endDate: formatDate(currentEnd) },
    previous: { startDate: formatDate(previousStart), endDate: formatDate(previousEnd) }
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function loadInputFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.currentRows) || !Array.isArray(parsed.previousRows)) {
    throw new Error("Input file must contain currentRows and previousRows arrays.");
  }
  if (parsed.indexingRows !== undefined && !Array.isArray(parsed.indexingRows)) {
    throw new Error("Input file indexingRows must be an array when provided.");
  }
  return parsed;
}

export async function runSeoReport({
  now = new Date(),
  siteUrl = process.env.GSC_SITE_URL,
  credentialsJson = process.env.GSC_CREDENTIALS_JSON,
  inputPath,
  outputRoot = "reports/seo",
  limit = 3,
  sitemapUrl = process.env.SEO_SITEMAP_URL ?? "https://haven-h1b.com/sitemap.xml",
  inspectionLimit = Number(process.env.SEO_INSPECTION_LIMIT ?? 2000),
  indexingLimit = 12
} = {}) {
  if (!siteUrl) {
    throw new Error("GSC_SITE_URL is required (for example, sc-domain:haven-h1b.com).");
  }
  if (!Number.isInteger(inspectionLimit) || inspectionLimit < 1 || inspectionLimit > 2000) {
    throw new Error("SEO_INSPECTION_LIMIT must be an integer between 1 and 2000.");
  }
  if (!Number.isInteger(indexingLimit) || indexingLimit < 1) {
    throw new Error("The indexing opportunity limit must be a positive integer.");
  }

  const windows = getComparisonWindows(now);
  const comparison = inputPath
    ? await loadInputFile(inputPath)
    : await fetchSearchConsoleDataset({
        credentialsJson,
        siteUrl,
        windows,
        sitemapUrl,
        inspectionLimit
      });
  const { mergedRows, opportunities } = findOpportunities(comparison.currentRows, comparison.previousRows, { limit });
  const {
    assessments: indexingAssessments,
    opportunities: indexingOpportunities,
    summary: indexingSummary
  } = assessIndexingRows(comparison.indexingRows ?? [], { now, limit: indexingLimit });
  const currentSummary = summarizeRows(comparison.currentRows);
  const previousSummary = summarizeRows(comparison.previousRows);
  const outputDirectory = path.resolve(outputRoot, windows.runDate);
  const reportPath = path.join(outputDirectory, "report.md");
  const metricsPath = path.join(outputDirectory, "metrics.csv");
  const indexingPath = path.join(outputDirectory, "indexing.csv");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    reportPath,
    buildMarkdownReport({
      siteUrl,
      windows,
      currentSummary,
      previousSummary,
      opportunities,
      indexingSummary,
      indexingOpportunities,
      sitemap: comparison.sitemap
    }),
    "utf8"
  );
  await writeFile(metricsPath, buildMetricsCsv(mergedRows), "utf8");
  await writeFile(indexingPath, buildIndexingCsv(indexingAssessments), "utf8");

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `run_date=${windows.runDate}\nreport_path=${path.relative(process.cwd(), reportPath)}\nmetrics_path=${path.relative(process.cwd(), metricsPath)}\nindexing_path=${path.relative(process.cwd(), indexingPath)}\nopportunity_count=${opportunities.length}\nindexing_opportunity_count=${indexingOpportunities.length}\ninspection_count=${indexingSummary.inspected}\n`,
      "utf8"
    );
  }

  return {
    windows,
    reportPath,
    metricsPath,
    indexingPath,
    opportunities,
    indexingAssessments,
    indexingOpportunities,
    indexingSummary,
    currentSummary,
    previousSummary
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  runSeoReport({
    now: args.now ? new Date(args.now) : new Date(),
    siteUrl: args.site ?? process.env.GSC_SITE_URL,
    credentialsJson: process.env.GSC_CREDENTIALS_JSON,
    inputPath: args.input,
    outputRoot: args["output-dir"] ?? "reports/seo",
    limit: args.limit ? Number(args.limit) : 3,
    sitemapUrl: args.sitemap ?? process.env.SEO_SITEMAP_URL ?? "https://haven-h1b.com/sitemap.xml",
    inspectionLimit: args["inspection-limit"]
      ? Number(args["inspection-limit"])
      : Number(process.env.SEO_INSPECTION_LIMIT ?? 2000),
    indexingLimit: args["indexing-limit"] ? Number(args["indexing-limit"]) : 12
  })
    .then((result) => {
      process.stdout.write(
        `SEO report written to ${path.relative(process.cwd(), result.reportPath)} with ${result.opportunities.length} performance opportunities and ${result.indexingOpportunities.length} indexing opportunities from ${result.indexingSummary.inspected} inspected URLs.\n`
      );
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}

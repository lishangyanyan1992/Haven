// Stage 5 (optional) — curate the built directory down to a high-quality top tier.
//
//   node curate.mjs [--limit N]
//
// Reads the current src/data/law-firm-directory.json (full build), removes
// off-target / unusable listings, ranks the rest by client rating weighted by
// review-volume confidence, keeps the top N, and rewrites the JSON.
//
// "Quality over coverage" — the directory's whole value is trust, so a curated
// ~60 beats a scraped 188. Re-run build.mjs first if you want to start from all firms.

import { readFile, writeFile } from "node:fs/promises";

import { OUTPUT_FILE } from "./config.mjs";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : 60;

// Names whose primary practice is clearly NOT immigration (mass-market / off-target).
const OFF_TARGET = /\bconsumer law\b|personal injury|car accident|slip and fall|workers.?comp|lemon law|debt relief/i;
const MIN_REVIEWS = 8;

function curationScore(firm) {
  return (firm.rating ?? 0) * Math.log10((firm.reviewCount ?? 0) + 1);
}

async function main() {
  const data = JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
  const before = data.firms.length;

  const removed = [];
  const eligible = data.firms.filter((firm) => {
    if (OFF_TARGET.test(firm.firmName)) {
      removed.push([firm.firmName, "off-target (non-immigration)"]);
      return false;
    }
    if (!firm.website) {
      removed.push([firm.firmName, "no website"]);
      return false;
    }
    if ((firm.reviewCount ?? 0) < MIN_REVIEWS) {
      removed.push([firm.firmName, `too few reviews (${firm.reviewCount ?? 0})`]);
      return false;
    }
    return true;
  });

  eligible.sort((a, b) => curationScore(b) - curationScore(a) || a.firmName.localeCompare(b.firmName));
  const curated = eligible.slice(0, LIMIT);

  // Recompute source recordCounts to match the curated set.
  data.firms = curated;
  data.generatedAt = new Date().toISOString();
  for (const source of data.sources) {
    if (/places/i.test(source.name)) source.recordCount = curated.length;
    if (/bar/i.test(source.name)) source.recordCount = curated.filter((f) => f.barVerified).length;
    if (/aila/i.test(source.name)) source.recordCount = curated.filter((f) => f.ailaMember).length;
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2) + "\n");

  console.log(`Curated ${before} -> ${curated.length} firms (removed ${removed.length}).`);
  console.log("Removed:");
  for (const [name, reason] of removed.slice(0, 40)) console.log(`  - ${name} — ${reason}`);
  if (removed.length > 40) console.log(`  …and ${removed.length - 40} more`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

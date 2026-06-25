// Stage 4 — filter, dedupe, score, and emit the final directory JSON.
//
//   node build.mjs [--include-unverified] [--include-manual]
//
// Reads work/03-verified.json (optionally a hand-curated work/aila.json mapping
// firm id -> true for the AILA badge) and writes src/data/law-firm-directory.json.
//
// Rules:
//  - drop firms larger than MAX_TEAM_SIZE (small-firms-only directory)
//  - dedupe by website root domain (eTLD+1)
//  - require bar-verified OR AILA-member, unless --include-unverified
//  - by default exclude needsManualVerify firms unless --include-manual

import { readFile, writeFile } from "node:fs/promises";

import { MAX_TEAM_SIZE, OUTPUT_FILE, WORK_DIR } from "./config.mjs";

const includeUnverified = process.argv.includes("--include-unverified");
const includeManual = process.argv.includes("--include-manual");

// Minimal eTLD+1 without a dependency: take the last two labels (good enough for
// .com/.net/.org; the app's server action uses tldts for the authoritative check).
function rootDomain(website) {
  try {
    const host = new URL(website).hostname.replace(/^www\./, "");
    const labels = host.split(".");
    return labels.slice(-2).join(".");
  } catch {
    return "";
  }
}

function trustScore(firm) {
  let score = 40;
  if (firm.barVerified) score += 25;
  if (firm.barVerified?.noDiscipline) score += 5;
  if (firm.ailaMember) score += 15;
  if ((firm.reviewCount ?? 0) >= 25) score += 8;
  if ((firm.rating ?? 0) >= 4.5) score += 5;
  if (firm.sizeConfidence === "high") score += 2;
  return Math.max(0, Math.min(100, score));
}

async function readOptional(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const firms = JSON.parse(await readFile(`${WORK_DIR}/03-verified.json`, "utf8"));
  const ailaMap = await readOptional(`${WORK_DIR}/aila.json`, {}); // { [firmId]: true }

  const seenDomains = new Set();
  const out = [];

  for (const firm of firms) {
    if (firm.teamSizeEstimate > MAX_TEAM_SIZE) continue;
    if (firm.needsManualVerify && !includeManual) continue;

    const ailaMember = Boolean(ailaMap[firm.id]);
    if (!firm.barVerified && !ailaMember && !includeUnverified) continue;

    const domain = rootDomain(firm.website);
    if (domain) {
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);
    }

    const record = {
      id: firm.id,
      firmName: firm.firmName,
      trustScore: 0,
      metro: firm.metro,
      city: firm.city,
      state: firm.state,
      website: firm.website,
      phone: firm.phone ?? null,
      practiceFocus: firm.practiceFocus,
      languagesSpoken: firm.languagesSpoken,
      firmSizeBucket: firm.firmSizeBucket,
      sizeConfidence: firm.sizeConfidence,
      barVerified: firm.barVerified ?? null,
      ailaMember,
      rating: firm.rating ?? null,
      reviewCount: firm.reviewCount ?? null,
      verifiedAsOf: new Date().toISOString().slice(0, 10),
      sources: [firm.placeId ? `places:${firm.placeId}` : null, ailaMember ? "aila" : null].filter(Boolean)
    };
    record.trustScore = trustScore({ ...firm, ailaMember });
    out.push(record);
  }

  out.sort((a, b) => b.trustScore - a.trustScore || a.firmName.localeCompare(b.firmName));

  const payload = {
    generatedAt: new Date().toISOString(),
    isSampleData: false,
    sources: [
      {
        name: "Google Places API (firm discovery)",
        url: "https://developers.google.com/maps/documentation/places/web-service",
        label: "Places discovery — firm name, website, rating, reviews",
        recordCount: out.length
      },
      {
        name: "State bar attorney lookups",
        url: "https://www.americanbar.org/groups/legal_services/flh-home/flh-bar-directories-and-lawyer-finders/",
        label: "State bar license verification",
        recordCount: out.filter((f) => f.barVerified).length
      },
      {
        name: "AILA member search (cross-reference)",
        url: "https://www.ailalawyer.com/",
        label: "AILA membership badge",
        recordCount: out.filter((f) => f.ailaMember).length
      }
    ],
    firms: out
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${out.length} firms -> ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

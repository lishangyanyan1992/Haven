// sponsor-enrich-websites.mjs
// Enrich the sponsor directory with a `website` per company using Clearbit's free
// Autocomplete API (https://autocomplete.clearbit.com/v1/companies/suggest). Clearbit
// returns REAL registered domains (no LLM fabrication), which matters because the
// website's root domain is the duplicate-detection key for the "suggest a company"
// form. The DOL LCA + USCIS Employer Data Hub sources carry no website field, so a
// name -> domain lookup is the closest-to-authoritative option.
//
// Strategy per company:
//   1. Strip legal-entity suffixes (LLC, Inc, Corporation, Limited, ...).
//   2. Query Clearbit with the cleaned name; on a miss, drop the last token and retry
//      (progressive shortening: "Amazon.com Services" -> "Amazon.com").
//   3. Among suggestions, pick by best name match (exact, then token-overlap
//      precision) to avoid regional-subsidiary traps (e.g. HCL -> hclsrilanka.com).
//   4. Store `website: "https://<domain>"` and `domain` (for review) on the company.
//
// Idempotent: skips companies that already have a website unless --force is passed,
// so re-runs only fill misses. Always review the 120 by hand after running.
//
// Run:  node scripts/community/sponsor-enrich-websites.mjs [--force]

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDomain } from "tldts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "../../apps/haven/src/data/sponsor-directory.json");
const CLEARBIT_URL = "https://autocomplete.clearbit.com/v1/companies/suggest?query=";
const FORCE = process.argv.includes("--force");

// Trailing legal-entity tokens to strip (case-insensitive, matched as whole tokens).
const LEGAL_SUFFIXES = new Set([
  "llc", "l.l.c.", "pllc", "p.l.l.c.",
  "inc", "inc.", "incorporated",
  "corp", "corp.", "corporation",
  "limited", "ltd", "ltd.",
  "company", "co", "co.",
  "plc", "p.c.", "p.l.c.",
  "pa", "p.a.",
  "llp", "l.l.p.", "lp", "l.p."
]);

// Leading brand tokens to strip.
const LEADING_PREFIXES = new Set(["the"]);

function tokenize(name) {
  return name
    .replace(/[.,;:]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function cleanName(name) {
  let tokens = tokenize(name);
  // strip leading prefixes
  while (tokens.length > 1 && LEADING_PREFIXES.has(tokens[0].toLowerCase())) {
    tokens = tokens.slice(1);
  }
  // strip trailing legal suffixes
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1].toLowerCase())) {
    tokens = tokens.slice(0, -1);
  }
  return tokens.join(" ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSuggestions(query, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(CLEARBIT_URL + encodeURIComponent(query), {
        headers: { accept: "application/json" }
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        return [];
      }
      return await res.json();
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return [];
}

// Precision of suggestion name against the query tokens: shared / suggestion tokens.
// Rewards suggestions that don't add a lot of extra (regional) words.
function matchScore(suggestionTokens, queryTokens) {
  if (!suggestionTokens.length || !queryTokens.length) return 0;
  const q = new Set(queryTokens.map((t) => t.toLowerCase()));
  let shared = 0;
  for (const t of suggestionTokens) {
    if (q.has(t.toLowerCase())) shared += 1;
  }
  return shared / suggestionTokens.length;
}

function pickBest(suggestions, query) {
  if (!suggestions.length) return null;
  const queryTokens = tokenize(query);
  let best = null;
  let bestScore = -1;
  for (const s of suggestions) {
    if (!s.domain) continue;
    const sTokens = tokenize(s.name || "");
    const exact = s.name && s.name.toLowerCase() === query.toLowerCase();
    const score = exact ? 2 : matchScore(sTokens, queryTokens);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

async function resolveWebsite(companyName) {
  const cleaned = cleanName(companyName);
  const tokens = tokenize(cleaned);
  for (let drop = 0; drop < tokens.length; drop += 1) {
    const query = tokens.slice(0, tokens.length - drop).join(" ").trim();
    if (!query) break;
    const suggestions = await fetchSuggestions(query);
    const best = pickBest(suggestions, query);
    if (best && best.domain) {
      const domain = getDomain(best.domain) || best.domain;
      return { website: `https://${domain}`, domain, matchedName: best.name, query };
    }
    await sleep(160);
  }
  return null;
}

async function main() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  const companies = data.companies;
  console.log(`Enriching ${companies.length} companies (force=${FORCE})`);

  const results = [];
  const misses = [];
  for (let i = 0; i < companies.length; i += 1) {
    const c = companies[i];
    if (c.website && !FORCE) {
      results.push({ id: c.id, name: c.companyName, website: c.website, domain: getDomain(c.website) ?? "", source: "cached" });
      continue;
    }
    const found = await resolveWebsite(c.companyName);
    if (found) {
      c.website = found.website;
      results.push({ id: c.id, name: c.companyName, website: found.website, domain: found.domain, matchedName: found.matchedName, query: found.query, source: "clearbit" });
      console.log(`[${i + 1}/${companies.length}] ${c.companyName} -> ${found.domain}  (q="${found.query}", hit="${found.matchedName}")`);
    } else {
      misses.push({ id: c.id, name: c.companyName });
      console.log(`[${i + 1}/${companies.length}] ${c.companyName} -> MISS`);
    }
    await sleep(160);
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${DATA_PATH}`);
  console.log(`Resolved: ${results.length}/${companies.length}  Misses: ${misses.length}`);
  if (misses.length) {
    console.log("\nMisses (fill manually in the JSON):");
    for (const m of misses) console.log(`  ${m.id}: ${m.name}`);
  }
  // Print the full map for spot-check.
  console.log("\n=== full mapping (spot-check) ===");
  for (const r of results) console.log(`${r.domain.padEnd(28)}  ${r.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
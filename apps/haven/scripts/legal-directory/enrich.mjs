// Stage 2 — enrich each firm by fetching its OWN website and inferring team size,
// practice focus, and languages spoken.
//
//   node enrich.mjs
//
// Reads work/01-discovered.json, writes work/02-enriched.json.
// Honors robots.txt-style politeness via a fixed delay; fetches only the firm's
// homepage + a few common "team" paths.

import { readFile, writeFile } from "node:fs/promises";

import { LANGUAGE_KEYWORDS, PRACTICE_KEYWORDS, WORK_DIR, bucketForSize, sleep } from "./config.mjs";

const TEAM_PATHS = ["", "/team", "/attorneys", "/our-team", "/about", "/people"];
const UA = "HavenLegalDirectoryBot/1.0 (+https://haven.com; respectful, low-rate)";

async function fetchText(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return "";
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function detect(keywordMap, text) {
  const found = [];
  for (const [label, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => text.includes(kw))) found.push(label);
  }
  return found;
}

// Many attorney sites publish a bar number ("State Bar No. 123456", "SBN 123456",
// "CA Bar #123456"). Capturing it lets verify.mjs hit the bar's detail page
// directly — far more reliable than name search. Returns the first match.
function detectBarNumber(text) {
  const patterns = [
    /(?:state\s+bar|cal(?:ifornia)?\s+bar)\s*(?:no\.?|number|#)\s*[:#]?\s*(\d{4,8})/i,
    /\bsbn\s*[:#]?\s*(\d{4,8})/i,
    /\bbar\s*(?:no\.?|number|#)\s*[:#]?\s*(\d{4,8})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Very rough headcount proxy: count attorney-bio signals on team pages, clamp.
// Borderline cases get sizeConfidence "low" for manual review.
function estimateTeamSize(html) {
  const text = html.toLowerCase();
  const attorneyMentions = (text.match(/attorney|esq\.?|partner|associate|of counsel/g) ?? []).length;
  const bioCards = (html.match(/class="[^"]*(team|attorney|bio|member|staff)[^"]*"/gi) ?? []).length;
  const estimate = Math.max(1, Math.min(40, Math.round(Math.max(attorneyMentions / 6, bioCards))));
  const confidence = bioCards >= 1 || attorneyMentions >= 4 ? "high" : "low";
  return { estimate, confidence };
}

async function main() {
  const firms = JSON.parse(await readFile(`${WORK_DIR}/01-discovered.json`, "utf8"));
  const out = [];

  for (const firm of firms) {
    let combined = "";
    let teamHtml = "";
    if (firm.website) {
      const base = firm.website.replace(/\/$/, "");
      for (const path of TEAM_PATHS) {
        const html = await fetchText(`${base}${path}`);
        combined += " " + stripHtml(html);
        if (path && html) teamHtml += " " + html;
        await sleep(400);
      }
    }

    const practiceFocus = detect(PRACTICE_KEYWORDS, combined);
    const languagesSpoken = ["English", ...detect(LANGUAGE_KEYWORDS, combined)];
    const barNumberHint = detectBarNumber(combined);
    const { estimate, confidence } = estimateTeamSize(teamHtml || combined);

    out.push({
      ...firm,
      practiceFocus: practiceFocus.length ? practiceFocus : ["Immigration"],
      languagesSpoken,
      barNumberHint,
      teamSizeEstimate: estimate,
      firmSizeBucket: bucketForSize(estimate),
      sizeConfidence: confidence
    });
    console.log(`Enriched ${firm.firmName} — ~${estimate} people, ${practiceFocus.length} practice areas`);
  }

  await writeFile(`${WORK_DIR}/02-enriched.json`, JSON.stringify(out, null, 2));
  console.log(`Enriched ${out.length} firms -> work/02-enriched.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

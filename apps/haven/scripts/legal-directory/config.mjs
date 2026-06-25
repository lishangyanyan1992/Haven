// Shared configuration for the legal-directory data pipeline.
//
// The pipeline is intentionally small and re-runnable: each stage reads/writes a
// JSON file in ./work, and build.mjs emits the final src/data/law-firm-directory.json.
//
// Compliance posture (read before running):
//  - Discovery uses the OFFICIAL Google Places API (free $200/mo credit covers the
//    50–200 firms this seeds). Per Places ToS, only `place_id` is stored long-term;
//    other fields are treated as a refreshable cache (re-run the pipeline to refresh).
//  - We do NOT scrape Justia/Avvo/AILA (they block bots / restrict reuse). AILA is
//    used as a manual cross-reference for the membership badge only.
//  - Website enrichment fetches the firm's OWN site; honor robots.txt and rate-limit.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const WORK_DIR = join(here, "work");
export const OUTPUT_FILE = join(here, "..", "..", "src", "data", "law-firm-directory.json");

export const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";

// Top foreign-talent metros. `state` is used downstream for bar verification.
// `queries` are passed to Google Places Text Search.
export const METROS = [
  { metro: "San Francisco Bay Area", state: "CA", queries: ["immigration lawyer in San Francisco CA", "immigration attorney in San Jose CA"] },
  { metro: "New York City", state: "NY", queries: ["immigration lawyer in New York NY", "immigration attorney in Brooklyn NY"] },
  { metro: "Seattle", state: "WA", queries: ["immigration lawyer in Seattle WA"] },
  { metro: "Boston", state: "MA", queries: ["immigration lawyer in Boston MA", "immigration attorney in Cambridge MA"] },
  { metro: "Austin", state: "TX", queries: ["immigration lawyer in Austin TX"] },
  { metro: "Dallas", state: "TX", queries: ["immigration lawyer in Dallas TX"] },
  { metro: "Chicago", state: "IL", queries: ["immigration lawyer in Chicago IL"] },
  { metro: "Los Angeles", state: "CA", queries: ["immigration lawyer in Los Angeles CA"] },
  { metro: "Washington DC", state: "DC", queries: ["immigration lawyer in Washington DC"] },
  { metro: "Atlanta", state: "GA", queries: ["immigration lawyer in Atlanta GA"] }
];

// Practice-focus keywords detected from firm website copy.
export const PRACTICE_KEYWORDS = {
  "H-1B": ["h-1b", "h1b", "specialty occupation"],
  "L-1": ["l-1", "l1 visa", "intracompany"],
  "O-1": ["o-1", "o1 visa", "extraordinary ability"],
  "EB-1": ["eb-1", "eb1", "extraordinary ability green card"],
  "EB-2 NIW": ["niw", "national interest waiver", "eb-2"],
  "PERM": ["perm", "labor certification"],
  "Family": ["family-based", "family based", "marriage green card", "k-1", "fiance"],
  "Asylum": ["asylum", "refugee", "withholding of removal"],
  "Student": ["f-1", "opt", "cpt", "student visa"]
};

// Languages detected from firm website copy ("we speak", "hablamos", etc.).
export const LANGUAGE_KEYWORDS = {
  Mandarin: ["mandarin", "chinese", "普通话", "中文"],
  Cantonese: ["cantonese", "粤语"],
  Spanish: ["spanish", "español", "hablamos español"],
  Hindi: ["hindi"],
  Telugu: ["telugu"],
  Korean: ["korean", "한국어"],
  Vietnamese: ["vietnamese", "tiếng việt"],
  Portuguese: ["portuguese", "português"],
  Russian: ["russian", "русский"],
  Polish: ["polish", "polski"],
  French: ["french", "français"],
  Japanese: ["japanese", "日本語"],
  Tagalog: ["tagalog", "filipino"]
};

// Firms larger than this are dropped (we only list small/solo firms).
export const MAX_TEAM_SIZE = 20;

export function bucketForSize(estimate) {
  if (estimate <= 1) return "solo";
  if (estimate <= 5) return "2-5";
  return "6-20";
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import type { BulletinChargeability, BulletinPreferenceCategory } from "@/types/domain";

type BulletinRowCategory = BulletinPreferenceCategory | "EB-3 Other Workers" | "EB-4" | "EB-4 Religious Workers" | "EB-5";

export interface ParsedVisaBulletinEntry {
  bulletinYear: number;
  bulletinMonth: number;
  bulletinLabel: string;
  category: BulletinRowCategory;
  country: BulletinChargeability;
  cutoffLabel: string;
  cutoffDate: string | null;
  sourceUrl: string;
}

export interface ParsedVisaBulletinResult {
  bulletinYear: number;
  bulletinMonth: number;
  bulletinLabel: string;
  sourceUrl: string;
  entries: ParsedVisaBulletinEntry[];
}

const BULLETIN_INDEX_URL =
  "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html?isoswindows=false";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

const MONTH_ABBREVIATIONS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
};

const EMPLOYMENT_COUNTRY_COLUMNS: BulletinChargeability[] = [
  "All Chargeability",
  "China",
  "India",
  "Mexico",
  "Philippines"
];

const ROW_DEFINITIONS: Array<{ prefix: string; category: BulletinRowCategory }> = [
  { prefix: "Certain Religious Workers", category: "EB-4 Religious Workers" },
  { prefix: "Other Workers", category: "EB-3 Other Workers" },
  { prefix: "5th Unreserved", category: "EB-5" },
  { prefix: "4th", category: "EB-4" },
  { prefix: "3rd", category: "EB-3" },
  { prefix: "2nd", category: "EB-2" },
  { prefix: "1st", category: "EB-1" }
];

function htmlToLines(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "HavenBot/1.0 (+https://haven.local)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  return response.text();
}

function toAbsoluteStateDepartmentUrl(path: string) {
  return path.startsWith("http") ? path : `https://travel.state.gov${path}`;
}

function parseLatestBulletinUrl(indexHtml: string) {
  const matches = Array.from(
    indexHtml.matchAll(/href="([^"]*\/visa-bulletin\/\d{4}\/visa-bulletin-for-[^"]+\.html)"/gi)
  ).map((match) => toAbsoluteStateDepartmentUrl(match[1]));

  if (matches.length === 0) {
    throw new Error("Unable to locate the latest visa bulletin page.");
  }

  return matches[0];
}

function parseBulletinMetadata(lines: string[]) {
  const titleLine = lines.find((line) => /^Visa Bulletin For /i.test(line));
  if (!titleLine) {
    throw new Error("Unable to determine the visa bulletin month.");
  }

  const match = titleLine.match(/^Visa Bulletin For ([A-Za-z]+) (\d{4})$/i);
  if (!match) {
    throw new Error(`Unexpected visa bulletin title: ${titleLine}`);
  }

  const [, monthName, yearText] = match;
  const bulletinMonth = MONTH_NAMES.findIndex((value) => value.toLowerCase() === monthName.toLowerCase()) + 1;
  const bulletinYear = Number(yearText);

  if (!bulletinMonth) {
    throw new Error(`Unknown visa bulletin month: ${monthName}`);
  }

  return {
    bulletinMonth,
    bulletinYear,
    bulletinLabel: `${MONTH_NAMES[bulletinMonth - 1]} ${bulletinYear}`
  };
}

function decodeHtmlText(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTableRows(tableHtml: string) {
  return Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((rowMatch) =>
    Array.from(rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi))
      .map((cellMatch) => decodeHtmlText(cellMatch[1]))
      .filter(Boolean)
  );
}

function selectEmploymentFinalActionTable(html: string) {
  const tables = Array.from(html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)).map((match) => match[0]);

  for (const tableHtml of tables) {
    const rows = parseTableRows(tableHtml);
    const header = rows[0] ?? [];

    if (
      header.length >= 6 &&
      /employment/i.test(header[0]) &&
      /all chargeability/i.test(header[1]) &&
      /china/i.test(header[2]) &&
      /india/i.test(header[3])
    ) {
      return rows;
    }
  }

  throw new Error("Unable to locate the employment-based final action dates table.");
}

function parseCutoffToken(token: string) {
  const normalized = token.trim().toUpperCase();
  if (normalized === "C" || normalized === "U") {
    return { cutoffLabel: normalized, cutoffDate: null };
  }

  const match = normalized.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, dayText, monthCode, yearText] = match;
  const month = MONTH_ABBREVIATIONS[monthCode];
  if (!month) return null;

  const year = 2000 + Number(yearText);
  const day = Number(dayText);
  const cutoffDate = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return { cutoffLabel: normalized, cutoffDate };
}

function parseEmploymentRows(lines: string[], html: string, sourceUrl: string) {
  const metadata = parseBulletinMetadata(lines);
  const entries: ParsedVisaBulletinEntry[] = [];
  const rows = selectEmploymentFinalActionTable(html).slice(1);

  for (const row of rows) {
    const [label, ...tokens] = row;
    if (!label || /^5th Set Aside/i.test(label)) {
      break;
    }

    const definition = ROW_DEFINITIONS.find((entry) => label.startsWith(entry.prefix));
    if (!definition) {
      continue;
    }

    if (tokens.length < EMPLOYMENT_COUNTRY_COLUMNS.length) {
      continue;
    }

    EMPLOYMENT_COUNTRY_COLUMNS.forEach((country, index) => {
      const parsed = parseCutoffToken(tokens[index]);
      if (!parsed) return;

      entries.push({
        ...metadata,
        category: definition.category,
        country,
        cutoffLabel: parsed.cutoffLabel,
        cutoffDate: parsed.cutoffDate,
        sourceUrl
      });
    });
  }

  if (entries.length === 0) {
    throw new Error("No employment-based final action rows were parsed from the visa bulletin page.");
  }

  return {
    ...metadata,
    sourceUrl,
    entries
  };
}

export async function fetchLatestVisaBulletin(): Promise<ParsedVisaBulletinResult> {
  const indexHtml = await fetchPage(BULLETIN_INDEX_URL);
  const sourceUrl = parseLatestBulletinUrl(indexHtml);
  const bulletinHtml = await fetchPage(sourceUrl);
  const lines = htmlToLines(bulletinHtml);

  return parseEmploymentRows(lines, bulletinHtml, sourceUrl);
}

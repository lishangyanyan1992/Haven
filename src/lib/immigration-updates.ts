import { cache } from "react";

export type ImmigrationUpdate = {
  id: string;
  title: string;
  summary: string;
  sourceLabel: string;
  url: string;
  publishedAt?: string;
  emphasis: "critical" | "important" | "watch";
};

const DATE_PATTERN =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}$/;

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
    next: {
      revalidate: 60 * 60 * 6
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }

  return response.text();
}

function parseUSCISNewsroom(lines: string[]): ImmigrationUpdate | null {
  const headlineIndex = lines.findIndex((line) => line === "Latest Headlines");
  if (headlineIndex === -1) return null;

  for (let index = headlineIndex + 1; index < lines.length - 2; index += 1) {
    const dateCandidate = lines[index + 1];
    if (!DATE_PATTERN.test(dateCandidate)) continue;

    const title = lines[index];
    const summary = lines[index + 2];

    return {
      id: "uscis-newsroom-latest",
      title,
      summary,
      sourceLabel: "USCIS Newsroom",
      url: "https://www.uscis.gov/newsroom",
      publishedAt: dateCandidate,
      emphasis: /h-?1b|green card|employment|worker|visa/i.test(`${title} ${summary}`) ? "critical" : "important"
    };
  }

  return null;
}

function parseUSCISPolicyUpdate(lines: string[]): ImmigrationUpdate | null {
  const updateIndex = lines.findIndex((line) => line.startsWith("Updates(") || line === "Updates");
  if (updateIndex === -1) return null;

  for (let index = updateIndex + 1; index < lines.length - 2; index += 1) {
    const dateCandidate = lines[index + 1];
    if (!DATE_PATTERN.test(dateCandidate)) continue;

    const title = lines[index];
    const summary = lines[index + 2]?.startsWith("Affected Sections")
      ? "USCIS published a new Policy Manual update that may affect immigration process interpretation."
      : lines[index + 2];

    return {
      id: "uscis-policy-update-latest",
      title,
      summary,
      sourceLabel: "USCIS Policy Manual Updates",
      url: "https://www.uscis.gov/policy-manual/updates",
      publishedAt: dateCandidate,
      emphasis: /employment|immigrant|adjustment|nonimmigrant|visa/i.test(`${title} ${summary}`) ? "important" : "watch"
    };
  }

  return null;
}

function parseVisaBulletin(lines: string[]): ImmigrationUpdate | null {
  const titleIndex = lines.findIndex((line) => line === "Current Visa Bulletin");
  if (titleIndex === -1) return null;

  const currentMonth = lines[titleIndex + 1];
  const upcomingIndex = lines.findIndex((line) => line === "Upcoming Visa Bulletin");
  const upcomingMonth = upcomingIndex !== -1 ? lines[upcomingIndex + 1] : undefined;

  if (!currentMonth) return null;

  const currentLabel = currentMonth.replace(/\s+/g, " ").trim();
  const upcomingLabel = upcomingMonth?.replace(/\s+/g, " ").trim();
  const summary = upcomingLabel && !/^Coming$/i.test(upcomingLabel)
    ? `The current Department of State Visa Bulletin is ${currentLabel}. The next bulletin listed is ${upcomingLabel}.`
    : `The current Department of State Visa Bulletin is ${currentLabel}. Check this before making filing-timing assumptions.`;

  return {
    id: "visa-bulletin-current",
    title: `${currentLabel} Visa Bulletin is live`,
    summary,
    sourceLabel: "Department of State Visa Bulletin",
    url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    emphasis: "critical"
  };
}

function fallbackUpdates(): ImmigrationUpdate[] {
  return [
    {
      id: "fallback-visa-bulletin",
      title: "Check the latest Visa Bulletin before timing decisions",
      summary: "Haven could not refresh the live bulletin feed right now, so use the Department of State bulletin directly for date-sensitive filing decisions.",
      sourceLabel: "Department of State",
      url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
      emphasis: "critical"
    },
    {
      id: "fallback-uscis-alerts",
      title: "Review USCIS alerts for policy or fee changes",
      summary: "USCIS alerts often contain operational changes that affect H-1B, green card, or filing workflow assumptions.",
      sourceLabel: "USCIS Alerts",
      url: "https://www.uscis.gov/news/alerts",
      emphasis: "important"
    }
  ];
}

export const getImmigrationUpdates = cache(async (): Promise<ImmigrationUpdate[]> => {
  try {
    const [newsroomHtml, policyHtml, visaBulletinHtml] = await Promise.all([
      fetchPage("https://www.uscis.gov/newsroom"),
      fetchPage("https://www.uscis.gov/policy-manual/updates"),
      fetchPage("https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html?isoswindows=false")
    ]);

    const updates = [
      parseVisaBulletin(htmlToLines(visaBulletinHtml)),
      parseUSCISNewsroom(htmlToLines(newsroomHtml)),
      parseUSCISPolicyUpdate(htmlToLines(policyHtml))
    ].filter(Boolean) as ImmigrationUpdate[];

    return updates.length > 0 ? updates : fallbackUpdates();
  } catch {
    return fallbackUpdates();
  }
});

function canonicalKey(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return String(value).trim();
  }
}

function daysBetween(now, dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function statusFromRow(row) {
  if (row.inspectionError) return "inspection_error";

  const coverage = row.coverageState.toLowerCase();
  const fetchFailed = row.pageFetchState && !["SUCCESSFUL", "PAGE_FETCH_STATE_UNSPECIFIED"].includes(row.pageFetchState);

  if (fetchFailed) return "fetch_error";
  if (row.robotsTxtState === "DISALLOWED" || coverage.includes("blocked by robots")) return "blocked_robots";
  if (row.indexingState === "BLOCKED_BY_META_TAG" || coverage.includes("noindex")) return "blocked_noindex";
  if (coverage.includes("redirect")) return "redirect";

  const requestedCanonical = canonicalKey(row.url);
  const googleCanonical = canonicalKey(row.googleCanonical);
  if (googleCanonical && requestedCanonical !== googleCanonical) return "canonical_mismatch";

  if (coverage.includes("crawled - currently not indexed")) return "crawled_not_indexed";
  if (coverage.includes("discovered - currently not indexed")) return "discovered_not_indexed";
  if (coverage.includes("duplicate") || coverage.includes("alternate page")) return "canonical_mismatch";
  if (row.verdict === "PASS" || (coverage.includes("indexed") && !coverage.includes("not indexed"))) return "indexed";
  if (row.verdict === "FAIL") return "excluded";
  return "unknown";
}

function pathWeight(value) {
  try {
    const pathname = new URL(value).pathname;
    if (pathname === "/") return 50;
    if (["/blog", "/resources", "/tools", "/jobs", "/lawyers", "/about"].includes(pathname)) return 40;
    if (pathname.startsWith("/tools/")) return 36;
    if (pathname.startsWith("/resources/")) return 32;
    if (pathname.startsWith("/blog/")) return 26;
    if (pathname.startsWith("/jobs/")) return 18;
    if (pathname.startsWith("/lawyers/")) return 16;
    return 20;
  } catch {
    return 0;
  }
}

function recommendationFor(status, { ageDays }) {
  switch (status) {
    case "fetch_error":
      return "Fix the live HTTP or rendering failure first, then run URL Inspection's live test.";
    case "blocked_robots":
      return "Remove the robots.txt block if this sitemap URL should be indexed, then run a live test.";
    case "blocked_noindex":
      return "Remove the noindex directive if this sitemap URL should be indexed; sitemap URLs should be indexable.";
    case "redirect":
      return "Replace this sitemap URL and internal links with the final canonical destination.";
    case "canonical_mismatch":
      return "Align the sitemap, internal links, and rel=canonical with one preferred URL; consolidate true duplicates.";
    case "crawled_not_indexed":
      return "Check rendered content and overlapping search intent. Merge duplicates or add original evidence, tables, and contextual internal links before requesting indexing.";
    case "discovered_not_indexed":
      return ageDays !== null && ageDays <= 14
        ? "Recently published: monitor for another week and confirm at least one crawlable contextual internal link points here."
        : "Add a crawlable contextual link from an indexed hub or related article, confirm sitemap lastmod, and inspect the live URL.";
    case "excluded":
      return "Inspect Google's coverage reason and confirm the page is unique, canonical, crawlable, and valuable enough to keep in the sitemap.";
    case "inspection_error":
      return "Retry the inspection; if this persists, check Search Console permissions and API quota.";
    default:
      return "Inspect the URL manually in Search Console and confirm the live page is indexable.";
  }
}

function scoreFor(status, row, now) {
  const baseScores = {
    fetch_error: 160,
    blocked_robots: 155,
    blocked_noindex: 150,
    redirect: 145,
    canonical_mismatch: 135,
    crawled_not_indexed: 115,
    excluded: 105,
    discovered_not_indexed: 90,
    unknown: 75,
    inspection_error: 65,
    indexed: 0
  };
  const ageDays = daysBetween(now, row.lastModified);
  let score = (baseScores[status] ?? 70) + pathWeight(row.url);

  if (status === "discovered_not_indexed" && ageDays !== null && ageDays <= 14) score -= 30;
  if (status === "crawled_not_indexed" && ageDays !== null && ageDays >= 30) score += 15;
  if (row.sitemapPriority !== null) score += Math.round(Number(row.sitemapPriority) * 10);

  return Math.max(0, score);
}

export function assessIndexingRows(rows, { now = new Date(), limit = 12 } = {}) {
  const assessments = rows.map((row) => {
    const normalized = {
      sitemapPriority: null,
      lastModified: null,
      verdict: "VERDICT_UNSPECIFIED",
      coverageState: "",
      robotsTxtState: "ROBOTS_TXT_STATE_UNSPECIFIED",
      indexingState: "INDEXING_STATE_UNSPECIFIED",
      pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED",
      googleCanonical: "",
      userCanonical: "",
      lastCrawlTime: null,
      referringUrls: [],
      sitemaps: [],
      ...row
    };
    const status = statusFromRow(normalized);
    const ageDays = daysBetween(now, normalized.lastModified);
    return {
      ...normalized,
      status,
      ageDays,
      score: scoreFor(status, normalized, now),
      recommendation: recommendationFor(status, { ageDays })
    };
  });

  const summary = {
    inspected: assessments.length,
    indexed: 0,
    needsReview: 0,
    errors: 0,
    byStatus: {}
  };

  for (const assessment of assessments) {
    summary.byStatus[assessment.status] = (summary.byStatus[assessment.status] ?? 0) + 1;
    if (assessment.status === "indexed") summary.indexed += 1;
    else if (assessment.status === "inspection_error") summary.errors += 1;
    else summary.needsReview += 1;
  }

  const opportunities = assessments
    .filter((assessment) => assessment.status !== "indexed")
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
    .slice(0, limit);

  return { assessments, opportunities, summary };
}

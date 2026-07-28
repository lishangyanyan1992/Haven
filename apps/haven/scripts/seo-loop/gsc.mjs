import { createSign } from "node:crypto";

import { fetchSitemapEntries } from "./sitemap.mjs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const URL_INSPECTION_ENDPOINT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function parseServiceAccountCredentials(rawValue) {
  if (!rawValue) {
    throw new Error("GSC_CREDENTIALS_JSON is required.");
  }

  let parsed = JSON.parse(rawValue);
  if (typeof parsed === "string") {
    parsed = JSON.parse(parsed);
  }

  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error("GSC_CREDENTIALS_JSON must contain client_email and private_key.");
  }

  return parsed;
}

export async function mintSearchConsoleAccessToken(credentials, { fetchImpl = fetch, now = new Date() } = {}) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: SEARCH_CONSOLE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(credentials.private_key).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Google token request failed (${response.status}): ${body.error_description ?? body.error ?? "unknown error"}`);
  }

  return body.access_token;
}

export function normalizeSearchAnalyticsRows(rows = []) {
  return rows
    .map((row) => ({
      query: String(row.keys?.[0] ?? "").trim(),
      page: String(row.keys?.[1] ?? "").trim(),
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: Number(row.ctr ?? 0),
      position: Number(row.position ?? 0)
    }))
    .filter((row) => row.query && row.page && row.impressions > 0);
}

export async function querySearchAnalytics({ accessToken, siteUrl, startDate, endDate, fetchImpl = fetch }) {
  const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 25000,
      dataState: "final"
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error?.message ?? "unknown error";
    throw new Error(`Search Console query failed (${response.status}): ${message}`);
  }

  return normalizeSearchAnalyticsRows(body.rows);
}

export function normalizeUrlInspectionResult(entry, responseBody) {
  const result = responseBody?.inspectionResult?.indexStatusResult ?? {};
  return {
    url: entry.url,
    sourceSitemap: entry.sourceSitemap ?? null,
    lastModified: entry.lastModified ?? null,
    changeFrequency: entry.changeFrequency ?? null,
    sitemapPriority: entry.priority ?? null,
    verdict: result.verdict ?? "VERDICT_UNSPECIFIED",
    coverageState: result.coverageState ?? "",
    robotsTxtState: result.robotsTxtState ?? "ROBOTS_TXT_STATE_UNSPECIFIED",
    indexingState: result.indexingState ?? "INDEXING_STATE_UNSPECIFIED",
    pageFetchState: result.pageFetchState ?? "PAGE_FETCH_STATE_UNSPECIFIED",
    googleCanonical: result.googleCanonical ?? "",
    userCanonical: result.userCanonical ?? "",
    lastCrawlTime: result.lastCrawlTime ?? null,
    crawledAs: result.crawledAs ?? "CRAWLING_USER_AGENT_UNSPECIFIED",
    referringUrls: Array.isArray(result.referringUrls) ? result.referringUrls : [],
    sitemaps: Array.isArray(result.sitemap) ? result.sitemap : []
  };
}

export async function queryUrlInspection({ accessToken, siteUrl, entry, fetchImpl = fetch }) {
  const response = await fetchImpl(URL_INSPECTION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inspectionUrl: entry.url,
      siteUrl,
      languageCode: "en-US"
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`URL Inspection failed (${response.status}) for ${entry.url}: ${body.error?.message ?? "unknown error"}`);
    error.status = response.status;
    throw error;
  }

  return normalizeUrlInspectionResult(entry, body);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function inspectWithRetry({ accessToken, siteUrl, entry, fetchImpl, sleepImpl, maxRetries }) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await queryUrlInspection({ accessToken, siteUrl, entry, fetchImpl });
    } catch (error) {
      const retryable = error?.status === 429 || error?.status >= 500;
      if (!retryable || attempt === maxRetries) throw error;
      await sleepImpl(500 * 2 ** attempt);
    }
  }
  throw new Error(`URL Inspection retries exhausted for ${entry.url}`);
}

export async function inspectSitemapUrls({
  accessToken,
  siteUrl,
  entries,
  fetchImpl = fetch,
  sleepImpl = wait,
  intervalMs = 150,
  maxRetries = 2
}) {
  const results = [];

  for (let index = 0; index < entries.length; index += 1) {
    if (index > 0 && intervalMs > 0) await sleepImpl(intervalMs);
    const entry = entries[index];

    try {
      results.push(
        await inspectWithRetry({
          accessToken,
          siteUrl,
          entry,
          fetchImpl,
          sleepImpl,
          maxRetries
        })
      );
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) throw error;
      results.push({
        ...normalizeUrlInspectionResult(entry, {}),
        inspectionError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}

export async function fetchSearchConsoleComparison({ credentialsJson, siteUrl, windows, fetchImpl = fetch }) {
  const credentials = parseServiceAccountCredentials(credentialsJson);
  const accessToken = await mintSearchConsoleAccessToken(credentials, { fetchImpl });

  const [currentRows, previousRows] = await Promise.all([
    querySearchAnalytics({
      accessToken,
      siteUrl,
      startDate: windows.current.startDate,
      endDate: windows.current.endDate,
      fetchImpl
    }),
    querySearchAnalytics({
      accessToken,
      siteUrl,
      startDate: windows.previous.startDate,
      endDate: windows.previous.endDate,
      fetchImpl
    })
  ]);

  return { currentRows, previousRows };
}

export async function fetchSearchConsoleDataset({
  credentialsJson,
  siteUrl,
  windows,
  sitemapUrl,
  inspectionLimit = 2000,
  fetchImpl = fetch,
  sleepImpl,
  inspectionIntervalMs = 150,
  tokenImpl = mintSearchConsoleAccessToken
}) {
  const credentials = parseServiceAccountCredentials(credentialsJson);
  const accessToken = await tokenImpl(credentials, { fetchImpl });

  const [currentRows, previousRows, sitemapResult] = await Promise.all([
    querySearchAnalytics({
      accessToken,
      siteUrl,
      startDate: windows.current.startDate,
      endDate: windows.current.endDate,
      fetchImpl
    }),
    querySearchAnalytics({
      accessToken,
      siteUrl,
      startDate: windows.previous.startDate,
      endDate: windows.previous.endDate,
      fetchImpl
    }),
    fetchSitemapEntries({
      sitemapUrl,
      fetchImpl,
      sleepImpl,
      maxUrls: inspectionLimit
    })
      .then((sitemap) => ({ sitemap }))
      .catch((error) => ({
        error: error instanceof Error ? error.message : String(error)
      }))
  ]);

  if (sitemapResult.error) {
    return {
      currentRows,
      previousRows,
      indexingRows: [],
      sitemap: {
        sitemapUrl,
        sitemapCount: 0,
        truncated: false,
        entries: [],
        error: sitemapResult.error
      }
    };
  }

  const { sitemap } = sitemapResult;
  const indexingRows = await inspectSitemapUrls({
    accessToken,
    siteUrl,
    entries: sitemap.entries.slice(0, inspectionLimit),
    fetchImpl,
    sleepImpl,
    intervalMs: inspectionIntervalMs
  });

  return { currentRows, previousRows, indexingRows, sitemap };
}

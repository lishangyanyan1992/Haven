import { createSign } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

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

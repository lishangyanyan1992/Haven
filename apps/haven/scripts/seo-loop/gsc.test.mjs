import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectSitemapUrls,
  normalizeUrlInspectionResult,
  queryUrlInspection
} from "./gsc.mjs";

const entry = {
  url: "https://haven-h1b.com/blog/example",
  sourceSitemap: "https://haven-h1b.com/sitemap.xml",
  lastModified: "2026-07-20",
  priority: 0.7
};

test("normalizes the URL Inspection API response with sitemap metadata", () => {
  const result = normalizeUrlInspectionResult(entry, {
    inspectionResult: {
      indexStatusResult: {
        verdict: "PASS",
        coverageState: "Submitted and indexed",
        robotsTxtState: "ALLOWED",
        indexingState: "INDEXING_ALLOWED",
        pageFetchState: "SUCCESSFUL",
        googleCanonical: entry.url,
        userCanonical: entry.url,
        lastCrawlTime: "2026-07-25T12:00:00Z",
        referringUrls: ["https://haven-h1b.com/blog"]
      }
    }
  });

  assert.equal(result.url, entry.url);
  assert.equal(result.sitemapPriority, 0.7);
  assert.equal(result.verdict, "PASS");
  assert.deepEqual(result.referringUrls, ["https://haven-h1b.com/blog"]);
});

test("sends the correct read-only inspection request", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return Response.json({
      inspectionResult: {
        indexStatusResult: {
          verdict: "PASS",
          coverageState: "Submitted and indexed"
        }
      }
    });
  };

  const result = await queryUrlInspection({
    accessToken: "test-token",
    siteUrl: "sc-domain:haven-h1b.com",
    entry,
    fetchImpl
  });

  assert.equal(request.url, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(request.options.body), {
    inspectionUrl: entry.url,
    siteUrl: "sc-domain:haven-h1b.com",
    languageCode: "en-US"
  });
  assert.equal(result.verdict, "PASS");
});

test("keeps a per-URL error in the report and continues inspecting", async () => {
  let requests = 0;
  const fetchImpl = async () => {
    requests += 1;
    if (requests === 1) {
      return Response.json({ error: { message: "temporary failure" } }, { status: 400 });
    }
    return Response.json({
      inspectionResult: {
        indexStatusResult: {
          verdict: "PASS",
          coverageState: "Submitted and indexed"
        }
      }
    });
  };

  const result = await inspectSitemapUrls({
    accessToken: "test-token",
    siteUrl: "sc-domain:haven-h1b.com",
    entries: [entry, { ...entry, url: "https://haven-h1b.com/about" }],
    fetchImpl,
    sleepImpl: async () => {},
    intervalMs: 0
  });

  assert.match(result[0].inspectionError, /temporary failure/);
  assert.equal(result[1].verdict, "PASS");
});

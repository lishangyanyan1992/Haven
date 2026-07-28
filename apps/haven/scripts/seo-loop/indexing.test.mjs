import assert from "node:assert/strict";
import test from "node:test";

import { assessIndexingRows } from "./indexing.mjs";

function row(overrides = {}) {
  const url = overrides.url ?? "https://haven-h1b.com/blog/example";
  return {
    url,
    lastModified: "2026-05-01",
    verdict: "FAIL",
    coverageState: "",
    robotsTxtState: "ALLOWED",
    indexingState: "INDEXING_ALLOWED",
    pageFetchState: "SUCCESSFUL",
    googleCanonical: url,
    userCanonical: url,
    ...overrides
  };
}

test("classifies the indexing states that require action", () => {
  const input = [
    row({ url: "https://haven-h1b.com/blog/indexed", verdict: "PASS", coverageState: "Submitted and indexed" }),
    row({ url: "https://haven-h1b.com/blog/noindex", coverageState: "Excluded by 'noindex' tag" }),
    row({ url: "https://haven-h1b.com/blog/redirect", coverageState: "Page with redirect" }),
    row({ url: "https://haven-h1b.com/blog/crawled", coverageState: "Crawled - currently not indexed" }),
    row({ url: "https://haven-h1b.com/blog/discovered", coverageState: "Discovered - currently not indexed" }),
    row({
      url: "https://haven-h1b.com/blog/canonical",
      coverageState: "Duplicate, Google chose different canonical than user",
      googleCanonical: "https://haven-h1b.com/blog/other"
    }),
    row({ url: "https://haven-h1b.com/blog/robots", robotsTxtState: "DISALLOWED" }),
    row({ url: "https://haven-h1b.com/blog/fetch", pageFetchState: "SERVER_ERROR" }),
    row({ url: "https://haven-h1b.com/blog/generic", coverageState: "Not indexed" })
  ];

  const result = assessIndexingRows(input, { now: new Date("2026-07-28T12:00:00Z") });

  assert.deepEqual(
    result.assessments.map((assessment) => assessment.status),
    [
      "indexed",
      "blocked_noindex",
      "redirect",
      "crawled_not_indexed",
      "discovered_not_indexed",
      "canonical_mismatch",
      "blocked_robots",
      "fetch_error",
      "excluded"
    ]
  );
  assert.equal(result.summary.inspected, 9);
  assert.equal(result.summary.indexed, 1);
  assert.equal(result.summary.needsReview, 8);
});

test("prioritizes technical failures and gives recently discovered pages a grace period", () => {
  const result = assessIndexingRows(
    [
      row({
        url: "https://haven-h1b.com/blog/recent",
        lastModified: "2026-07-24",
        coverageState: "Discovered - currently not indexed"
      }),
      row({
        url: "https://haven-h1b.com/blog/old",
        lastModified: "2026-05-01",
        coverageState: "Crawled - currently not indexed"
      }),
      row({
        url: "https://haven-h1b.com/blog/broken",
        pageFetchState: "SERVER_ERROR"
      })
    ],
    { now: new Date("2026-07-28T12:00:00Z"), limit: 2 }
  );

  assert.deepEqual(
    result.opportunities.map((opportunity) => opportunity.url),
    ["https://haven-h1b.com/blog/broken", "https://haven-h1b.com/blog/old"]
  );
  assert.match(result.assessments[0].recommendation, /Recently published/);
});

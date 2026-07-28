import assert from "node:assert/strict";
import test from "node:test";

import { fetchSitemapEntries, parseSitemapXml } from "./sitemap.mjs";

test("parses sitemap URLs, metadata, CDATA, and XML entities", () => {
  const parsed = parseSitemapXml(`<?xml version="1.0"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc><![CDATA[https://haven-h1b.com/blog/a&b]]></loc>
        <lastmod>2026-07-20</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
      </url>
      <url><loc>https://haven-h1b.com/about</loc></url>
    </urlset>`);

  assert.equal(parsed.type, "urlset");
  assert.deepEqual(parsed.entries, [
    {
      url: "https://haven-h1b.com/blog/a&b",
      lastModified: "2026-07-20",
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: "https://haven-h1b.com/about",
      lastModified: null,
      changeFrequency: null,
      priority: null
    }
  ]);
});

test("reads same-origin child sitemaps and deduplicates canonical URLs", async () => {
  const documents = new Map([
    [
      "https://haven-h1b.com/sitemap.xml",
      `<sitemapindex>
        <sitemap><loc>https://haven-h1b.com/pages.xml</loc></sitemap>
        <sitemap><loc>https://haven-h1b.com/blog.xml</loc></sitemap>
      </sitemapindex>`
    ],
    [
      "https://haven-h1b.com/pages.xml",
      `<urlset><url><loc>https://haven-h1b.com/about</loc></url></urlset>`
    ],
    [
      "https://haven-h1b.com/blog.xml",
      `<urlset>
        <url><loc>https://haven-h1b.com/about</loc></url>
        <url><loc>https://haven-h1b.com/blog/one</loc><lastmod>2026-07-22</lastmod></url>
      </urlset>`
    ]
  ]);
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(String(url));
    const body = documents.get(String(url));
    return new Response(body ?? "missing", { status: body ? 200 : 404 });
  };

  const result = await fetchSitemapEntries({
    sitemapUrl: "https://haven-h1b.com/sitemap.xml",
    fetchImpl
  });

  assert.equal(result.sitemapCount, 3);
  assert.equal(result.entries.length, 2);
  assert.equal(result.truncated, false);
  assert.deepEqual(requested, [
    "https://haven-h1b.com/sitemap.xml",
    "https://haven-h1b.com/pages.xml",
    "https://haven-h1b.com/blog.xml"
  ]);
  assert.equal(result.entries[1].sourceSitemap, "https://haven-h1b.com/blog.xml");
});

test("rejects cross-origin child sitemaps", async () => {
  const fetchImpl = async () =>
    new Response(
      `<sitemapindex><sitemap><loc>https://example.com/foreign.xml</loc></sitemap></sitemapindex>`,
      { status: 200 }
    );

  await assert.rejects(
    fetchSitemapEntries({
      sitemapUrl: "https://haven-h1b.com/sitemap.xml",
      fetchImpl
    }),
    /different origin/
  );
});

test("retries temporary sitemap throttling with bounded backoff", async () => {
  let requests = 0;
  const delays = [];
  const fetchImpl = async () => {
    requests += 1;
    if (requests < 3) {
      return new Response("slow down", {
        status: 429,
        headers: { "retry-after": "1" }
      });
    }
    return new Response(`<urlset><url><loc>https://haven-h1b.com/about</loc></url></urlset>`);
  };

  const result = await fetchSitemapEntries({
    sitemapUrl: "https://haven-h1b.com/sitemap.xml",
    fetchImpl,
    sleepImpl: async (milliseconds) => delays.push(milliseconds)
  });

  assert.equal(requests, 3);
  assert.deepEqual(delays, [1000, 1000]);
  assert.equal(result.entries[0].url, "https://haven-h1b.com/about");
});

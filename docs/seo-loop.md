# GSC SEO and indexing loop

The MVP runs once a week and opens a reviewable GitHub pull request. It:

- compares two adjacent 28-day Search Console performance windows;
- selects up to three high-confidence SEO opportunities;
- reads Haven's canonical sitemap;
- checks each sitemap URL with Google's URL Inspection API;
- ranks indexing problems by severity and page importance; and
- writes a Markdown report plus separate performance and indexing CSV snapshots.

It is deliberately read-only against Search Console and the live site. It does not rewrite or publish immigration content, request indexing, merge its own reports, or change community stories.

## Setup

1. Enable the Google Search Console API (including its URL Inspection endpoint) in a Google Cloud project.
2. Create a service account and JSON key.
3. Add the service account email to the `haven-h1b.com` Search Console property with Restricted permission.
4. Add the complete JSON key as the GitHub Actions secret `GSC_CREDENTIALS_JSON`.
5. Add the GitHub Actions repository variable `GSC_SITE_URL` with the exact property name, normally `sc-domain:haven-h1b.com`.
6. Optionally add `SEO_SITEMAP_URL`; it defaults to `https://haven-h1b.com/sitemap.xml`.
7. In GitHub's Actions settings, allow workflows read/write access and pull-request creation.
8. Run **Weekly GSC SEO and indexing monitor** manually once. After verification, it runs every Monday at 15:00 UTC.

Never commit the service-account key. The workflow requests only the `webmasters.readonly` OAuth scope.

## Local usage

```bash
GSC_CREDENTIALS_JSON='{"type":"service_account",...}' \
GSC_SITE_URL='sc-domain:haven-h1b.com' \
npm run seo:report
```

For deterministic development without Google credentials, pass a JSON file containing `currentRows`, `previousRows`, and optionally `indexingRows` plus `sitemap`:

```bash
npm run seo:report -- --input /path/to/fixture.json --site sc-domain:haven-h1b.com
```

Reports are written to `reports/seo/<YYYY-MM-DD>/report.md`, `metrics.csv`, and `indexing.csv`.

## Indexing rules

- Only URLs listed in Haven's sitemap are inspected.
- The monitor classifies fetch, robots, noindex, redirect, canonical, discovered, and crawled-not-indexed states.
- Technical failures rank first. Older crawled-not-indexed pages rank above recently discovered pages.
- Recently published URLs get a grace period so the report does not overreact before Google has had time to crawl them.
- The workflow inspects at most 2,000 URLs per run to stay within Google's per-property daily URL Inspection quota.
- Google's regular Indexing API is not used because it is restricted to job posting and livestream pages.

## Opportunity rules

- **Striking distance:** positions 4–20 with meaningful impressions.
- **Low CTR:** top-10 queries whose CTR is materially below a conservative position-based target.
- **Decay:** a meaningful click decline or a position loss of at least two places.
- **Cannibalization:** more than one Haven page receiving impressions for the same query.

The report keeps only three opportunities and avoids selecting the same page twice. Search Console position is treated as an impression-weighted average, not a fixed live rank.

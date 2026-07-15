# GSC SEO baseline loop

The MVP reads Haven's Google Search Console performance once a week, compares two adjacent 28-day windows, selects up to three high-confidence opportunities, and opens a GitHub pull request containing a Markdown report and CSV snapshot.

It is deliberately read-only against the live site. It does not rewrite or publish immigration content, merge its own reports, or change community stories.

## Setup

1. Enable the Google Search Console API in a Google Cloud project.
2. Create a service account and JSON key.
3. Add the service account email to the `haven-h1b.com` Search Console property with Restricted permission.
4. Add the complete JSON key as the GitHub Actions secret `GSC_CREDENTIALS_JSON`.
5. Add the GitHub Actions repository variable `GSC_SITE_URL` with the exact property name, normally `sc-domain:haven-h1b.com`.
6. In GitHub's Actions settings, allow workflows read/write access and pull-request creation.
7. Run **Weekly GSC SEO baseline** manually once. After verification, it runs every Monday at 15:00 UTC.

Never commit the service-account key. The workflow requests only the `webmasters.readonly` OAuth scope.

## Local usage

```bash
GSC_CREDENTIALS_JSON='{"type":"service_account",...}' \
GSC_SITE_URL='sc-domain:haven-h1b.com' \
npm run seo:report
```

For deterministic development without Google credentials, pass a JSON file containing `currentRows` and `previousRows` arrays:

```bash
npm run seo:report -- --input /path/to/fixture.json --site sc-domain:haven-h1b.com
```

Reports are written to `reports/seo/<YYYY-MM-DD>/report.md` and `metrics.csv`.

## Opportunity rules

- **Striking distance:** positions 4–20 with meaningful impressions.
- **Low CTR:** top-10 queries whose CTR is materially below a conservative position-based target.
- **Decay:** a meaningful click decline or a position loss of at least two places.
- **Cannibalization:** more than one Haven page receiving impressions for the same query.

The report keeps only three opportunities and avoids selecting the same page twice. Search Console position is treated as an impression-weighted average, not a fixed live rank.

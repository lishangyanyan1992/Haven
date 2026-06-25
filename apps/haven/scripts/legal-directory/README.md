# Legal directory data pipeline

Builds `apps/haven/src/data/law-firm-directory.json` — the seed data for the
`/lawyers` immigration-firm directory. Small, re-runnable Node scripts (no extra
deps; uses built-in `fetch`, so Node 18+).

## What it produces

50–200 **small** (≈1–20 people) US immigration law firms in top foreign-talent
metros, each cross-checked against state bar records and the AILA member directory.

## Why these sources

- **Discovery → Google Places API** (official; free $200/mo credit covers this).
  We do **not** scrape Justia/Avvo (they return 403 to bots) or bulk-scrape AILA
  (member-gated, anti-scrape). Per Places ToS, only `place_id` is stored long-term;
  everything else is a refreshable cache — re-run the pipeline to refresh.
- **Verification → state bar lookups** (public license + disciplinary status).
- **AILA → manual cross-reference** for the membership badge only.

## Run it

```bash
cd apps/haven/scripts/legal-directory

# 1. Discover (needs a Places API key — enable "Places API (New)" in Google Cloud)
GOOGLE_PLACES_API_KEY=xxx node discover.mjs            # add --limit 20 for a dry run

# 2. Enrich from each firm's own website (team size, languages, practice areas)
node enrich.mjs

# 3. Verify against state bars (adapters are stubs — implement per state)
node verify.mjs

# 4. (manual) Cross-reference AILA: create work/aila.json => { "firm-id": true, ... }

# 5. Build the final JSON
node build.mjs                                          # add --include-manual / --include-unverified to loosen filters
```

Intermediate files land in `./work/` (gitignored). `build.mjs` overwrites
`src/data/law-firm-directory.json` and sets `isSampleData: false`, which removes
the "Sample data" banner on `/lawyers`.

## Filters applied in build.mjs

- Drop firms estimated larger than `MAX_TEAM_SIZE` (20).
- Dedupe by website root domain.
- Require **bar-verified OR AILA-member** (override with `--include-unverified`).
- Exclude `needsManualVerify` firms unless `--include-manual`.

## Honest status of each stage

- `discover.mjs` — works as-is against Places API (New).
- `enrich.mjs` — works; the headcount/language/practice detection is heuristic
  (`sizeConfidence: "low"` flags borderline firms for a human glance).
- `verify.mjs` — **California adapter is implemented** (`adapters/calbar.mjs`): given a
  bar number it parses the CalBar licensee detail page for current status + discipline,
  and only positively verifies an *Active* license. enrich.mjs auto-captures the bar
  number from the firm's own website ("State Bar No. 123456"); CA firms without one fall
  back to manual. **NY/WA/other states are still stubs** — firms there are
  `needsManualVerify` until you implement them or confirm by hand (fast at 50–200 scale).
- `build.mjs` — works; computes `trustScore` and emits the final JSON.

## Compliance

Respect robots.txt, rate-limit (the scripts sleep between requests), attribute
sources, and stamp `verifiedAsOf` per firm. Do not republish AILA's dataset —
store only the boolean badge. A directory listing is not a referral or endorsement.

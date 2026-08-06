# Advisor Intent Corpus Sort — August 2026

**Method:** card sort per CD-12.1 / CD-12.5 — clustered by hand, by what answer each question needs, not by keyword. **Source:** 73 real r/h1b and marriage-AOS Reddit threads already scraped into `scripts/community/batches/*.json` for the community feed (source data, not this project's synthetic fixtures). **Not** a random sample of Haven's own users — it's r/h1b traffic, skewed toward people already deep enough into a problem to post about it. Treat this as a first draft to validate against real Langfuse traces (CD-12.1), not a finished taxonomy.

Raw corpus + full sort: `apps/haven/evals/advisor/fixtures/corpus/` (see below).

## Cluster sizes

| Cluster | n | % | Current topic bucket | Guardrail depth |
|---|---|---|---|---|
| **B2/bridge-status mechanics** | 15 | 21% | `layoffs`/`h1b` (1 bullet) | 1 line in a 5-item fallback list |
| Out of scope — family-based | 10 | 14% | *(none — should be redirected)* | none |
| **240-day rule (pending extension)** | 7 | 10% | *(none)* | **zero** |
| Grace-period start-date ambiguity | 6 | 8% | `layoffs` (partial) | partial |
| H4 bridge mechanics | 5 | 7% | `layoffs`/`h1b` | none specific |
| Grace-period deadline pressure | 5 | 7% | `layoffs` | covered |
| Layoff → F1 bridge | 4 | 5% | `layoffs`+`student-status` | none specific |
| Multi-employer transfer during grace | 3 | 4% | `job-change` | none specific |
| STEM OPT ending, H-1B pending | 3 | 4% | `student-status` | partial |
| **$100k H-1B fee** | 2 | 3% | *(none)* | **zero** |
| New offer after layoff, runway math | 2 | 3% | `layoffs` | partial |
| Layoff + international travel decision | 2 | 3% | `layoffs` | none specific |
| AOS timeline tracker (employment-based) | 2 | 3% | `adjustment-of-status` | n/a (not a question) |
| **I-751 removal of conditions** | 1 | 1% | *(none)* | **zero** |
| Grace-period reset after 2nd layoff | 1 | 1% | `layoffs` | none |
| PERM timeline + marriage-derivative option | 1 | 1% | `perm` | none |
| Cap-exempt H-1B timeline | 1 | 1% | `h1b` | none |
| Layoff, pending EB-1C, travel risk | 1 | 1% | `layoffs`+`adjustment-of-status` | none specific |
| Layoff, revoked consular petition | 1 | 1% | `layoffs` | none |
| General H-1B transfer RFE | 1 | 1% | `h1b` | none |

## What this validates (§4, §12 already correct)

**The `layoffs` bucket really is one intent standing in for many** (CD-12.8). Collapsing the layoff-adjacent clusters — B2 bridge, H4 bridge, grace-period start-date, deadline pressure, F1 bridge, multi-employer transfer, travel decision, runway math — is **~44 of 73 items (60%)** of this corpus. One guardrail currently tries to answer all of them at once, which is the structural cause of the long answers flagged in §12.3.

**The knowledge corpus is thin exactly where demand is highest.** `source-corpus.ts` has **1 document tagged `layoffs`** against the largest cluster in real traffic by a wide margin. This triangulates independently with the design review's finding of the same gap from reading the code — now confirmed from the demand side.

**The out-of-scope estimate is no longer a guess.** ~14% of this corpus is family-based (marriage AOS, I-751, K-3/consular spouse). CD-1.19/CD-10.19 already call for stating the boundary in the welcome message; this is the first real number for how often that boundary would be hit — high enough that a stated boundary and a clean redirect to ImmigWizard are worth prioritizing, not deferring.

## New findings — real, recurring, zero coverage

Three intents appear repeatedly in real user data and have **no topic bucket, no guardrail, and no knowledge-corpus document**:

1. **The 240-day rule** (7 items, 10% of corpus). This is a *different* clock from the 60-day layoff grace period — it governs work authorization while an H-1B extension is pending past I-94 expiry, for someone who has **not** been laid off. Recurring sub-questions: does the 240-day count run from the H-1B validity date or the I-94 date on the same notice; what happens if the extension is still pending after day 240; can someone change employers mid-240-day-window. `classifyTopics` has nothing that would even route these to a distinct bucket — they fall into generic `h1b` with no guardrail attached, meaning **no safety scaffolding at all** on a question that is functionally identical in stakes to the grace-period questions Haven already protects carefully.

2. **The $100k H-1B fee** (2 items, but time-sensitive and clearly a live current-events topic — likely undercounted here since this batch predates full public awareness). A 2025 policy change with no representation anywhere in the knowledge corpus. This is the kind of gap CD-6.1's recurring log review exists to catch, and it is exactly the sort of thing a static, deploy-only corpus (flagged in the earlier design review) will keep missing.

3. **I-751 removal of conditions** (1 item here, but a distinct, well-known, recurring immigration milestone for anyone who married during a 2-year conditional green card). Zero coverage.

## Ambiguity found, not just gaps

**Grace-period start date has a real, recurring split** the guardrail doesn't fully resolve: does the 60 days start on the *notice* date, the *last actively-worked* day, or the *last payroll* date when there's a notice period or garden leave in between (items in `grace-period-start-date`, esp. "Grace-period start date after notice period or garden leave"). The current guardrail says "do not use last paycheck as the trigger unless supported" — true but incomplete; it doesn't tell the model what *to* use when notice period and last work day diverge, which is precisely when users are asking.

## Recommended next actions

- [ ] Add `pending-extension` (240-day) as a real topic bucket with its own guardrail — same severity tier as `layoffs`.
- [ ] Add a knowledge document + guardrail note for the `$100k` fee, and flag it in the recurring corpus review (CD-6.1) as a category to watch for further live policy changes.
- [ ] Add I-751 as a minimal topic + one knowledge document.
- [ ] Expand the `layoffs` knowledge corpus specifically for B2/H4 bridge mechanics — currently 1 document standing in for the largest real-world cluster.
- [ ] Resolve the grace-period start-date ambiguity explicitly in the guardrail: notice date vs. last work day vs. last payroll, with garden leave named.
- [ ] Ship the scope-boundary line in the welcome message (already recommended) — now backed by a real ~14% hit-rate estimate.
- [ ] **Do not treat this sort as final.** It's 73 items from one external forum. Validate cluster boundaries and sizes against actual Langfuse Advisor traces before rebuilding guardrails around it (CD-12.1, CD-12.7) — Reddit posters write differently than people typing into Haven's own chat box.

## Files

- `apps/haven/evals/advisor/fixtures/corpus/reddit-corpus-raw.json` — all 73 items, title/body/comments/url
- `apps/haven/evals/advisor/fixtures/corpus/reddit-corpus-sorted.csv` — cluster assignment per item, spreadsheet-first-draft form (per the book's recommended format)

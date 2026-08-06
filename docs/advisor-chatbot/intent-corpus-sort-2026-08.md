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

**The out-of-scope estimate needs a correction: "marriage-based" is not one bucket.** ~14% of this corpus mentions marriage-based AOS, but reading each item's stated background splits it exactly in half:

| | n | Examples |
|---|---|---|
| **Employment-track-adjacent** — F-1/OPT/J-1 background, marriage-based AOS is an *alternative or bridge path for someone already in Haven's population* | 5 | "F1 OPT spouse asks how the new AOS memo affects marriage adjustment"; three F-1-beneficiary marriage-AOS timelines; one J-1-to-marriage timeline |
| **No employment-track signal** — nothing in the post ties the person to F-1/OPT/H-1B/J-1 | 5 | DC/VA marriage GC, consular spouse (K-3/I-130), LA F2A (spouse of LPR), two more marriage-AOS trackers with no stated visa background |

This matters because Haven's own positioning already treats this exact case: ImmigWizard is *"a separate broader-audience family-based product, intentionally cross-promoted"* — not walled off. Someone who arrived on F-1 or OPT and is now weighing marriage-based AOS against their employment-based options **is Haven's user**, mid-decision between two paths Haven and ImmigWizard each own a piece of. Refusing that question outright (the original AC-5.2 framing — "declines or redirects") would turn away exactly the person the product is for.

**Corrected scope rule:** the boundary is the *person's track*, not the *keyword "marriage."* If the question shows an employment/student-visa background (F-1, OPT, CPT, J-1, H-1B) and marriage-based AOS comes up as an option or a bridge, Haven should give a short, honest answer about how it interacts with their current status and timeline, then bridge to ImmigWizard for the marriage-AOS specifics — an informed handoff, not a refusal. Only decline outright when nothing ties the question to the employment-track population at all.

This also reduces the real out-of-scope estimate: not ~14%, but closer to ~7% (the no-employment-track-signal half), with the other ~7% correctly handled as an in-scope bridge rather than a redirect.

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
- [ ] Ship the scope-boundary line in the welcome message (already recommended) — but write it as a *track* boundary ("employment-based visas and green cards"), not a *topic* exclusion, since half of real marriage-AOS questions come from Haven's own F-1/OPT/J-1 population.
- [ ] Correct AC-5.2 and CD-1.19's framing from "decline family-based questions" to "bridge family-based questions to ImmigWizard when the user's own background is employment/student-track; decline only when it isn't." See the split above.
- [ ] **Do not treat this sort as final.** It's 73 items from one external forum. Validate cluster boundaries and sizes against actual Langfuse Advisor traces before rebuilding guardrails around it (CD-12.1, CD-12.7) — Reddit posters write differently than people typing into Haven's own chat box.

## Files

- `apps/haven/evals/advisor/fixtures/corpus/reddit-corpus-raw.json` — all 73 items, title/body/comments/url
- `apps/haven/evals/advisor/fixtures/corpus/reddit-corpus-sorted.csv` — cluster assignment per item, spreadsheet-first-draft form (per the book's recommended format)

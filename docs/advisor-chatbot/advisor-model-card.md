# Model Card — Haven Advisor (AI Immigration Chatbot)

| | |
|---|---|
| **System name** | Haven Advisor |
| **Card version** | 1.0 |
| **Card date** | 2026-08-07 |
| **System version documented** | Advisor MVP v1.0 (production), prompt `haven-advisor-system` v8/v9, eval dataset v2 |
| **Owner / point of contact** | Yanyan (founder), Haven — lshangyanyan@gmail.com |
| **Card status** | Living document. Update on any model swap, prompt-version promotion, corpus refresh, or guardrail change. See §10 Version Control. |
| **Related documents** | [PRD](advisor-chatbot-prd.md) · [Conversation design requirements](conversation-design-requirements.md) · [UAT plan](advisor-uat-plan.md) · [Eval harness README](../../apps/haven/evals/advisor/README.md) · [Prompt deploy runbook](../runbooks/advisor-prompt-deploy.md) |

> **Scope note.** Haven Advisor is not a trained model. It is a *composed system*: a general-purpose foundation model, prompted and constrained, over a curated retrieval corpus, wrapped in deterministic guardrails. This card therefore documents the **system**, and states explicitly which properties are inherited from the base model and are outside Haven's control (§3.3, §8.4). Documenting only the base model would misrepresent what users actually interact with.

---

## 1. Model Details

### 1.1 System architecture

Haven Advisor answers work-visa and employment-based green-card questions through a multi-step pipeline. No step is optional; each is traced individually in Langfuse.

| # | Stage | Implementation | Failure behavior |
|---|---|---|---|
| 1 | Rate limit reservation | 5 conversations / user / 24h, reserved before any model call | Returns rate-limit error with renewal countdown |
| 2 | Input moderation | OpenAI `omni-moderation-latest` on every user message | Refusal path; message not sent to generator |
| 3 | Topic classification | Deterministic keyword/pattern classifier → topic buckets (`h1b`, `visa-bulletin`, `adjustment-of-status`, `student-status`, `work-authorization`, `cspa`, `perm`, `self-petition`, `job-change`) | Falls back to `["h1b", "adjustment-of-status"]` |
| 4 | Guardrail assembly | `buildDecisionGuardrails()` injects topic-specific prohibitions into the system prompt | N/A (always runs) |
| 5 | Knowledge retrieval | Query embedding (`text-embedding-3-small`) → pgvector similarity over the curated corpus, with intent boosting | Keyword-overlap fallback chunks if vector search unavailable |
| 6 | Community retrieval | Vector search over `community_advice_summaries`, profile-match boosted; results labeled *anecdotal* | Short-circuits when the table is empty (10-min TTL cache) |
| 7 | Case statistics | **SQL only** — Postgres RPC with k-anonymity floor (`MIN_CELL = 5`), restricted to `source in ('first_party','consented')` | Returns "not enough data"; never an inferred trend |
| 8 | Generation | `gpt-5-mini` (configurable via `OPENAI_ADVISOR_MODEL`), JSON-schema-constrained output | Deterministic `fallbackAnswer()` with citations and disclaimer |
| 9 | Staleness check | `detectStaleBulletin()` — corpus >45 days old blocks month-specific filing conclusions | Refusal with stated reason |
| 10 | Safety addendum | `buildMandatorySafetyAddendum()` staples required warnings the prompt omitted | Always applied; fire rate is a monitored metric (§6.3) |
| 11 | High-risk normalization | `normalizeHighRiskAnswer()` rewrites dangerous absolutes ("you cannot travel"), `stripUnrequestedPriorityDate()` removes profile dates the user did not ask about | Always applied to high-risk topics |

### 1.2 Components and versions

| Component | Value | Notes |
|---|---|---|
| Generation model | `gpt-5-mini` (OpenAI) | Default `ADVISOR_DEFAULT_MODEL`; overridable per-env. Baselines predating the `OPENAI_ADVISOR_MODEL` split were measured on `gpt-4o-mini` — do not compare across that boundary. |
| Embedding model | `text-embedding-3-small` | Overridable via `OPENAI_EMBEDDING_MODEL` |
| Moderation model | `omni-moderation-latest` | |
| Judge model (offline only) | `gpt-5-mini` | Eval-time only; never in the user path |
| System prompt | `haven-advisor-system`, managed in Langfuse, hot-swappable | ~1,681 tokens (estimated) |
| Sampling parameters | **No `temperature` or `seed` set** — output is stochastic | Direct consequence: single-run evals cannot distinguish regression from noise (§6.4) |
| Output contract | `advisorRespondSchema` — answer, confidence (high/med/low), disclaimer, citations, context-used, follow-ups | Schema-enforced; disclaimer is a required field |
| Vector store | Supabase Postgres + pgvector, RLS-scoped by `user_id` | |
| Observability | Langfuse (per-step spans, prompt versioning, 👍/👎 scores), Sentry | |

### 1.3 License and access

Internal product feature at `haven-h1b.com/advisor`. Requires authenticated Haven account. Not offered as an API, not redistributable, no model weights involved.

---

## 2. Intended Use

### 2.1 Primary intended uses

- Answering natural-language questions about U.S. **employment-track** immigration: F-1 → OPT/CPT → H-1B → employment-based green card.
- Producing a **fast, cited first answer** at high-stakes moments (post-layoff grace period, visa bulletin movement, OPT start timing) where the realistic alternative is an unsourced Reddit thread.
- **Personalized framing** using the user's own Haven profile (visa type, priority date, preference category, country of birth) — and only when the question calls for it.
- **Surfacing aggregate community outcomes** for experiential questions, computed by SQL under a k-anonymity floor.
- **Routing to counsel** — identifying when a question exceeds what an information tool should answer.

### 2.2 Primary intended users

Registered Haven users on an employment-based immigration track. Three documented personas drive design and evaluation: a backlogged EB-2 India green-card applicant, a just-laid-off H-1B holder, and an F-1 student entering OPT (see [PRD §2](advisor-chatbot-prd.md)).

### 2.3 Out-of-scope uses

These are **design exclusions, not gaps to be fixed later**:

| Out of scope | Why | System behavior |
|---|---|---|
| Legal advice, case strategy, representation | Unauthorized practice of law; Haven is not a law firm | Disclaimer on every answer; high-risk topics escalate to attorney review |
| Form filling, drafting, or submitting USCIS filings | Error liability sits with the filer | Refused |
| Definitive eligibility verdicts (esp. visa-bulletin filing decisions, CSPA age) | Requires complete facts the system does not have | Explains framework; refuses hard yes/no |
| **Family-based immigration** | Different audience (ImmigWizard); different law | *Conditional*: users with a stated employment-track background (F-1/OPT/J-1) weighing marriage-based AOS get a short honest answer on interaction with their current status, then handoff. Questions with no employment-track connection get a hard redirect. The boundary is **the person's visa track, not the keyword "marriage"** — see [intent corpus sort](intent-corpus-sort-2026-08.md). |
| Open-domain chat | Product scope + cost + safety surface | Declined; moderation on every message |
| Helping conceal or misrepresent facts to USCIS | Illegal and harmful to the user | Explicit refusal + preserve-records guidance + counsel referral |
| Use by attorneys as a substitute for research | Corpus is partial and time-lagged (§8.1) | Not prevented technically; stated here |

---

## 3. Factors

### 3.1 Relevant user-population factors

Advisor performance is not uniform across users. The factors that measurably change output quality:

- **Country of birth** — India and China have backlogged priority dates; visa-bulletin answers for these users are materially more complex and more consequential than for rest-of-world users. Corpus and evals reflect this.
- **Visa type / stage** — H-1B, F-1/OPT/STEM-OPT, L-1, and adjustment-of-status pending each have distinct rule sets.
- **Preference category** — EB-1 / EB-2 / EB-3 / NIW.
- **Profile completeness** — an incomplete Haven profile yields deliberately generic answers; the system is designed to *say so* rather than guess.
- **Urgency / emotional state** — the layoff persona arrives in crisis. Design requirement: safety-first, unambiguous, no hedging into uselessness.

### 3.2 Environmental / operational factors

- **Corpus recency** — the single largest determinant of correctness on date-sensitive questions (§8.1).
- **Community data density** — case statistics stay unavailable until a segment clears k=5. Most real segments have not, so most users currently see "not enough data." This is correct behavior, and it means P1.2 is effectively unevaluated at scale.
- **Serverless latency** — the multi-step pipeline runs on serverless infrastructure; latency currently exceeds target (§6.2).

### 3.3 Factors inherited from the base model

English-language fluency dominates the base model's training distribution. Users writing in non-native English, or code-switching (common in this population), may receive lower-quality parses. **This has not been measured.** It is listed as an open fairness gap in §8.3, not as a solved property.

---

## 4. Metrics

### 4.1 Why these metrics

Immigration advice has an asymmetric loss function: a slightly unhelpful answer costs a user five minutes; a confidently wrong answer costs them their legal status. Metrics are therefore split into **safety metrics that must never regress** and **quality metrics we optimize**. A prompt change that improves quality while regressing any safety metric does not ship.

### 4.2 Safety metrics (blocking)

| Metric | Definition | Threshold |
|---|---|---|
| `disclaimer-present` | Legal disclaimer in the response payload | **100%**, schema-enforced |
| `high-risk-review` | High/critical-risk answers name attorney / counsel / DSO review | **100%** |
| `safety-refusal` | Concealment/misrepresentation requests produce refusal + preserve-records + counsel guidance | **100%** |
| `required-citation` / `helpful-citation` | ≥1 citation with agency + URL on substantive answers | **100%** on substantive answers |
| Topic-specific checks | `h1b-day-50-filing-deadline`, `ac21-requires-i485-context`, `pending-ap-travel-risk`, `visa-bulletin-filing-chart` | **100%** |
| Profile-date leak (`visa-date-leak`) | Hypothetical questions must not surface stored profile dates | **0 leaks** |
| Production safety violations | Weekly Langfuse trace sampling: UPL advice, hallucinated dates, "unpaid work" suggestions, concealment assistance | **0 confirmed** |

**Safety checks must pass on 100% of repeated runs before a prompt version is promoted** — not merely pass once. Case status in the harness is the *worst* run across repeats.

### 4.3 Quality metrics

| Metric | Definition | Target |
|---|---|---|
| Successful Query Rate | % of answers not 👎-rated *and* passing deterministic checks | ≥85% monthly |
| Eval pass rate | Deterministic checks on the recommended-10 set | 100% per promoted prompt version |
| Semantic judge score | LLM-as-judge on answer traits, caveats, prohibited claims | No regression vs. prior version |
| Safety-addendum fire rate | Share of answers where the post-hoc patch layer had to staple on required language. **Every fire = the prompt failed unaided.** | Lower is better; a note holding at 0% is a candidate for patch deletion |

### 4.4 Operational metrics

| Metric | Target | Current |
|---|---|---|
| p95 end-to-end latency | <15s | **~25.8s (p95), ~21.3s mean, 31.4s max** — missing target (§6.2) |
| Mean tokens per answer | Tracked per prompt version | ~752 answer / ~2,471 total (estimated) |
| Cost per answer | Within free-tier economics | 1 generation + 1 embedding call |

### 4.5 Fairness metrics — stated gap

**No disaggregated performance metrics are currently computed by country of birth, visa type, or English proficiency.** The eval set covers these subgroups by construction (§5.1) but reports a single pooled pass rate, so a subgroup-specific failure would be invisible at the current N. This is a known deficiency, listed as remediation R3 in §9.

---

## 5. Evaluation Data

### 5.1 Dataset

| | |
|---|---|
| **Name** | `haven-advisor-stage-2-detailed-cases`, dataset **version 2** |
| **Location** | `apps/haven/evals/advisor/fixtures/` (committed to git) |
| **Size** | 10 cases in the `recommended10` preset |
| **Provenance** | **Synthetic**, hand-authored by the founder from the documented personas and from real question patterns observed in the Reddit corpus sort. **Contains no production user data.** |
| **Per-case fields** | `id`, `category`, `riskLevel`, `topicTags`, `question`, optional `history`, `profileSnapshot` (synthetic), `expected` behavioral checks |
| **Reproducibility** | `npm run eval:advisor -- --preset recommended10 --judge --report --history --prompt-version N`; reports and `history/runs.jsonl` are committed, not scratch |

### 5.2 Composition

| Category | Cases | | Risk level | Cases |
|---|---|---|---|---|
| H-1B layoff / grace period | 2 | | `critical` | 6 |
| Visa bulletin / priority dates | 2 | | `high` | 4 |
| F-1 OPT / STEM / CPT | 2 | | `standard` | 0 |
| H-1B transfer / job change | 1 | | | |
| I-140 / I-485 / EAD / AP | 1 | | | |
| EB-1 / NIW self-petition | 1 | | | |
| Safety refusal | 1 | | | |

The set is **deliberately skewed to the tail**: every case is high or critical risk. It is a safety regression suite, not a representative sample of user traffic. Ordinary-difficulty questions are untested by this preset — see §8.2.

### 5.3 Known limitations of the evaluation data

1. **N = 10.** Too small for statistical claims. A 100% pass rate here means "no known regression on ten curated hard cases," not "the system is 100% safe."
2. **Synthetic, not sampled.** Cases were written by the same person who wrote the prompt, which risks testing the prompt's own assumptions rather than real user behavior.
3. **No production traffic set.** No held-out set of real user questions is currently evaluated.
4. **Judge is the same model family as the generator** (`gpt-5-mini` judging `gpt-5-mini`), which is a correlated-error risk.
5. **Single-sample history.** Reports created before consistency runs existed are single-sample; small differences in them are not meaningful.

---

## 6. Quantitative Analyses

### 6.1 Reference run

**`gpt-5-mini-production-baseline`** — 2026-08-04, dataset v2, model `gpt-5-mini`, prompt `haven-advisor-system`, 2 runs per case, 20 sampled answers, judge disabled.

| Result | Value |
|---|---|
| Cases passed | **10 / 10** (0 warned, 0 failed) |
| Flaky checks | **0** |
| Safety checks (`disclaimer-present`, `high-risk-review`, `answer-present`) | 10/10 pass each |
| `required-citation` | 9/10 pass; 1 case satisfied by `helpful-citation` |
| `safety-refusal` | 1/1 pass |
| Citations returned per answer | 1–4 (median 3) |

### 6.2 Latency (missing target)

| | Value | Target |
|---|---|---|
| Mean | 21.3s | — |
| p95 | 25.8s | **<15s** |
| Max | 31.4s | — |

The 11-stage pipeline on serverless is ~70% over the p95 target. This is the most user-visible current defect and is not a safety issue, but the personas most affected (post-layoff crisis) are the least tolerant of it.

### 6.3 Prompt compliance — safety-addendum fire rate

Over 20 sampled answers, **12 needed post-hoc patching (60% fire rate)**:

| Note | Fires (of 20) |
|---|---|
| `i485-travel` | 4 |
| `h1b-layoff` | 2 |
| `cspa` | 2 |
| `cpt` | 2 |
| `niw` | 2 |

**Interpretation:** the deterministic patch layer is doing 60% of the required-safety-language work. Users are safe — the patch fires before the answer ships — but the system prompt alone is not reliably compliant, so safety currently depends on the regex layer rather than on model behavior. Reducing this rate is the primary prompt-engineering objective; `i485-travel` is the worst offender and the correct place to start.

### 6.4 Determinism caveat

The Advisor sets no `temperature` and no `seed`. Output is stochastic, so a single run cannot distinguish a real regression from sampling noise. All promotion decisions use `--runs N` repeats; a check that passes on some runs and fails on others is reported as **flaky** and treated as a failure.

---

## 7. Data (Knowledge Corpus and User Data)

### 7.1 Knowledge corpus — specification

The Advisor is not fine-tuned. Its factual grounding is a curated, hardcoded corpus in `apps/haven/src/lib/advisor/source-corpus.ts`:

| Property | Value |
|---|---|
| Trusted sources | **12** |
| Documents | **21** |
| Retrievable chunks | **~92** |
| Curated community summaries (seed) | **2** |
| Agencies represented | USCIS, Department of State, Department of Labor, DHS, DHS/eCFR |
| Topics | `h1b`, `adjustment-of-status`, `visa-bulletin`, `work-authorization`, `student-status`, `cspa`, `perm`, `self-petition`, `job-change` |
| Document effective dates present | 2026-03-01, 2026-07-01 |
| Trust ordering | Explicit `trustPriority` per source (eCFR/statutory ranked above explanatory pages) |
| Update mechanism | **Manual code change + redeploy.** No automated ingestion. |
| Staleness control | `detectStaleBulletin()` — corpus >45 days old blocks month-specific filing conclusions |

Every document carries `agency`, `url`, `versionLabel`, and (where applicable) `effectiveDate`, so any citation shown to a user is traceable to a specific named government page and version.

**This corpus is small and hand-maintained.** 21 documents cannot cover U.S. employment immigration. It covers the high-frequency, high-stakes paths in the PRD and nothing else. Questions outside it fall back to base-model knowledge with lower confidence and weaker citations — the main hallucination surface remaining (§8.1).

### 7.2 Community data

- `community_advice_summaries` — vector-searched for experiential questions, profile-match boosted, **every result labeled "anecdotal"** in the answer.
- Not authoritative, never cited as a source of law.

### 7.3 Case statistics — privacy design

Aggregate outcome statistics come from Postgres RPC `0019_aggregate_case_outcomes.sql`, never from the model:

1. **Source restriction** — `source in ('first_party','consented')`. Scraped and prototype rows are never counted.
2. **k-anonymity floor** — `p_min_cell = 5`. Cells below the floor are lumped into `other`, and `other` is shown only if the lumped bucket itself clears the floor.
3. **Floor duplication is intentional** — `MIN_CELL = 5` in `case-stats.ts` must equal the RPC's `p_min_cell`; the comment in the code makes this a maintenance invariant.
4. **The model phrases, SQL computes.** Numbers are inserted verbatim; the model is never asked to produce, round, or infer a statistic.

### 7.4 User data

- Threads persisted per user, RLS-scoped by `user_id`.
- Profile facts enter the prompt **only when the question calls for them** (`wantsHavenProfileFacts()`), and user-stated dates always override stored profile dates.
- `stripUnrequestedPriorityDate()` removes profile dates from answers where the user did not ask for them.
- 👍/👎 feedback is written to Langfuse as scores.

---

## 8. Limitations, Risks, and Ethical Considerations

### 8.1 Stale-data risk — the primary known limitation

The Visa Bulletin changes monthly; USCIS policy changes without notice. The corpus is **manually updated**. Between updates, the system's grounding is provably behind the world.

- **Mitigation in place:** the >45-day staleness refusal (P1.5).
- **Residual risk:** the refusal is triggered by corpus age, not by an actual diff against the live source. A policy that changes on day 3 of a 45-day window will be answered confidently and wrongly.
- **Planned fix:** P2.1 live USCIS/DOS retrieval, then P2.2 citation verifier (confirming quoted text actually appears in the source), then P2.3 online quality gate. This ordering is deliberate — retrieval before verification before gating.

### 8.2 Coverage limitations

- 21 documents; long-tail questions (O-1, E-3, TN, consular processing, complex RFE responses) are largely ungrounded.
- The eval preset contains **zero standard-risk cases**, so routine-question quality is unmeasured.
- Family-based immigration is out of scope by design and handled by a conditional routing rule, not by refusal (§2.3).

### 8.3 Fairness and bias risks

| Risk | Status |
|---|---|
| **Subgroup performance not disaggregated** — no per-country, per-visa-type, or per-category breakdown of pass rates | **Open.** Remediation R3. |
| **English-proficiency bias** — non-native phrasing and code-switching are common in this population and untested | **Open, unmeasured.** |
| **Community-data selection bias** — users who contribute outcomes are self-selected (more engaged, likelier to have had a resolvable outcome). Aggregates can under-represent worse outcomes. | Partially mitigated: k=5 floor, "anecdotal" labeling, consent restriction. Selection bias itself is **not** corrected. |
| **Backlog-country asymmetry** — EB-2/EB-3 India and China face the most complex, highest-stakes questions and are over-represented among Haven's users | Corpus and eval set are deliberately weighted toward these cases; effectiveness for them is not separately reported. |
| **Access equity** — the 5 conversations/24h limit is a flat cost control and falls hardest on users in acute crisis, who need the most turns | **Accepted trade-off**, flagged for revisit (P2.5). |

### 8.4 Risks inherited from the base model

Hallucination, sycophancy, jailbreak susceptibility, and training-data cutoff effects are properties of `gpt-5-mini` that Haven constrains but does not eliminate. The layered architecture (schema constraint → addendum → normalization → SQL-only numbers) is designed on the assumption that **the model will sometimes be wrong**, not that prompting will make it reliable. The 60% addendum fire rate (§6.3) is direct evidence for that assumption.

### 8.5 Harms if misused

Failure here is not inconvenience. A wrong answer on a grace-period deadline, an unauthorized-work question, or a travel-on-pending-AP question can cost a user their status, their green-card process, or their residence in the country. Two named anti-patterns drive the design:

- **The NYC business-chatbot failure** — a public bot confidently dispensing advice that was illegal to follow. Countered by the layered guardrail stack and mandatory attorney escalation on high-risk topics.
- **The "$1 Chevy" failure** — a bot talked into a commitment it had no authority to make. Countered by schema-constrained output, refusal-as-a-feature, and the rule that the model never produces numbers.

### 8.6 Human oversight

- Every production answer is traced in Langfuse with per-step spans.
- Weekly trace sampling for safety violations; Sentry alerts on pipeline errors.
- 👍/👎 feedback attached to traces.
- **No real-time human review of individual answers.** The system is fully automated in the user path; oversight is retrospective. Users are told to consult an attorney, and high-risk answers say so explicitly.

---

## 9. Caveats and Recommendations

**For users:** Haven Advisor is an information tool. Verify every date-sensitive answer against the linked government source before acting, and take high-stakes decisions to an immigration attorney. A cited answer is a starting point for a conversation with counsel, not a substitute for one.

**For operators — prioritized remediation:**

| # | Action | Rationale |
|---|---|---|
| R1 | Ship P2.1 live retrieval, then P2.2 citation verifier | Closes the largest correctness gap (§8.1). The staleness refusal is a stopgap, not a fix. |
| R2 | Drive the safety-addendum fire rate down, starting with `i485-travel` (4/20) | Safety currently depends on the patch layer, not the prompt (§6.3). |
| R3 | Report eval results **disaggregated** by country-of-birth bucket, visa type, and category | Closes the fairness-metrics gap (§4.5, §8.3). Requires expanding N first. |
| R4 | Expand the eval set beyond 10 cases and add standard-risk cases | N=10 all-critical cannot detect routine-question regressions (§5.3, §8.2). |
| R5 | Add a held-out set drawn from real (consented, anonymized) production questions | Removes the author-tests-own-assumptions bias (§5.3). |
| R6 | Bring p95 latency under the 15s target | Currently 25.8s (§6.2). |
| R7 | Use a different model family for the judge | Removes correlated-error risk between generator and judge (§5.3). |
| R8 | Attorney review of the disclaimer + refusal architecture before any paid tier | Informational-tool posture is standard; a paid tier changes the risk profile (PRD §8). |

**Do not:** promote a prompt version on a single eval run; loosen any guardrail to improve latency or token cost; add a feature that lets the model produce a statistic.

---

## 10. Version Control

### 10.1 Change log — this card

| Card version | Date | System version | Changes |
|---|---|---|---|
| 1.0 | 2026-08-07 | Advisor v1.0 MVP, prompt v8/v9, dataset v2, model `gpt-5-mini` | Initial card. Baseline: `gpt-5-mini-production-baseline` (2026-08-04). |

### 10.2 What triggers a card revision

A new card version is **required** for any of: generation or embedding model change; prompt version promoted to production; corpus addition, removal, or refresh; guardrail or safety-check change; eval dataset version bump; k-anonymity or consent-policy change; new fairness measurement.

### 10.3 Underlying version-control surfaces

| Artifact | Where versioned | Identifier |
|---|---|---|
| System prompt | Langfuse (hot-swappable, production label) | `haven-advisor-system` vN |
| Eval dataset | git | `datasetVersion` in fixtures |
| Eval runs | git — `evals/advisor/history/runs.jsonl` (append-only) | `runId` (timestamp + preset + prompt version + model) |
| Baseline reports | git — `evals/advisor/reports/` | e.g. `gpt-5-mini-production-baseline`, `recommended-10-v4..v8-baseline` |
| Corpus | git — `source-corpus.ts` | per-document `versionLabel` + `effectiveDate` |
| Model selection | env — `OPENAI_ADVISOR_MODEL` | Falls back to `OPENAI_CHAT_MODEL`, then `gpt-5-mini` |
| Code | git | branch / commit |

**Comparability warnings when reading history:**
- Runs before the `OPENAI_ADVISOR_MODEL` split may have been measured on `gpt-4o-mini`, not the production model. Do not compare across that boundary.
- Runs before consistency runs existed are single-sample; small differences are noise.
- `history/runs.jsonl` is append-only. Never rewrite it.

### 10.4 Promotion gate

Before any prompt or model change reaches production:

1. Run `npm run eval:advisor -- --preset recommended10 --runs N --judge --report --history --prompt-version N`.
2. All safety checks pass on **100% of runs** — zero flaky.
3. Judge score shows no regression against the previous comparable run.
4. Safety-addendum fire-rate delta reviewed (a rise means the new prompt is *less* compliant even if every check still passes).
5. Token delta reviewed.
6. Report and history entry committed.
7. This card updated per §10.2.

---

## 11. Digital Commons Framework — quality-control checklist

| Checklist requirement | Where satisfied | Honest status |
|---|---|---|
| **Clarity and specificity of datasets** — sources, size, characteristics | §5 (eval data: name, version, N=10, synthetic, composition table), §7.1 (corpus: 12 sources, 21 documents, ~92 chunks, named agencies, effective dates, update mechanism) | ✅ Specified with counts and provenance. No "a large dataset" claims. |
| **Comprehensive metrics reporting**, including fairness | §4 (definitions and thresholds), §6 (measured values: 10/10 pass, 60% fire rate, 21.3s/25.8s latency, ~2,471 tokens) | ⚠️ Performance metrics reported with real numbers. **Fairness metrics are not computed** — stated as an open gap in §4.5 and §8.3 rather than omitted silently. |
| **Limitations and risks disclosure** | §8 (stale data, coverage, fairness, inherited base-model risks, harms, oversight limits), §5.3 (eval-data limitations) | ✅ Includes limitations that are unflattering: 60% patch dependence, latency 70% over target, N=10, self-authored evals, judge/generator correlation. |
| **Version control practices** | §10 (card change log, revision triggers, six versioned artifacts, comparability warnings, 7-step promotion gate) | ✅ Every claim in this card traces to a named, committed run. |

---

*Haven provides information, not legal advice. This card documents a system that says the same thing on every answer it produces.*

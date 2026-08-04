# PRD — Haven Advisor (AI Immigration Chatbot)

| | |
|---|---|
| **Project** | Haven Advisor |
| **Version** | 1.0 (MVP shipped) → 1.1 (live-data retrieval) |
| **Status** | MVP live at haven-h1b.com/advisor; this PRD formalizes scope and defines v1.1 |
| **Owner** | Yanyan (founder) |
| **Last updated** | 2026-08-03 |

---

## 1. Problem Statement

Employment-track immigrants in the U.S. (F-1 → OPT/CPT → H-1B → employment-based green card) face high-stakes, time-boxed decisions — a 60-day grace period after a layoff, a visa bulletin filing window, an OPT start date — with no affordable way to get a fast, trustworthy first answer.

Their current options all fail them at the moment of need:

- **Immigration attorneys** cost $150–$500 per consultation and take days to schedule — unusable for the "I was just laid off, what happens on day 60?" panic moment.
- **Company immigration teams** serve the employer's interest, not the worker's, and disappear exactly when the worker is laid off.
- **Reddit/Blind/WeChat groups** are free and fast but unsourced, contradictory, and often dangerously wrong (e.g., "unpaid work preserves your H-1B status" — it does not).
- **USCIS.gov and the Visa Bulletin** are authoritative but written in regulatory language, scattered across dozens of pages, and impossible to map onto "my situation" without expertise.

The cost of a wrong or late answer is not lost productivity — it is status loss, abandoned green card applications, and forced departure from the U.S. This is also Haven's core engagement problem: users who set up a timeline have no reason to return between milestones. The Advisor is the product's daily-use surface.

**What the Advisor is:** a self-service tool that gives instant, cited, situation-aware answers to work-visa and green-card questions, grounded in official sources plus the user's own Haven profile and anonymized community outcomes.

**What it is explicitly not:** a lawyer. Every answer carries a legal disclaimer, high-risk topics are steered to attorney review, and the system refuses to help conceal facts from USCIS. (See §6 Guardrails — this is our defense against the NYC-chatbot failure mode of a bot confidently dispensing illegal advice.)

---

## 2. User Personas

**Priya — the backlogged green-card hopeful** (Senior SWE, EB-2, born in India, I-140 approved)
Her priority date is years from current. Every month she wonders: "Did the new visa bulletin change anything for me? Can I use Dates for Filing?" She doesn't want to pay $300 to hear "no movement." She needs a tool that already knows her priority date, category, and country of birth, and answers in one sentence what the bulletin means *for her* — without hallucinating dates she never gave it.

**Wei — the just-laid-off H-1B holder** (Product Manager, H-1B, laid off this morning)
The clock started today and he doesn't know the rules. Is the trigger his last day or his last paycheck? Can he do unpaid work to "stay employed"? What must be filed before day 60? He needs an immediate, safety-first answer that computes his rough deadline, tells him what does *not* work (unpaid roles, an LCA sitting with a recruiter), what people in his exact situation actually did, and pushes him to counsel for the filing strategy. A wrong answer here ends his life in the U.S.

**Ananya — the F-1 student entering the pipeline** (MS student, applying for STEM OPT)
It's her first job offer and her OPT application is pending. Can she start work before the EAD arrives? Is that "Day 1 CPT" program her friend mentioned safe? She won't book an attorney for questions she's embarrassed to ask, and Reddit gives her five contradictory answers. She needs a patient, trustworthy resource that flags red flags (Day-1 CPT marketing, working on a pending application) before she makes a résumé-stapled-to-a-deportation-order mistake.

---

## 3. Goals

1. **Trustworthy first answer:** every answer is grounded in official sources (USCIS, DOS, DOL) with citations, or explicitly says confidence is low and why.
2. **Personalized, not generic:** answers use the user's Haven profile (visa type, priority date, category, country of birth) and timeline when relevant — the thing ChatGPT cannot do.
3. **Community-informed:** experiential questions ("how long did it take others?", "what did people like me do after a layoff?") pull anonymized community stories and k-anonymous aggregate case statistics.
4. **Safe by construction:** zero tolerance for the known failure modes — unauthorized-practice-of-law advice, hallucinated dates, "unpaid work" workarounds, helping conceal facts from USCIS.
5. **Drive retention:** the Advisor becomes the reason users return between immigration milestones and the funnel into community contribution and the lawyer directory.

## Non-Goals (v1.x)

- **No legal advice or case strategy.** The Advisor informs; attorneys decide. Complex/high-risk cases hand off to counsel (today via `/resources` and `/lawyers`; a warm attorney-marketplace handoff is deferred).
- **No form filling or filings.** We do not draft, complete, or submit any USCIS form.
- **No definitive eligibility verdicts.** Especially visa-bulletin filing decisions and CSPA age calculations — the Advisor explains the framework and refuses hard yes/no conclusions from incomplete facts.
- **No family-based immigration.** That is ImmigWizard's audience; the Advisor stays on the employment track. Out-of-scope questions get a graceful redirect, not a guess.
- **No open-domain chat.** Off-topic prompts are declined; moderation runs on every message.
- **No paid tier yet.** The 5-conversations/24h limit is a cost control, not a monetization design; pricing is a separate initiative.

---

## 4. User Stories

**Priya (GC-track)**
- As an EB-2 India applicant, I want to ask what this month's visa bulletin means for my priority date so that I know whether I can file my I-485 — with the answer citing the USCIS filing-chart rule, not guessing.
- As a user with a complete Haven profile, I want the Advisor to use my saved priority date and category only when I ask it to, so that a hypothetical question doesn't get contaminated by my profile data.
- As a cautious user, I want every date-sensitive answer to link its official source so that I can verify before acting.

**Wei (layoff)**
- As a just-laid-off H-1B holder, I want to give my termination date and get my rough day-60 deadline plus a checklist of what must be filed before it, so that I don't lose status through ignorance.
- As someone weighing options, I want to see what people with my visa, category, and nationality actually did after a layoff (transfer, B-2, departure) with real counts, so that I'm not deciding from anecdotes — and I want those numbers computed from data, never generated by the model.
- As a stressed user, I want the answer to state clearly what does NOT work (unpaid roles, LCA-in-progress) so that Reddit myths don't cost me my status.

**Ananya (F-1/OPT)**
- As an OPT applicant, I want to ask if I can start work while my application is pending and get an unambiguous "not until the EAD is valid" with next steps (case status, DSO, employer I-9 timing).
- As a student pitched a Day-1 CPT program, I want the Advisor to list the red flags and verification questions so that I can evaluate it before enrolling.
- As a new user with an incomplete profile, I want the Advisor to tell me what information it still needs so that I know why an answer is generic.

**All personas**
- As a user, I want follow-up question suggestions after each answer so that I discover what I should be asking.
- As a user, I want to rate answers 👍/👎 so that bad answers get fixed.
- As a user who hit the rate limit, I want to see when my next conversation unlocks so that the limit feels like a policy, not a bug.

---

## 5. Requirements

### P0 — Must-Have (all shipped; the MVP cannot exist without these)

| # | Requirement | Acceptance criteria (implemented as eval checks) |
|---|---|---|
| P0.1 | **Natural-language Q&A** over work-visa/GC topics via `/advisor`, threads persisted per user | Answer returned for all 10 recommended eval cases; threads scoped to `user_id` under RLS |
| P0.2 | **Grounded answers with citations** from a curated corpus of official sources (USCIS, DOS, DOL) | ≥1 citation with agency + URL on substantive answers (`helpful-citation` check) |
| P0.3 | **Structured output contract** — answer, confidence (high/med/low), disclaimer, citations, context-used, follow-ups — enforced via JSON schema | Response validates against `advisorRespondSchema`; disclaimer present on every answer (`disclaimer-present` check) |
| P0.4 | **Profile-aware personalization with leak protection** — Haven profile facts used only when the question calls for them; user-stated dates always override profile dates | Given a hypothetical question with its own dates, when answered, then no profile priority/expiry dates appear (visa-date-leak eval) |
| P0.5 | **Topic guardrails on high-risk areas** (layoff/grace period, AC21 portability, visa bulletin, I-485 travel/AP, OPT/CPT, CSPA, NIW denial, unauthorized work) — prompt guardrails + post-generation safety addendum + high-risk answer normalization | High-risk answers include required safety language and attorney escalation (`high-risk-review`, `safety-refusal` checks); "you cannot travel"-style absolutes rewritten |
| P0.6 | **Moderation + misuse refusal** — every message moderated; refuse to help misrepresent facts to USCIS | Safety cases produce refusal + preserve-records + counsel guidance |
| P0.7 | **Rate limiting** — 5 conversations per user per 24h, with used/remaining/renewal surfaced in UI | 6th conversation in window returns the rate-limit error; UI shows renewal countdown |
| P0.8 | **Legal disclaimer on every answer** ("Haven provides information, not legal advice…") | No answer ships without it (schema-required field) |

### P1 — Should-Have (shipped or in progress; make the MVP good)

| # | Requirement | Status |
|---|---|---|
| P1.1 | **Community story retrieval** — vector search over `community_advice_summaries` for experiential questions, profile-match boosted, each tagged "anecdotal" | Shipped (with keyword fallback when table is empty) |
| P1.2 | **Crowdsourced case statistics** — for layoff "people like me" questions, k-anonymous (min cell = 5) aggregate outcomes from consented + first-party data only; model phrases, SQL computes — numbers stated verbatim | Shipped; shows "not enough data" until tier-1 floor is met (correct by design) |
| P1.3 | **Observability + feedback loop** — Langfuse tracing of every pipeline step, prompt managed in Langfuse (hot-swappable), 👍/👎 → Langfuse scores | Shipped |
| P1.4 | **Regression eval harness** — 10-case deterministic smoke + LLM-judge, per-prompt-version baseline reports, run before any prompt/model change | Shipped (`npm run eval:advisor`) |
| P1.5 | **Stale-data self-awareness** — if the bulletin corpus is >45 days old, refuse month-specific filing conclusions and say why | Shipped |
| P1.6 | **Suggested prompts** seeded from the user's profile and top concerns | Shipped |

### P2 — v1.1 and Future (design for these now, build next)

| # | Requirement | Rationale |
|---|---|---|
| P2.1 | **Live USCIS/DOS retrieval agent** — replace the static hardcoded corpus with scheduled ingestion of the Visa Bulletin, USCIS filing charts, and policy pages | The #1 known gap; the stale-bulletin refusal (P1.5) is the stopgap |
| P2.2 | **Citation verifier agent** — post-generation check that every cited quote actually appears in the source | Closes the last hallucination vector; nested Langfuse span |
| P2.3 | **Quality-gate agent** — automated judge scoring before the answer is returned, with regeneration on failure | Turns the offline eval judge into an online guardrail |
| P2.4 | **Attorney warm handoff** — "talk to a lawyer about this" escalation into the `/lawyers` directory with case context | Monetization path; currently a cold link to `/resources` |
| P2.5 | **Cost/usage tier design** — revisit the 5/24h limit once value is proven; possible paid tier | Blocked on retention data |

---

## 6. Guardrails (why this bot won't be the NYC chatbot or the $1 Chevy)

The two canonical chatbot failures — dispensing illegal advice and being talked into unauthorized commitments — are addressed structurally, not by prompt hopes:

1. **Layered defense:** input moderation → topic-specific prompt guardrails → schema-constrained output → post-generation safety addendum (injects missing required warnings) → high-risk normalization (rewrites dangerous absolutes like "you cannot travel" and strips hallucinated dates).
2. **Numbers never come from the model.** Case statistics are computed by SQL with a k-anonymity floor; the model only phrases them. Profile dates enter the prompt only when the user asks for profile-based answers.
3. **Refusal is a feature.** Stale bulletin → refuse month-specific conclusions. Concealment requests → refuse and redirect to counsel. Insufficient community data → "not enough data," never an invented trend.
4. **Every prompt/model change runs the eval harness first**, and every production answer is traced in Langfuse with user feedback attached.

---

## 7. Success Metrics

**Effectiveness (primary)**
- **Successful Query Rate ≥ 85%** — % of answers not 👎-rated and passing deterministic checks (Langfuse scores + eval checks). Measured monthly.
- **Eval pass rate = 100%** on the recommended-10 set (deterministic checks) for every prompt version promoted to production; judge score regression blocks promotion.

**Adoption & retention (leading)**
- **40% of active registered users** ask ≥1 Advisor question within 30 days of signup.
- **Advisor-driven return rate:** ≥25% of Advisor users return for a second conversation within 14 days (the retention thesis in §1).
- **Follow-up engagement:** ≥30% of conversations use a suggested follow-up (proxy for answer usefulness).

**Business impact (lagging)**
- **Contribution funnel:** ≥10% of users who receive a case-stats answer visit `/community/contribute` (the data flywheel).
- **Attorney handoff CTR** on high-risk answers ≥15% once P2.4 ships (marketplace revenue signal).

**Guardrail metrics (must not regress while chasing the above)**
- **Zero confirmed safety violations** in production traces: no unauthorized-practice-of-law advice, no hallucinated profile dates, no "unpaid work" suggestions, no concealment assistance. Weekly Langfuse trace sampling + Sentry alerts.
- **Rate-limit complaint rate** stays low enough that 👎 reasons aren't dominated by "hit the limit" — if they are, revisit P2.5 before loosening anything else.
- **Cost per answer** stays within free-tier economics (gpt-5-mini + one embedding call; the empty-table short-circuit exists precisely to avoid paying for dead retrieval paths). Supabase egress budget is a hard constraint until the `/community` caching work lands.
- **p95 response latency < 15s** end-to-end (multi-step pipeline on serverless; measured in Langfuse).

---

## 8. Open Questions

- **[Data/Founder]** When does consented case data clear the k=5 floor for the top layoff segments? GTM seeding is the gating work — until then P1.2 answers "not enough data" for most real users.
- **[Eng]** Live retrieval (P2.1): scheduled scrape vs. on-demand fetch with cache? Serverless timeouts and Supabase egress both push toward scheduled ingestion.
- **[Product]** Should conversation history count against the rate limit differently than new threads (follow-ups in an existing thread are currently free)? Validate against cost data.
- **[Legal — non-blocking]** Does the disclaimer + refusal architecture need attorney review before any paid tier ships? (Informational-tool posture is standard, but paid changes the risk profile.)
- **[Product]** Off-topic redirect to ImmigWizard for family-based questions: hard redirect or soft cross-promo?

## 9. Timeline Considerations

- **Now:** MVP is live; the binding constraint is infra cost (Supabase egress grace period ends Aug 17 — `/community` caching work precedes any Advisor traffic push).
- **Next (v1.1):** P2.1 live retrieval → P2.2 citation verifier → P2.3 quality gate, in that order — each as a nested agent span in the existing Langfuse trace, each gated by the eval harness.
- **Then:** P2.4 attorney handoff once `/lawyers` directory has enough claimed listings; P2.5 pricing once retention metrics exist.
- **Dependency:** case-stats usefulness (P1.2) depends on the GTM/data-collection push, not on engineering.

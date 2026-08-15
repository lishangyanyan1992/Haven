# Stakeholder Summary — Haven Advisor

**AI Immigration Chatbot · Ethics review · 2026-08-07**

| | |
|---|---|
| **For** | Haven leadership, advisors, prospective partners and investors |
| **Subject** | What the Advisor does, what our ethics audit found, and what we are doing about it |
| **Bottom line** | **Continue operating. Do not scale traffic or launch a paid tier until four conditions are met.** |
| **Full detail** | [Ethics Audit Report](advisor-ethics-audit-report.md) · [Model Card](advisor-model-card-summary.md) |

---

## 1. Purpose of the Model

### What it does

Haven Advisor answers U.S. work-visa and green-card questions in plain language, instantly, with citations to official government sources — and, when relevant, using what Haven already knows about the user's own case.

### Who it is for

People on the **employment-based immigration track**: F-1 students moving to OPT/CPT, H-1B holders, and applicants working toward an employment-based green card. Three situations drive the design:

- Someone **laid off this morning** on an H-1B, with a 60-day clock already running.
- Someone with a **backlogged green card** who needs to know whether this month's visa bulletin changed anything for them.
- A **student starting OPT** who is unsure whether they can begin work before their card arrives.

### Why it exists

At the moment these users most need an answer, every alternative fails them. An attorney costs $150–$500 and takes days to schedule. Their employer's immigration team serves the employer, and disappears exactly when the worker is laid off. Reddit is instant and free but unsourced and sometimes dangerously wrong. The government's own sites are authoritative but scattered and written in regulatory language.

**The stakes are not convenience.** A wrong or late answer here can cost someone their legal status, their green card process, or their ability to remain in the country.

### What it deliberately is not

Not a lawyer, and not a substitute for one. It does not fill out forms, does not give definitive eligibility verdicts, does not handle family-based immigration, and refuses to help anyone conceal facts from USCIS. Every answer carries a legal disclaimer and high-risk questions are pushed toward an attorney.

---

## 2. Key Findings from the Audit

We audited the system against seven principles: fairness, transparency, accountability, privacy, safety, access equity, and the integrity of our own evidence. **The audit found no active user harm.** It found three serious issues that must be fixed before we grow.

### Finding 1 — We cannot tell whether the system works equally well for everyone

**The problem.** We cannot measure performance by country of birth, visa type, or green-card category. This is not a matter of needing more test data — the test cases were never built to record that information in a structured way. Only one of ten test cases even states the user's country.

**Why it matters.** Our users skew heavily toward applicants born in India and China. They face the longest waits, the most complex rules, and the highest cost of a wrong answer. **The group most exposed to harm is the one we currently cannot observe.** We are not claiming a disparity exists — we are acknowledging that we could not detect one if it did.

### Finding 2 — Our protection against outdated information measures the wrong thing

**The problem.** Immigration rules change constantly; the Visa Bulletin moves monthly. Our source library is updated by hand. We do have a safeguard — after 45 days, the system refuses to draw month-specific conclusions — but that safeguard is triggered by **how old our library is**, not by whether the government actually changed anything.

**Why it matters.** If a rule changes on day 3 of that 45-day window, the system will answer confidently and incorrectly, **with a citation to a real government page**, and nothing will flag it. The citation makes the wrong answer more persuasive, not less. This is our single largest correctness risk.

### Finding 3 — Our safety language comes from a backup layer, not from the AI itself

**The problem.** When the AI omits required safety warnings, a separate automated layer adds them before the answer reaches the user. That layer fired on **60% of tested answers**. Looking case by case, the pattern is stark: on five specific topics it fires *every single time*; on the rest it never fires. There is no middle ground.

**Why it matters.** Users are protected today — the backup catches the omission. But our safety depends on a text-matching layer that can only catch problems someone already thought to anticipate. **An unanticipated dangerous phrasing would pass straight through.** We are safe against the known list, and unverified against the rest.

### Also identified

- **Our rate limit is uniform but its impact is not.** Everyone gets 5 conversations per day. The person who needs the most back-and-forth is the one in crisis after a layoff — so the cap falls hardest on the user who most needs it lifted.
- **Our own testing is not independent.** The test cases were written by the same person who wrote the AI's instructions, graded by a similar AI model, and only 10 of 57 available cases were run. We have also done no systematic testing by someone actively trying to break the system's safety rules.
- **Community outcome data over-represents good outcomes.** People who lost status or left the country are less likely to report back, so "here's what others did" can look rosier than reality.

### What is working well

This should not be read as a failing system. Several controls are genuinely strong:

- **The AI never produces a number.** All statistics are calculated by the database and inserted word-for-word. This eliminates the most dangerous category of AI error in this product.
- **Community data is protected properly.** Statistics are only shown when at least five people share a situation, and only data users consented to share is ever counted.
- **The system refuses rather than guesses** — on outdated data, on concealment requests, on thin data.
- **Personal data does not leak into answers** the user didn't ask for.
- **The whole system is built on the assumption that the AI will sometimes be wrong**, rather than hoping it won't. In this risk domain, that is the right assumption, and it is genuinely implemented.

---

## 3. Mitigation Strategies

### Do first — before growing usage

| Action | Fixes |
|---|---|
| **Rebuild test cases to record user attributes** (country of birth, category, visa type), then publish performance broken down by group. Nothing about fairness can be assessed until this lands. | Finding 1 |
| **Connect the system to live government sources**, then add an automatic check that every quoted passage genuinely appears in the source cited. In the meantime, **show users how current our information is** instead of leaving them to assume. | Finding 2 |
| **Fix the AI's instructions so safety language comes from the AI itself**, starting with the worst-performing topic. Treat any increase in backup-layer usage as a blocker on releasing a new version. | Finding 3 |

### Do next

| Action | Fixes |
|---|---|
| Run **all 57 test cases**, not 10, on every release. | Testing gaps |
| Bring in **someone independent to try to break the safety rules**. | Testing gaps |
| **Grade with a different AI model** than the one being tested. | Testing gaps |
| Build a test set from **real user questions** (consented and anonymized). | Testing gaps |
| Make the **rate limit responsive to need** — more room for users in an active crisis. | Rate limit equity |
| **Tell users what's missing** from community data, not just that it's informal. | Community data bias |
| Reduce response time — currently ~26 seconds at the slow end, against a 15-second goal. | Speed |

### Before charging money

**Have an immigration attorney review our disclaimer and refusal architecture.** Being free supports an "informational tool" posture. Charging changes the risk profile, and that review should happen before the first dollar, not after.

### Lines we will not cross

- No releasing a new AI version on a single test run.
- No weakening a safety guardrail to make the product faster or cheaper.
- No feature that lets the AI generate a statistic on its own.

---

## 4. What We Are Asking For

**The audit verdict is: keep operating, with four conditions.**

1. **Hold traffic growth** until the fairness measurement and live-data work are underway.
2. **No paid tier** until an attorney has reviewed the architecture.
3. **No guardrail loosened** for speed or cost, including under commercial pressure.
4. **Every release reviewed** for whether the AI's safety compliance got better or worse.

Two of these issues get materially worse with scale rather than staying flat. An unmeasurable fairness gap becomes a real harm once many more people rely on the system, and the chance that a rule changes inside our 45-day blind spot approaches certainty the longer we operate. **That is why the sequencing matters: measurement and live data before growth, not alongside it.**

---

*Haven provides information, not legal advice. This summary reflects an internal engineering and ethics review; it is not a legal opinion.*

# Run-book — Advisor Prompt & Model Deployment

| | |
|---|---|
| **Applies to** | Haven Advisor system prompt and chat model |
| **Related** | [PRD](../advisor-chatbot/advisor-chatbot-prd.md) · [UAT Plan](../advisor-chatbot/advisor-uat-plan.md) · [CDR](../advisor-chatbot/conversation-design-requirements.md) |
| **Owner** | Yanyan |
| **Est. duration** | 45–60 min including evals |
| **Last updated** | 2026-08-03 |

---

## 1. Overview

**Purpose.** Safely change what the Advisor says — the Langfuse-managed system prompt, the in-code fallback prompt, or the OpenAI chat model.

**Why this needs a run-book.** This is a production deployment path that bypasses git, code review, CI, and Vercel entirely. A prompt edit in the Langfuse dashboard reaches every user within 60 seconds, with no PR, no approval, and no automatic rollback. It changes safety-critical behavior — grace-period math, "do not work without authorization" warnings, refusal boundaries — for an audience whose immigration status depends on the answer.

**Blast radius:** every user, immediately, with no staged rollout.

**The rule that shapes everything below:** rollback restores the *system*, not the *user*. Someone who read a wrong day-60 deadline and skipped a filing cannot be rolled back. Weight the pre-deploy gate far more heavily than the rollback plan.

### Key facts

| Item | Value |
|---|---|
| Langfuse prompt name | `haven-advisor-system` |
| Label production reads | `production` |
| Propagation delay | 60s (`cacheTtlSeconds: 60` in `src/lib/langfuse.ts`) |
| In-code fallback prompt | `STREAMING_SYSTEM_PROMPT` in `src/lib/advisor/service.ts` |
| Fallback behavior | **Silent** — if Langfuse errors or the prompt is missing, the code prompt is used with no alert |
| Model env var | `OPENAI_CHAT_MODEL` (Vercel; defaults to `gpt-5-mini`) |
| Langfuse project | `haven-advisor` (US region) |
| Eval baselines | `apps/haven/evals/advisor/reports/` |

### Known limitation — read before proceeding

**You cannot evaluate a prompt before promoting it.** The `--prompt-version` flag is *metadata only*: it labels the report and run ID (`langfuseProductionVersion` in `run-local.ts`). The harness exercises the live advisor path, which always reads whatever carries the `production` label.

Consequence: the procedure below promotes first and validates immediately, accepting a short exposure window. Two mitigations are mandatory — deploy in a low-traffic window, and keep the rollback command ready before you promote.

*Recommended fix (not yet built):* a second Langfuse project used as staging, with `LANGFUSE_*` env vars pointed at it during eval runs, so a candidate prompt can be labeled `production` in staging and evaluated with zero user exposure.

---

## 2. Step-by-step procedures

### 2.1 Prepare

1. **Record current state** in the change log (§7): current production prompt version number, current `OPENAI_CHAT_MODEL` value, today's date.

2. **Capture a baseline on the current prompt, before changing anything.** Without it you cannot distinguish a new regression from a pre-existing failure.

```bash
npm run eval:advisor -- --preset recommended10 --judge --report --history --prompt-version <current>
```

Note the report path under `evals/advisor/reports/`.

3. **Check for prompt drift.** Compare the Langfuse `production` prompt text against `STREAMING_SYSTEM_PROMPT` in `src/lib/advisor/service.ts`. If they differ, record the difference — a Langfuse outage silently serves the code version, so drift means an outage changes Advisor behavior with no signal.

4. **Pick the window.** Low traffic, and a time you can watch for the next hour. Never at end of day or before time away — the failure mode is a user acting on bad guidance before anyone notices.

5. **Have the rollback target written down** (the current version number from step 1). Do not proceed without it.

### 2.2 Execute

1. **In Langfuse, create a NEW version** of `haven-advisor-system`. Never edit a version in place — in-place edits destroy the rollback target.

2. **Promote:** move the `production` label to the new version.

3. **Start the clock.** Changes reach users within 60 seconds. Validation (§3) begins now, not later.

4. **For model changes instead:** update `OPENAI_CHAT_MODEL` in Vercel and redeploy. Test in a preview deployment first — unlike prompts, this one *can* be staged.

---

## 3. Validation checks

Nothing is considered deployed until every check below passes. If any fails, go to §5 (rollback) first and diagnose afterward.

**3.1 Automated evals**

```bash
npm run eval:advisor -- --preset recommended10 --judge --report --history --prompt-version <new>
```

**3.2 Pass criteria**

- All deterministic checks PASS: `answer-present`, `disclaimer-present`, `high-risk-review`, `helpful-citation`, `safety-refusal`.
- **No check that passed on the baseline now fails.** A regression is a blocker even if the overall pass rate looks acceptable.
- Judge scores not materially below baseline.

**3.3 Human UAT — Groups S and X**

Run the Safety and Scope/Adversarial groups from the [UAT plan](../advisor-chatbot/advisor-uat-plan.md). 100% pass required. These cover what automated checks cannot: whether the answer is actually useful and safe to a person in crisis.

**3.4 Dialect spot-check (CD-4.5)**

Run at least one high-risk case using non-idiomatic phrasing — "my company terminated me last Friday" rather than "I was laid off" — and confirm the safety guardrails still fire. The eval fixtures encode one way of saying each thing; this is the check that catches overfit.

**3.5 Typecheck** (only if code changed)

```bash
npm run typecheck
```

**3.6 Production smoke test**

Ask one real question at haven-h1b.com/advisor. Confirm the answer renders with disclaimer and citation, and that the trace appears in the Langfuse `haven-advisor` project with the expected prompt version attached.

---

## 4. Escalation paths

Haven is a single-operator project, so escalation means **stop**, not "page the on-call."

| Situation | Action |
|---|---|
| Evals fail or regress | Do not keep the change. Roll back (§5), then fix or abandon. |
| Unsure whether new wording is legally safe | **Roll back and get immigration-attorney review.** This is the one escalation that goes outside the system — do not resolve it by judgment call. |
| Production misbehaving after promote | Roll back **first**, diagnose second. |
| Langfuse unreachable | Production is silently running the in-code fallback. Treat as an incident: verify `STREAMING_SYSTEM_PROMPT` is current, and do not deploy prompt changes until Langfuse recovers. |
| Users may have acted on bad guidance | See §5.3 — this is the only genuinely unrecoverable failure. |

---

## 5. Rollback plan

**5.1 Prompt rollback (~60 seconds)**

1. In Langfuse, move the `production` label back to the previous version number recorded in §2.1 step 1.
2. Wait 60 seconds for the prompt cache TTL to expire. The cache is per-process, so consider redeploying to clear warm serverless instances.
3. Verify: ask a live question and confirm the trace shows the reverted version.

**5.2 Model rollback**

Restore the previous `OPENAI_CHAT_MODEL` value in Vercel and redeploy.

**5.3 What rollback cannot undo**

Answers already delivered. If a bad prompt was live and any user received high-risk guidance during the window:

1. In Langfuse, filter traces by the deployment time window and high-risk topics (layoffs, travel, work authorization).
2. Review those answers for incorrect deadlines, missing safety warnings, or wrong conclusions.
3. Decide on user outreach. A wrong grace-period date is worth a direct correction email.

This section is the reason §3 is strict.

---

## 6. Post-deploy review

- Record the outcome in the change log (§7).
- Watch the Langfuse thumbs-down rate and Sentry for 24 hours.
- Turn every real-world miss into a permanent eval fixture (CD-6.2) so the same phrasing cannot regress.
- If the deployment surfaced a gap in this run-book, update this file before closing out.

---

## 7. Change log

| Date | Prompt version (from → to) | Model | Baseline report | Outcome |
|---|---|---|---|---|
| _(example)_ 2026-08-05 | v8 → v9 | gpt-5-mini | `recommended-10-v8-baseline.md` | Promoted; all checks passed |

---

## 8. Common failure modes

| Failure | Cause | Prevention |
|---|---|---|
| No rollback target | Prompt edited in place | Always create a new version (§2.2 step 1) |
| Regression reaches users | Promoted without a baseline to compare against | §2.1 step 2 |
| Behavior changes with no deploy | Langfuse outage silently serves the in-code fallback, which has drifted | §2.1 step 3 |
| Evals green, real users harmed | Fixtures encode one phrasing and some guardrails are fixture-specific | §3.4 dialect spot-check + §3.3 UAT |
| Long exposure window | Validation started late, or run when nobody was watching | §2.1 step 4, §2.2 step 3 |

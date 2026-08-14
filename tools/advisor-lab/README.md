# Advisor lab

A terminal chat for testing Advisor prompts, outside the Haven product.

```bash
npm run advisor:lab
```

## What it is

The real Advisor pipeline, driven from a terminal, with the system prompt in a file you can edit and every routing decision printed next to the answer.

It **imports** `streamAdvisorResponse` rather than reimplementing it, so what you test here is what production runs — same classifier, same guardrail selection, same retrieval, same post-generation safety addendum. A lab that reimplemented the pipeline would agree with production on the day it was written and drift silently afterwards, and a prompt validated against a drifted copy is worse than one nobody tested.

## What it does not touch

Supabase credentials are cleared before the service loads, which puts the pipeline in its existing mock-identity path:

- **No database writes.** No `advisor_threads` row per question, so prompt testing never appears in product usage data.
- **No rate limit.** The five-conversations-per-24h allowance does not apply. Ask two hundred questions in an afternoon.
- **No reach into other users' data.**
- **Langfuse off** unless you pass `--trace`. A hundred experiments would otherwise bury real production traces.

## Editing the prompt

First run seeds `prompt.local.md` from the in-code prompt. Edit it, ask the next question, and the change is live — the file is re-read per question.

`/prompt` prints what is currently in effect.

This is deliberately *not* the deploy path. Per [the run-book](../../docs/runbooks/advisor-prompt-deploy.md), editing the Langfuse production prompt reaches every user within sixty seconds with no staged rollout. The lab exists so a prompt can be felt out before it goes anywhere near that.

## Using your real profile

Most of what makes an answer right or wrong is the profile it was built from, and the default is a synthetic persona.

```bash
npm run advisor:lab:pull -- lshangyanyan@gmail.com
```

That writes `profile.local.json` once. The lab picks it up automatically on the next run.

**A copy, not a live connection** — on purpose. A live connection would write a thread row per question, die after five prompts, and let the profile move under the experiment so two prompts compared an hour apart would not be compared against the same facts.

`profile.local.json` holds one real person's immigration profile in plain text. It is gitignored. Delete it when you are done.

## Reading the output

```
you  What happens to my H-1B if my position was affected in the restructuring?
         → matched · topics h1b, layoffs · guardrails GR_LAYOFF_SAFETY_RULES, GR_LAYOFF_OPTION_MENU

advisor  Direct answer: ...

26.9s · confidence high · 3 citation(s) · SAFETY ADDENDUM FIRED
         ^ the prompt did not produce required safety language on its own
```

Two lines matter more than the answer text.

**The routing line, before the answer.** Most prompt bugs are routing bugs. `resolution=unmatched` or the wrong topics means the answer was built from the wrong sources — and you cannot see that by reading the prose, because the answer still sounds fine.

**`SAFETY ADDENDUM FIRED`.** The pipeline staples required safety language onto answers that omitted it. Every fire is the prompt having failed to produce that language on its own. Watching this flag go from firing to silent is the clearest read on whether a prompt edit actually worked, and it is invisible in the answer.

## Commands

| | |
|---|---|
| `/prompt` | show the prompt in effect |
| `/new` | fresh thread, clears history |
| `/profile` | show the profile answers are built from |
| `/quit` | exit |

## What this cannot tell you

The lab runs the pipeline; it does not judge the output. For that, the eval suite is still the instrument:

```bash
npm run eval:advisor -- --preset recommended10 --runs 5
```

There is no `temperature` or `seed`, so a single lab answer cannot distinguish a real improvement from sampling noise. Use the lab to develop a prompt and the eval suite to decide whether it is better.

# Haven Advisor eval fixtures

This directory contains the Stage 2 regression dataset for Haven Advisor.

The fixtures are synthetic user scenarios. They are not production user data and should not be treated as legal guidance. Stage 3 can use these files to run the same Advisor questions repeatedly and compare prompt/model changes.

## Fixture shape

Each case includes:

- `id`: stable case identifier.
- `category`: broad product/legal area.
- `riskLevel`: `standard`, `high`, or `critical`.
- `topicTags`: expected trace/eval tags.
- `question`: the user-facing prompt to send to Advisor.
- `history`: optional prior conversation turns.
- `profileSnapshot`: synthetic Haven profile facts available to the case.
- `expected`: behavioral checks for deterministic and judge-based evals.

## Local runs

Run the deterministic 10-case smoke set:

```bash
npm run eval:advisor:smoke
```

Run the same 10 cases with the semantic judge:

```bash
npm run eval:advisor:judge
```

Save JSON and Markdown reports for review:

```bash
npm run eval:advisor -- --preset recommended10 --judge --report --prompt-version 4
```

Record the run in the persistent local history index:

```bash
npm run eval:advisor -- --preset recommended10 --judge --report --history --prompt-version 4
```

## Consistency runs

The advisor sets no `temperature` or `seed`, so output is stochastic and a single
run cannot tell a real regression from sampling noise. Use `--runs N` to repeat
each case:

```bash
npm run eval:advisor -- --preset recommended10 --runs 5
```

- Case status is the **worst** run: a safety check that fires only sometimes is a
  failure, not a coin flip.
- Any check that passes on some runs and fails on others is reported as **flaky**,
  per case and in the run summary.
- Judging every repeat multiplies cost, so `--judge` scores only the first run.
  Add `--judge-all-runs` to judge all of them.

Before promoting a prompt version, safety checks should be at a 100% pass rate
across runs — not merely passing once.

## Token/cost reporting

Every run reports estimated tokens (`chars/4`) for the system prompt, question,
history, and answer, plus a mean per answer and a run total. Reports and the
history index carry the same figures, and `--history` prints a mean-tokens delta
against the previous comparable run, so a prompt change that costs more shows up
immediately.

The estimate deliberately **excludes retrieved chunks and profile context**: those
are roughly constant across prompt versions, so leaving them out keeps the
version-to-version delta clean. Treat the numbers as comparable, not as billing
truth — the advisor stream does not surface real API usage today.

## Prompt compliance (safety-addendum fire rate)

This is the scorecard for the system prompt itself.

The advisor patches answers after generation: `buildMandatorySafetyAddendum`
staples on required safety language when the model omitted it. **Every fire means
the system prompt failed to produce that language on its own.** The run reports
what share of answers needed patching, broken down by note
(`h1b-layoff`, `cpt`, `i485-travel`, `niw`, `cspa`).

Detection reads the note markers in the answer text, so it needs no change to the
advisor service.

- **Lower is better.** A rising fire rate after a prompt edit means the new prompt
  is less compliant, even if every pass/fail check still passes.
- The per-case `safety-addendum` line is **informational** and never changes a
  case's pass/fail status — a patched answer is still a safe answer. The point is
  to see how much work the patch layer is doing.
- When a note holds at 0% across a decent sample, its patch becomes a candidate
  for deletion — that is how the post-hoc regex layer shrinks over time.
- With `--history`, runs print the fire-rate delta against the previous
  comparable run.

Use it to compare prompt versions:

```bash
npm run eval:advisor -- --preset recommended10 --runs 5 --report --history --prompt-version 9
```

Reports are written to `evals/advisor/reports/` and include:

- run metadata, dataset version, model, prompt name, and prompt version;
- raw Advisor answers;
- trace IDs;
- deterministic checks;
- judge scores and feedback;
- citations returned with each answer.

History entries are appended to `evals/advisor/history/runs.jsonl`. Each line is one compact run record with:

- dataset name and version;
- selected case set;
- Advisor prompt name and Langfuse production version;
- Advisor model and judge model;
- pass/warn/fail totals;
- report file paths;
- per-case status, trace ID, elapsed time, and judge scores.

When `--history` is used, the runner compares the current run with the previous comparable run and prints score/status deltas.

## Current scope

The local runner is the current Stage 3/early Stage 4 baseline. It runs repeatable regression cases and optional LLM-as-judge scoring locally. It does not yet upload results to Langfuse experiments, add admin review, or persist eval runs in Supabase.

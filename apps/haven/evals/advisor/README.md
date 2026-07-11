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

---
title: Clientory CI/CD Pipelines
created: 2026-06-23
updated: 2026-06-23
tags:
  - clientory
  - cicd
  - github-actions
  - deployment
---

# Clientory CI/CD Pipelines

This note documents the current CI/CD setup for the `lishangyanyan1992/clientory` repo as inspected locally at:

`/Users/shangyanyanli/Desktop/Clientory`

Maintenance rule:

Update this note whenever the Clientory CI/CD pipeline is changed.

## Summary

Clientory currently has three GitHub Actions workflows and two deployment configurations:

- GitHub Actions: CI, CodeQL, Prompt Evals
- Deployments: Vercel frontend, Railway API backend

## GitHub Actions

### CI

File:

`/Users/shangyanyanli/Desktop/Clientory/.github/workflows/ci.yml`

Triggers:

- Push to `main`
- Pull request targeting `main`

Jobs:

- `Secret Scan (gitleaks)`
  - Checks repository history/diff for leaked secrets.
  - Uses `.gitleaks.toml`.
- `Type Check`
  - Installs dependencies with `pnpm`.
  - Runs TypeScript type checks.
  - Runs API server tests.
  - Runs `pnpm audit --audit-level=critical`.

Purpose:

This is the main quality gate for normal code changes.

### CodeQL

File:

`/Users/shangyanyanli/Desktop/Clientory/.github/workflows/codeql.yml`

Triggers:

- Push to `main`
- Pull request targeting `main`
- Weekly schedule: Monday at `03:00 UTC`

Job:

- `Analyze (javascript-typescript)`
  - Runs GitHub CodeQL with `security-and-quality` queries.

Purpose:

This is the static security and code quality analysis pipeline.

### Prompt Evals

File:

`/Users/shangyanyanli/Desktop/Clientory/.github/workflows/evals.yml`

Purpose:

Runs PromptFoo tests for the symptom-query prompt used by Clientory's scan/prompt generation flow.

The eval config lives at:

`/Users/shangyanyanli/Desktop/Clientory/Clientory App/evals/promptfooconfig.yaml`

The prompt being tested lives at:

`/Users/shangyanyanli/Desktop/Clientory/Clientory App/evals/prompts/symptom-query.txt`

The eval suite checks that generated prospect queries are:

- 8-20 words
- first person
- free of meta-commentary
- realistic as business decision-maker problem statements

Current local trigger design:

- Pull requests that touch prompt/eval-related files
- Pushes to `main` that touch prompt/eval-related files
- Manual `workflow_dispatch`

Published status:

The Prompt Evals trigger and hardening changes were published to `main` in commit `d6e5799` (`Tighten prompt eval workflow`) on 2026-06-23.

Secrets required:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Security note:

Keys pasted into chat should be treated as exposed. Revoke them, create fresh keys, and add the fresh values directly to GitHub Actions secrets.

## Deployment Pipelines

### Vercel Frontend

Config:

`/Users/shangyanyanli/Desktop/Clientory/vercel.json`

Build target:

`Clientory App/artifacts/clientory`

Install script:

`/Users/shangyanyanli/Desktop/Clientory/install-vercel.sh`

Build script:

`/Users/shangyanyanli/Desktop/Clientory/build-vercel.sh`

Output directory:

`Clientory App/artifacts/clientory/dist/public`

API routing:

`/api/*` is rewritten to:

`https://clientory-production.up.railway.app/api/*`

Purpose:

Vercel serves the frontend and proxies API requests to the Railway backend.

### Railway API Backend

Config:

`/Users/shangyanyanli/Desktop/Clientory/railway.json`

Build system:

Nixpacks, configured by:

`/Users/shangyanyanli/Desktop/Clientory/nixpacks.toml`

Build script:

`/Users/shangyanyanli/Desktop/Clientory/build-railway.sh`

Start script:

`/Users/shangyanyanli/Desktop/Clientory/start-railway.sh`

Healthcheck:

`/api/healthz`

Purpose:

Railway deploys and runs the backend API server.

## Recommended Model

Use each pipeline for a distinct purpose:

- CI: catch normal code/test/type/security issues before merge.
- CodeQL: catch deeper static security and quality issues.
- Prompt Evals: catch prompt behavior regressions only when prompt-related code changes.
- Langfuse: monitor real production AI behavior from user sessions.
- Vercel: deploy frontend.
- Railway: deploy backend API.

## Open Follow-Ups

- Rotate the exposed OpenAI and Anthropic keys.
- Add fresh provider keys to GitHub Actions secrets.
- Rerun Prompt Evals manually after secrets are replaced.

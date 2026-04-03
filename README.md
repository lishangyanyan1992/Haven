# Haven

Greenfield `Next.js` + `Supabase` implementation of the Haven PRD.

## Status

This repository currently contains:

- project scaffold
- PRD-aligned source spec
- Supabase schema scaffold for immigration profiles, timelines, community, and email ingest
- advisor chat route, API surface, trusted-source corpus scaffolding, and conversation persistence schema
- typed Haven domain model and validation schemas
- app shell for onboarding, dashboard, timeline, layoff planner, community, inbox, and settings
- mock repository layer that can be replaced with live Supabase queries

## Local setup

1. Install a Node.js toolchain.
2. Copy `.env.example` to `.env.local`.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.
5. Verify the app with `npm run typecheck` and `npm run build:webpack`.

If `node` and `npm` are not on your shell `PATH` but the shared local fallback runtime exists at `/tmp/node-v22.14.0-darwin-arm64/bin/node`, you can start the app with `./dev.sh`.

## Supabase setup

1. Create or link a Supabase project.
2. Apply migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_advisor.sql`
   - `supabase/migrations/0003_crisis_mode.sql`
3. Seed optional starter data from `supabase/seed.sql`.
4. Configure Auth redirects for `http://localhost:3000`.
5. Regenerate `src/types/database.ts` whenever the schema changes.

## Supabase CLI workflow

The project now includes a local Supabase CLI dependency plus repo-local wrappers:

- `npm run supabase -- --version`
- `npm run supabase:push`
- `npm run supabase:types`
- `npm run supabase:migrations`

The wrappers support two non-interactive setups:

1. `SUPABASE_DB_URL`
   Use this when you want `db push`, `migration list`, and type generation to talk directly to Postgres.
2. `SUPABASE_ACCESS_TOKEN` plus `SUPABASE_DB_PASSWORD`
   The wrappers derive `SUPABASE_PROJECT_REF` from `NEXT_PUBLIC_SUPABASE_URL` if you do not set it explicitly.

Recommended:

- Use `npm run supabase:push` after adding a new file under `supabase/migrations/`.
- Use `npm run supabase:types` after every schema change so `src/types/database.ts` stays in sync.

## Advisor setup

- The current advisor is session-only: it does not save conversations server-side.
- Set `OPENAI_API_KEY` to enable moderation and model-generated answers. Without it, the advisor falls back to deterministic source-grounded responses from the bundled trusted corpus.
- You do not need `supabase/migrations/0002_advisor.sql` to use the current advisor UI. That migration is for future persisted history, citations, and optional stored source retrieval.
- `POST /api/internal/source-sync` is optional and only needed if you want to seed the Supabase-backed trusted corpus for future storage/retrieval flows.

## Implementation notes

- The current implementation follows the PRD document directly rather than the earlier placeholder case-management model.
- The repo defaults to server-component-first patterns with room for server actions and Supabase-backed repositories.
- `src/lib/repositories/supabase-case-compass.ts` is the live-data handoff point.
- `src/lib/advisor/service.ts` owns advisor retrieval and answer generation.

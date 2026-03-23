# Haven

Greenfield `Next.js` + `Supabase` implementation of the Haven PRD.

## Status

This repository currently contains:

- project scaffold
- PRD-aligned source spec
- Supabase schema scaffold for immigration profiles, timelines, community, and email ingest
- typed Haven domain model and validation schemas
- app shell for onboarding, dashboard, timeline, layoff planner, community, inbox, and settings
- mock repository layer that can be replaced with live Supabase queries

## Local setup

1. Install a Node.js toolchain.
2. Copy `.env.example` to `.env.local`.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## Implementation notes

- The current implementation follows the PRD document directly rather than the earlier placeholder case-management model.
- The repo defaults to server-component-first patterns with room for server actions and Supabase-backed repositories.
- `src/lib/repositories/supabase-case-compass.ts` is the live-data handoff point.

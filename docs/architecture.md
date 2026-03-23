# Architecture

## Stack

- `Next.js` App Router
- `TypeScript`
- `Tailwind CSS`
- `Supabase Auth`
- `Supabase Postgres`
- `Supabase Storage`
- `Zod`
- `React Hook Form`

## Structure

- `src/app`: route groups and pages
- `src/components`: UI and domain components
- `src/lib`: helpers, repositories, env, Supabase clients
- `src/server`: server-only services and actions
- `src/types`: shared domain interfaces
- `supabase/migrations`: SQL schema and RLS

## Runtime model

- Server components fetch user-scoped immigration data.
- Server actions handle onboarding progress and email-ingest confirmation.
- Repositories isolate query logic from route handlers and UI.
- Mock repositories provide immediate development surfaces before live data is wired.

## Security model

- Profile data is private and user-scoped by default.
- Community spaces expose anonymized summaries, not raw identifying immigration data.
- Email forwarding is manual and explicit; Haven never reads inboxes directly.
- Recommendation surfaces must include inline legal disclaimers.

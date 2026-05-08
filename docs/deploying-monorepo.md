# Deploying The Monorepo

This repo now contains two deployable Next.js apps:

- `apps/haven`
- `apps/immig-wizard`

Recommended production domains:

- `app.haven.com`
- `wizard.haven.com`

For each Vercel project:

1. Connect the same Git repo.
2. Set the Root Directory to the app directory.
3. Keep the framework as Next.js.
4. Set the shared auth env vars in both projects:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_COOKIE_DOMAIN=haven.com`

App-specific notes:

- Haven uses [`apps/haven/vercel.json`](/Users/shangyanyanli/Desktop/Haven/apps/haven/vercel.json) for its cron job.
- ImmigWizard uses [`apps/immig-wizard/vercel.json`](/Users/shangyanyanli/Desktop/Haven/apps/immig-wizard/vercel.json).

Suggested Vercel project mapping:

- Project `haven-app` -> Root Directory `apps/haven`
- Project `haven-wizard` -> Root Directory `apps/immig-wizard`

## Local env handling

Production uses Vercel project environment variables already.

For local development, prefer Vercel-managed envs over hand-maintained `.env.local` files:

- `npm run env:pull:haven`
- `npm run env:pull:wizard`
- `npm run env:run:dev:haven`
- `npm run env:run:dev:wizard`
- `npm run env:run:build:haven`
- `npm run env:run:build:wizard`

Notes:

- `env:pull:*` writes the current Vercel project env into `.env.vercel.local` for inspection only.
- `env:run:*` runs commands directly with Vercel-provided envs and is the preferred local workflow.
- The app directories should not keep hand-maintained `.env.local` files when using this setup.
- If Vercel build logs still mention a detected `.env` file during remote builds, that is not evidence that production is reading your machine's local `.env.local`; production env values are still coming from the Vercel project settings.

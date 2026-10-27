# Design: Haven Admin Operations Dashboard

## Context

Haven features automated background pipelines (e.g., weekly Visa Bulletin syncing, community story import staging, document ingestion) but currently has no top-level admin landing page. Navigating to `/admin` results in a 404, while `/admin/community-imports` exists as a standalone sub-route using an isolated email check against `COMMUNITY_IMPORT_REVIEWER_EMAILS`. 

The Visa Bulletin sync logic is currently embedded in the `/api/internal/sync-bulletin` Route Handler. When the State Department feed fails or upstream markup changes, the failure is logged to Sentry or fails silently until someone notices stale caveats appearing in Advisor conversations.

## Goals / Non-Goals

**Goals:**
- Provide a unified admin layout (`/admin/layout.tsx`) with shared authentication and navigation between Overview and Community Imports.
- Implement a reusable authentication helper (`requireAdminUser()`) supporting `ADMIN_EMAILS` only (the earlier fallback to `COMMUNITY_IMPORT_REVIEWER_EMAILS` was removed on 2026-10-26 for security).
- Extract bulletin synchronization into a shared library module (`executeVisaBulletinSync`) callable by both the cron endpoint and the admin server action.
- Build a server-rendered dashboard at `/admin/page.tsx` displaying:
  - Triage / Action Required banner for stale feeds and pending items.
  - Visa Bulletin status, staleness indicator, and one-click manual sync action.
  - Community Story review backlog metrics.
  - Recent inbound lawyer pilot inquiries (`firm_pilot_requests`).
  - Recent advisor downvotes and user complaints (`advisor_feedback`).

**Non-Goals:**
- Comprehensive CRM features for editing or approving law firm pilot inquiries.
- Replacing Langfuse for deep trace inspection.
- Altering the database schema of `visa_bulletin_entries` or `firm_pilot_requests`.

## Decisions

### 1. Centralized Admin Authentication Helper
- **Decision**: Create `apps/haven/src/lib/admin-auth.ts` defining `getAdminUser()` and `requireAdminUser()`. It parses comma-delimited emails from `ADMIN_EMAILS`. There is no fallback to `COMMUNITY_IMPORT_REVIEWER_EMAILS` (removed 2026-10-26).
- **Alternatives Considered**:
  - *Keep separate checks in each page*: Leads to configuration drift and inconsistent redirects.
  - *Database-backed roles in user_profiles*: Requires schema migrations and user administration UI, which is overly complex for the current team size.

### 2. Extracted Sync Execution Module
- **Decision**: Refactor bulletin synchronization logic out of `apps/haven/src/app/api/internal/sync-bulletin/route.ts` into a shared function `executeVisaBulletinSync()` in `apps/haven/src/lib/visa-bulletin-sync.ts`.
- **Alternatives Considered**:
  - *Having the dashboard make an HTTP fetch to `/api/internal/sync-bulletin`*: Requires passing CRON_SECRET or service bearer tokens over localhost HTTP, creating fragile network loops in serverless environments.
  - *Duplicating sync logic in a Server Action*: Risks divergence in quality checks and upsert handling.

### 3. Server Component Architecture with Client Action Trigger
- **Decision**: Implement `/admin/page.tsx` as a React Server Component that fetches operational data in parallel using `createSupabaseAdminClient()`. The "Run Manual Sync" button is a client component (`ManualSyncButton.tsx`) invoking a Server Action with `useTransition` to display inline loading and status messages.
- **Alternatives Considered**:
  - *Client-side fetching via React Query / SWR*: Adds extra client-side state and waterfall requests for data that can be efficiently resolved on the server in a single pass.

### 4. Bulletin Staleness Calculation
- **Decision**: Evaluate bulletin status dynamically using the newest entry in `visa_bulletin_entries`:
  - `STALE` if held month is older than the current calendar month, OR
  - `STALE` if held month is the current month and today is on or after the 15th (when next month's bulletin is released), OR
  - `STALE` if the age from bulletin effective date exceeds 35 days.
  - `CURRENT` otherwise.
- **Alternatives Considered**:
  - *Fixed 30-day cutoff*: Causes false staleness warnings early in the month before the State Department publishes the new edition.

## Technical Structure

```
apps/haven/src/
  ├── app/
  │   └── admin/
  │       ├── layout.tsx             # Shared admin shell & sub-navigation
  │       ├── page.tsx               # Admin overview RSC & metrics
  │       ├── ManualSyncButton.tsx   # Interactive sync trigger with status feedback
  │       └── community-imports/     # Existing review queue (updated auth check)
  ├── lib/
  │   ├── admin-auth.ts              # Unified admin verification
  │   └── visa-bulletin-sync.ts      # Shared execution & quality validation
  └── server/
      └── admin-actions.ts           # Server action for on-demand bulletin sync
```

## Risks / Trade-offs

- **[Upstream Scraper Failure]** → The State Department occasionally changes markup or blocks requests behind Cloudflare.  
  *Mitigation*: The validation check rejects malformed/incomplete data before database upsert, leaving existing bulletin data intact, and bubbles the exact error back to the admin dashboard.
- **[Long-Running Sync Request]** → HTML parsing and State Department fetch may take 2-4 seconds.  
  *Mitigation*: The client button uses React `useTransition` with visual pending states and disabled interaction to prevent duplicate submissions.

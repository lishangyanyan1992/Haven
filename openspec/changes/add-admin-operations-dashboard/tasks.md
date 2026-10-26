# Tasks

## 1. Admin Authentication & Configuration

- [x] 1.1 Add `ADMIN_EMAILS` to `apps/haven/src/lib/env.ts` and update `apps/haven/.env.example`, verifying schema validation with `npm run typecheck --workspace @haven/app`.
- [x] 1.2 Implement `apps/haven/src/lib/admin-auth.ts` with `getAdminUser()` and `requireAdminUser()` supporting `ADMIN_EMAILS` with fallback to `COMMUNITY_IMPORT_REVIEWER_EMAILS`, verifying access control with unit/integration tests.
- [x] 1.3 Refactor `apps/haven/src/app/admin/community-imports/page.tsx` and `[id]/page.tsx` to use the shared admin auth helper, verifying existing community import review access functions consistently.

## 2. Visa Bulletin Sync Refactoring & Server Action

- [x] 2.1 Extract bulletin parsing, validation, and database upsert logic into `apps/haven/src/lib/visa-bulletin-sync.ts`, updating `apps/haven/src/app/api/internal/sync-bulletin/route.ts` to call the shared module and verifying with `npm test`.
- [x] 2.2 Implement `syncVisaBulletinAction()` in `apps/haven/src/server/admin-actions.ts` with admin auth verification and revalidation of `/admin`, `/dashboard`, and `/timeline`, verifying proper return values for success and error conditions.

## 3. Admin Dashboard & Operations UI

- [x] 3.1 Create `apps/haven/src/app/admin/layout.tsx` providing a cohesive navigation header with links between Overview (`/admin`) and Community Imports (`/admin/community-imports`).
- [x] 3.2 Create `apps/haven/src/app/admin/ManualSyncButton.tsx` client component providing pending state transitions, disabled button handling, and inline status feedback.
- [x] 3.3 Build `apps/haven/src/app/admin/page.tsx` server component querying Supabase for bulletin age, pending community drafts, recent `firm_pilot_requests`, and recent `advisor_feedback` complaints.
- [x] 3.4 Implement the "Action Required" triage banner at the top of `/admin` that dynamically flags when the Visa Bulletin is stale (>35 days or lagging month) or community stories await review.
- [x] 3.5 Run end-to-end verification of `/admin` page rendering, authentication redirection, and manual sync execution using `npm run build --workspace @haven/app` or local browser tests.

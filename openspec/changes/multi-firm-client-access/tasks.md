# Tasks

## 1. Database Schema for Multi-Firm Client Membership

- [x] 1.1 Create `supabase/migrations/0048_multi_firm_clients.sql` to drop `firm_clients_normalized_email_key` and `firm_clients_user_id_key`, add `unique (firm_id, normalized_email)` (`firm_clients_firm_email_key`), and add partial unique index `firm_clients_firm_user_uidx` on `(firm_id, user_id) where user_id is not null`; verify the migration file syntax and constraints match the schema design.

## 2. Multi-Firm Intake, Direct Access Grant, and Shared Data Sync

- [x] 2.1 Update `decideIntake`, `requestFirmIntake`, and `claimFirmInvite` in `apps/haven/src/lib/firms/intake.ts` to scope existing-client lookups to `(firm_id, normalized_email)`, match claim tokens across multiple `firm_clients` rows for an email, support existing Haven users joining a new firm, and backfill `shared_answers` from the client's existing profile when joining; verify with unit tests in `apps/haven/src/lib/firms/__tests__/intake.test.ts`.
- [x] 2.2 Add `grantFirmAccessForUser` in `apps/haven/src/lib/firms/intake.ts` and a direct access grant UI + server action on `apps/haven/src/app/i/[token]/page.tsx` and `FirmIntakeForm.tsx` so an authenticated client opening a new firm's intake link can grant access in one click (or see an already-connected state); verify with unit tests covering signed-in grant and idempotent re-grants.
- [x] 2.3 Update `recordFirmSharedAnswers` in `apps/haven/src/lib/firms/answers.ts` to fan out `shared_answers` and `completed_at` updates to all joined `firm_clients` rows for `userId` while preserving per-firm `customAnswers`; verify with unit tests in `apps/haven/src/lib/firms/__tests__/answers.test.ts`.
- [x] 2.4 Update multi-firm queries in `apps/haven/src/lib/firms/intake.ts` (`getClientFirmEngagementRecords`, `getClientFirms`, `isJoinedFirmClientEmail`), `apps/haven/src/lib/firms/advisor-link.ts`, and `apps/haven/src/lib/advisor/firm-contact.ts` so no `.maybeSingle()` call fails when a client belongs to multiple firms; verify with unit tests.

## 3. Multiple Lawyer Engagement Timelines & Sharing UI

- [x] 3.1 Update `apps/haven/src/app/dashboard/page.tsx` and `apps/haven/src/components/app/firm-engagement-dashboard.tsx` to accept and render multiple connected law firm engagement timelines (with per-firm milestone tracking, lawyer notes, consultation booking action, and firm-specific required document progress); verify with component/unit tests in `apps/haven/src/lib/firms/__tests__/engagement.test.ts`.
- [x] 3.2 Update `apps/haven/src/components/app/firm-sharing-note.tsx`, `apps/haven/src/app/documents/page.tsx`, `apps/haven/src/app/onboarding/page.tsx`, and `apps/haven/src/app/onboarding/deadlines/page.tsx` to display all connected firm names in `FirmSharingNote` and union `requiredDocuments` and `intakeQuestions` across all connected firms; verify with `pnpm --filter @haven/web typecheck` and `pnpm --filter @haven/web test`.

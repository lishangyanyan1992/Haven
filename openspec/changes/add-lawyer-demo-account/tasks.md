# Tasks

## 1. Database

- [x] 1.1 Add migration `supabase/migrations/0037_demo_firm.sql` adding `is_demo boolean not null default false` to `public.firms`. Update `haven_firm_id()` or firm policies if needed. Verify by running `db push --dry-run` or reviewing migration syntax.
- [x] 1.2 Update TypeScript definitions in `src/types/database.ts` and `src/lib/firms/types.ts` to include `is_demo` on `FirmRow` and `FirmMembership`. Verify `npm run typecheck` passes.

## 2. Client Names

- [x] 2.1 Add `fullName` to `SHARED_ANSWER_KEYS` in `src/lib/firms/answers.ts`. Ensure `sharedAnswersFromProfile` extracts `p.full_name`. Verify with unit test or verification script.
- [x] 2.2 Update `listFirmClients` in `src/lib/firms/clients.ts` so `displayName` uses `answers.fullName` if present, falling back to `row.normalized_email`. Update `FirmClientPage` in `src/app/firm/clients/[id]/page.tsx` to display full name in the heading. Verify in the browser or render tests.

## 3. Demo Dataset Generator

- [x] 3.1 Create `src/lib/firms/demo.ts` with 50 realistic client personas. Structure dates as relative offsets from a given reference date `T0`. Ensure accurate distribution: ~10 Urgent, ~15 Soon, ~12 Later, ~7 Unknown, and ~6 Email sent.
- [x] 3.2 Add `seedDemoFirm(firmId, referenceDate)` and `resetDemoFirm(firmId, referenceDate)` in `src/lib/firms/demo.ts`. Ensure all queries are scoped by `firmId` and assert `is_demo === true`. Verify that calling it populates 50 rows in `firm_clients` and `check:firm-isolation` passes.
- [x] 3.3 Add automated checks in `evals/firms/demo.check.ts` verifying that `seedDemoFirm` generates the correct tier counts, proper status distribution, and fresh countdown calculations. Add check to `package.json`.

## 4. Showcase Documents

- [x] 4.1 Create helper to provision 6-8 demo auth accounts and seed 1-3 sample PDF documents (I-797, I-94, RFE Notice, I-140) into `haven-vault` with corresponding `user_documents` records.
- [x] 4.2 Verify clicking "Open" on a showcase lead opens a valid 5-minute signed URL in a new tab.

## 5. UI Controls & Server Action

- [x] 5.1 Add `resetDemoFirmAction` in `src/server/firm-actions.ts`. Validate that `requireFirmMember()` returns `isDemo === true`, invoke `resetDemoFirm`, and call `revalidatePath("/firm")`.
- [x] 5.2 Add `ResetDemoButton` component to `src/app/firm/FirmHeader.tsx` (or toolbar), visible only when `membership.isDemo` is true. Include confirmation dialog and pending state. Verify in the browser.

## 6. CLI Tooling & Release Verification

- [x] 6.1 Add `seed-demo` command to `scripts/firm-admin.ts` (`tsx scripts/firm-admin.ts seed-demo --lawyer <email> [--name <name>]`). Verify it creates the demo firm, adds the lawyer, seeds the 50 leads, provisions documents, and logs the login URL.
- [x] 6.2 Run `npm run typecheck`, `npm run check:firm-isolation`, and `npm run check:firm-urgency`. Verify all tests pass cleanly.

## Workflow follow-up

- Seed the live demo firm with `scripts/firm-admin.ts seed-demo`.
- Test logging in as the demo lawyer and resetting data via the in-app button.
- Archive the change once tested and merged.

# Design

## Context

See [proposal.md](proposal.md) for motivation. Currently, Haven models law firm client relationships in `public.firm_clients` ([0033_firms.sql](../../../supabase/migrations/0033_firms.sql)) with single-column `UNIQUE` constraints on `normalized_email` (`firm_clients_normalized_email_key`) and `user_id` (`firm_clients_user_id_key`). Application helpers in [intake.ts](../../../apps/haven/src/lib/firms/intake.ts), [answers.ts](../../../apps/haven/src/lib/firms/answers.ts), [advisor-link.ts](../../../apps/haven/src/lib/firms/advisor-link.ts), and [firm-contact.ts](../../../apps/haven/src/lib/advisor/firm-contact.ts) assume at most one `firm_clients` row per user or email and call `.maybeSingle()` without scoping to a `firm_id`.

Meanwhile, lawyer-side data access in [clients.ts](../../../apps/haven/src/lib/firms/clients.ts) (`listFirmClients`, `getFirmClient`, `firmDocumentUrl`) already scopes every query by `.eq("firm_id", firmId)` and reads the client's `user_documents` by `user_id`, while storing firm-specific engagement state (`engagement_state`, `pipeline_status`, `reviewed_at`) directly on the `(firm_id, id)` row in `firm_clients`.

## Goals / Non-Goals

**Goals:**
- Allow a client (`user_id` / `normalized_email`) to have multiple `firm_clients` rows across distinct `firm_id`s while enforcing at most one row per `(firm_id, normalized_email)` and per `(firm_id, user_id)`.
- Support both email-claim intake and direct one-click access grant on `/i/[token]` when an existing client opens a new law firm's intake link.
- Keep `shared_answers` synchronized across all joined `firm_clients` rows for a client, and automatically backfill `shared_answers` from the client's existing profile (`profiles` + `immigration_profiles`) when they grant access to an additional firm.
- Render an engagement timeline for every connected law firm on `/dashboard` without cross-contaminating firm-specific milestones, lawyer notes, or required document lists.
- Ensure no `.maybeSingle()` query on `firm_clients` throws a PostgREST multiple-rows error when a client belongs to multiple firms.

**Non-Goals:**
- Cross-firm visibility: Law firms must never see which other law firms a client has connected with, nor see another firm's notes, milestones, or pipeline status.
- Per-firm document partitioning: Once a client grants a firm access, that firm can view the client's uploaded documents in `user_documents`. Selective per-document access control across firms is out of scope.

## Decisions

### 1. Per-Firm Composite Uniqueness on `public.firm_clients`
- **Decision:** Add migration `supabase/migrations/0048_multi_firm_clients.sql` that drops `firm_clients_normalized_email_key` and `firm_clients_user_id_key`, and replaces them with:
  - `unique (firm_id, normalized_email)` constraint (`firm_clients_firm_email_key`)
  - Partial unique index `firm_clients_firm_user_uidx` on `(firm_id, user_id) where user_id is not null`
- **Rationale:** Preserves strict 1:1 client membership within a single firm while allowing $1:N$ relationships across distinct firms. Keeping `firm_clients` as the join/engagement table avoids introducing a second junction table because `shared_answers`, `engagement_state`, `pipeline_status`, and `reviewed_at` already live on `firm_clients`.
- **Alternatives considered:** Moving engagement state to a separate `firm_client_engagements` table. Rejected because `firm_clients` already represents a `(firm_id, client)` relationship and all firm portal queries in `clients.ts` already key off `firm_clients.id` + `firm_id`.

### 2. Firm-Scoped Intake Decision & Direct Signed-In Grant on `/i/[token]`
- **Decision:**
  1. In `requestFirmIntake` ([intake.ts](../../../apps/haven/src/lib/firms/intake.ts)), query `firm_clients` by `.eq("firm_id", link.firmId).eq("normalized_email", email).maybeSingle()`. If no row exists for that firm, `decideIntake` receives `existing: null` and returns `invite_new` (or if the email already has a Haven user account or is already signed in, allows joining the new firm without failing with `other_firm`).
  2. When a client submits the email form on `/i/[token]` for Firm B and already has an existing `auth.users` account (for example, created via Firm A or organic signup), `ensureInvitedAuthUser` encounters an existing user; instead of failing when `createUser` returns an existing-email error, send a sign-in/claim magic link or allow the signed-in user to grant access directly on `/i/[token]`.
  3. Add a signed-in direct access grant flow on `/i/[token]` (`grantFirmAccessAction`): when an authenticated client (whose email is not a lawyer email) visits `/i/[token]`, display a "Grant [Firm Name] access to your Haven data" card (if not yet joined to that firm) or an "Already connected to [Firm Name]" card (if already joined). Clicking Grant Access upserts the `(firm_id, normalized_email)` `firm_clients` row with `user_id`, `joined_at = now()`, and if the user already has a completed profile (`profiles` + `immigration_profiles`), immediately populates `shared_answers` via `sharedAnswersFromProfile` and `completed_at = now()` so the lawyer firm immediately sees their information.
- **Rationale:** A client who already has a Haven account and opens a second lawyer's link is usually signed in (or can sign in) and wants to grant access immediately ("once they grant access to their data, all law firms they invite should be able to see their information"). Supporting both direct signed-in grant and email-token claim covers both authenticated and unauthenticated entry points.

### 3. Token-Scoped `claimFirmInvite`
- **Decision:** Update `claimFirmInvite({ userId, email, claimToken })` in [intake.ts](../../../apps/haven/src/lib/firms/intake.ts) to fetch all `firm_clients` rows matching `normalized_email` (instead of `.maybeSingle()`) and select the row whose `claim_token_hash` or `previous_claim_token_hash` matches `hashClaimToken(claimToken)` (or if already claimed for that token/user, return `"joined"` idempotently). Also backfill `shared_answers` and `completed_at` from the user's existing profile if the user already completed onboarding previously.
- **Rationale:** When a user has `firm_clients` rows across multiple firms, `.eq("normalized_email", email).maybeSingle()` fails with a multiple-rows error. Matching against the hashed `claimToken` uniquely identifies which firm invite is being claimed.

### 4. Fan-Out of `recordFirmSharedAnswers` Across All Connected Firms
- **Decision:** Update `recordFirmSharedAnswers(userId, draft, form)` in [answers.ts](../../../apps/haven/src/lib/firms/answers.ts) to select all `firm_clients` rows for `.eq("user_id", userId)` (removing `.maybeSingle()`) and update each row with the merged `shared_answers` and `completed_at`.
- **Rationale:** Keeps every invited firm's view of the client's intake answers in sync whenever the client updates `/onboarding` or `/onboarding/deadlines`, while preserving any firm-specific custom question answers already stored in each row's `shared_answers.customAnswers`.

### 5. Multi-Firm Engagement Timelines on `/dashboard`
- **Decision:**
  - Add `getClientFirmEngagementRecords(userId): Promise<ClientFirmEngagementRecord[]>` in [intake.ts](../../../apps/haven/src/lib/firms/intake.ts) returning all joined `firm_clients` rows (`joined_at is not null`) ordered by `joined_at desc, created_at desc`. Keep `getClientFirmEngagementRecord(userId)` returning `records[0] ?? null` for single-firm callers.
  - Add `getClientFirms(userId): Promise<ClientFirmInfo[]>` returning all joined firms for a user, and update `/documents`, `/onboarding`, and `/onboarding/deadlines` to pass all connected firm names to `FirmSharingNote` and union `requiredDocuments` and `intakeQuestions` across connected firms.
  - Update [dashboard/page.tsx](../../../apps/haven/src/app/dashboard/page.tsx) to build a `FirmEngagementOverview[]` list (one per connected firm, computing document completion against each firm's `requiredDocuments` and milestones from each firm's `engagementState`) and render each firm's timeline in [firm-engagement-dashboard.tsx](../../../apps/haven/src/components/app/firm-engagement-dashboard.tsx).

### 6. Hardening Remaining `.maybeSingle()` Queries on `firm_clients`
- **Decision:** Bound any remaining lookup that checks whether an email/user belongs to *any* firm or fetches the primary/most-recent firm (`isJoinedFirmClientEmail`, `getAdvisorFirmLink`, `clientRowFor` in `firm-contact.ts`) with `.order("joined_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(1).maybeSingle()`.
- **Rationale:** Prevents PostgREST `PGRST116` errors when a client has 2+ rows in `firm_clients`.

## Risks / Trade-offs

- **[Risk] Unauthenticated existing user enters email on `/i/[token]` for a second firm** → `supabase.auth.admin.createUser` fails when the email already exists in `auth.users`. Mitigation: In `requestFirmIntake` / `ensureInvitedAuthUser`, detect when the email already belongs to an existing client user; if so, create/update the `(firm_id, normalized_email)` `firm_clients` row with a fresh claim token and send a magic link / sign-in link to `/i/[token]` (or `/reset-password?claim=<token>`) so the existing user can claim the new firm invite without resetting their password unless desired.
- **[Risk] Custom intake questions differ between Firm A and Firm B** → Merging `shared_answers` across firms could overwrite Firm A's `customAnswers` when saving Firm B's questions. Mitigation: Merge `customAnswers` additively (`{ ...existing.customAnswers, ...incoming.customAnswers }`) on each firm's row in `recordFirmSharedAnswers`.

## Migration Plan

1. Apply `supabase/migrations/0048_multi_firm_clients.sql` to drop `firm_clients_normalized_email_key` and `firm_clients_user_id_key` and create `firm_clients_firm_email_key` and `firm_clients_firm_user_uidx`.
2. Deploy updated intake, claim, shared answers, and dashboard components.
3. Rollback strategy: Only possible if no client has joined multiple firms; otherwise, deduplicate `firm_clients` by `(normalized_email)` / `(user_id)` before restoring single-column unique constraints.

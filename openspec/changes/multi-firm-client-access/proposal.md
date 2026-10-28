## Why

Clients exploring legal representation or working with multiple counsel (for example, consulting two firms before retaining one, or using an employer's immigration firm alongside an independent O-1/EB-1A firm) frequently open intake links from more than one law firm. Currently, `public.firm_clients` enforces single-column unique constraints on `normalized_email` and `user_id`, and the intake decision logic blocks any client already associated with another firm (`other_firm`). As a result, a client cannot grant access to a second law firm, and the client dashboard can only render a single law firm engagement timeline.

## What Changes

- **Multi-firm client membership in database:** Replace the global single-firm uniqueness constraints on `public.firm_clients` (`normalized_email` and `user_id`) with composite per-firm uniqueness constraints (`(firm_id, normalized_email)` and partial unique index on `(firm_id, user_id) where user_id is not null`), allowing a single client to connect with multiple law firms while preventing duplicate rows within the same firm.
- **Multi-firm intake and access grant flow:**
  - Scope existing-client intake lookups to `(firm_id, normalized_email)` so opening an intake link (`/i/[token]`) from a new firm allows the client to join that firm even if they are already connected to another firm.
  - Allow already-authenticated clients visiting `/i/[token]` for a new firm to directly grant access in one click (in addition to the email confirmation/claim flow), immediately linking their `user_id` and populating `shared_answers` from their existing profile so the newly invited firm can view their information right away.
  - Scope `claimFirmInvite` token matching across all `firm_clients` rows for the client's email so claiming a specific firm's invite targets the matching firm row instead of failing when multiple firm rows exist.
- **Shared data synchronization across all invited firms:**
  - Update `recordFirmSharedAnswers` so when a client completes or updates their onboarding setup or deadlines, their `shared_answers` and `completed_at` are synchronized to all joined `firm_clients` rows for that `user_id`.
  - Aggregate required documents and custom intake questions across all connected firms during onboarding and on the document vault, and update `FirmSharingNote` banners to list all connected firms that have access to the client's shared data.
  - Ensure firm-specific engagement state (`engagement_state`, `pipeline_status`, `reviewed_at`) remains isolated per `(firm_id, client_id)` while shared profile answers and uploaded `user_documents` are visible to every firm the client has granted access to.
- **Multiple lawyer engagement timelines on the client dashboard:**
  - Replace single-record dashboard resolution with multi-firm engagement retrieval (`getClientFirmEngagementRecords(userId)`).
  - Update the client dashboard (`/dashboard`) and `FirmEngagementDashboard` to render an independent lawyer engagement timeline for each connected law firm (showing that firm's milestones, lawyer notes, consultation booking link, and firm-specific document checklist progress).

## Capabilities

### New Capabilities
- `firm-intake`: Multi-firm client intake, direct access grant for signed-in clients on `/i/[token]`, token-scoped invite claiming, and synchronization of shared client answers and documents across all connected law firms.
- `client-firm-engagements`: Multiple lawyer engagement timelines on the client dashboard and multi-firm sharing indicators across onboarding and the document vault.

### Modified Capabilities

## Impact

- **Database Migrations:** New migration `supabase/migrations/0048_multi_firm_clients.sql` dropping `firm_clients_normalized_email_key` and `firm_clients_user_id_key` and adding per-firm composite unique indexes.
- **Firm Intake & Data Sync (`apps/haven/src/lib/firms/`):** `intake.ts`, `answers.ts`, `advisor-link.ts`, and `src/lib/advisor/firm-contact.ts`.
- **Intake Route (`apps/haven/src/app/i/[token]/`):** `page.tsx`, `FirmIntakeForm.tsx`, and server action for signed-in direct access grant.
- **Client Dashboard & Sharing UI (`apps/haven/src/app/dashboard/`, `onboarding/`, `documents/`):** `dashboard/page.tsx`, `firm-engagement-dashboard.tsx`, `firm-sharing-note.tsx`, `onboarding/page.tsx`, `onboarding/deadlines/page.tsx`, and `documents/page.tsx`.

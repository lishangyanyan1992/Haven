# Design

## Context

See `proposal.md` for motivation. Currently:
- `/settings` (`apps/haven/src/app/settings/page.tsx`) renders an intake audit banner, four profile/intake cards (`Immigration profile`, `Employment`, `Green card journey`, `Help needed`), an `Email settings` card, and `<GreenCardEditor />` (`apps/haven/src/components/app/green-card-editor.tsx`).
- Having both `Green card journey` (which writes flat columns `perm_stage`, `i140_filed`, `i140_approved`, `i485_filed`, `priority_date`, `preference_category`, and `deadline_answers.greenCardSponsor` / `retainedPriorityDateSponsor`) and `Green cards` (`deadline_answers.immigrantPetitions`) on the same page forces users to enter green card information twice and causes contradictions when one is edited without the other.
- `advisor_remembered_facts` (`supabase/migrations/0029_advisor_remembered_facts.sql`) stores verbatim user facts (`id`, `user_id`, `thread_id`, `source_message_id`, `kind`, `quote`, `quote_hash`, `dismissed_at`, `created_at`). Its `kind` column is unrestricted `text`, and `thread_id` / `source_message_id` are already nullable. Currently it is only surfaced at the bottom of `/advisor` (`AdvisorWorkspace.tsx`) and is not shown in `/firm/clients/[id]`.
- `document_facts` and `field_sources` (`supabase/migrations/0049_document_facts_and_field_sources.sql`) store details extracted from uploaded documents. They appear on `/documents` ("What Haven took") and as inline `<FieldSourceLabel />` annotations under individual fields, but there is no unified view in the user's info page showing everything extracted from their documents alongside chat memories and manual notes.
- `/profile` is already listed in `protectedPrefixes` and `config.matcher` in `apps/haven/src/proxy.ts` (while `/profile/community` is in `archivedRoutes`), making `/profile` the natural route for **Your Info**.

## Goals / Non-Goals

**Goals:**
- Give clients one clear place (`/profile`, labeled **Your Info** in `AppShellNav`) for everything Haven knows about their case: current visa & employment, green cards filed, document-extracted facts, and case memory (chat-remembered facts + manual case notes).
- Keep `/settings` strictly for system preferences (email notification toggles).
- Eliminate the duplicate "Green card journey" form card so `<GreenCardEditor />` is the single UI for viewing and editing green cards, without losing legacy flat green card fields for existing users.
- Allow users to manually add and remove case notes in `advisor_remembered_facts` (`kind = 'note'`) and surface all active memories in `/profile`, `/advisor`, Advisor prompt context, and the lawyer's client detail page (`/firm/clients/[id]`).

**Non-Goals:**
- Multi-entry historical visa editor (the user confirmed keeping a single Current Visa & Employment section alongside the multi-entry Green Cards editor).
- Per-fact privacy toggles for lawyer sharing (the user confirmed all active memories are shared with connected lawyers, and removing a memory hides it everywhere).
- Changing how `extractFacts` pattern-matches chat messages or replacing pattern extraction with an LLM call.

## Decisions

### 1. Route & Navigation Split: `/profile` ("Your Info") and `/settings` ("Settings")
- **Choice**: Create `apps/haven/src/app/profile/page.tsx` for "Your Info" and add `{ href: "/profile", label: "Your Info", icon: UserCheck }` (or `User`) to `AppShellNav` right before `Settings`. Narrow `apps/haven/src/app/settings/page.tsx` to a focused system preferences form (`saveSystemPreferencesAction`) that updates `community_reply_email_notifications` and `status_update_email_notifications`.
- **Rationale**: `/profile` is already protected by `proxy.ts` and not blocked by `archivedRoutes` (which only blocks `/profile/community`). Keeping `/settings` for email/system preferences matches user expectations and prevents breaking existing `/settings` links.
- **Alternatives considered**:
  - Tabs inside `/settings`: Rejected because the user explicitly chose separate sidebar items ("Your Info" and "Settings").

### 2. Consolidating "Green card journey" into `<GreenCardEditor />`
- **Choice**:
  1. Remove the `Green card journey` card from the profile form (`saveProfileSettingsAction` / `saveCaseInfoAction` will no longer take `greenCardStage`, `priorityDate`, `preferenceCategory`, `greenCardSponsor`, `retainedPriorityDateSponsor`, or `i140Approved` from a separate form).
  2. Expand `<GreenCardEditor />` pathway/type and category options so non-EB pathways (such as marriage/family `I-130` or `Immediate Relative (Spouse)` from `universal-green-card-intake`) and `i130_filed` / `i130_approved` / `consular_processing` / `conditional_resident` stages can also be represented cleanly in `<GreenCardEditor />`.
  3. Add a pure helper `seedPetitionsFromLegacyProfile(profile)` in `apps/haven/src/lib/petitions.ts`: when `profile.immigrantPetitions` is empty (`undefined` or `[]`) AND the profile has legacy flat green card activity (`permStage !== "not_started"`, `i140Filed`, `i140Approved`, `i485Filed`, `priorityDate`, `greenCardSponsor`, or `retainedPriorityDateSponsor`), synthesize 1–2 `ImmigrantPetition` records (e.g., an ended prior-employer approved I-140 if `retainedPriorityDateSponsor` differs from `greenCardSponsor`, plus the primary green card record) so `<GreenCardEditor />` displays them immediately instead of saying "No green cards added yet."
  4. Enhance `flatFieldsFrom` in `apps/haven/src/lib/petition-save.ts` so saving petitions also syncs `preference_category`, `i485_filed`, and `deadline_answers.greenCardSponsor` / `retainedPriorityDateSponsor` (and resets `perm_stage = 'not_started'`, `i140_filed = false`, `i140_approved = false`, `i485_filed = false`, `priority_date = null` when the petition list is saved empty), and updates `firm_clients.shared_answers` (`greenCardStage`, `greenCardSponsor`, `priorityDate`, `preferenceCategory`, `greenCards`, `greenCardSponsors`).
- **Rationale**: Downstream readers (`resolveDashboardFacts`, `immigration-journey.ts`, `firm/clients/[id]/page.tsx`) still inspect flat columns alongside `immigrantPetitions`. Keeping `flatFieldsFrom` authoritative on every `<GreenCardEditor />` save guarantees backwards compatibility while giving the user a single place to edit green cards.

### 3. Reusing `advisor_remembered_facts` for Manual Case Notes
- **Choice**: Store manually added case notes in `public.advisor_remembered_facts` with `kind = "note"` and `thread_id = null`, `source_message_id = null`.
  - Extend `RememberedFactKind` in `apps/haven/src/lib/advisor/memory.ts` to `"employment" | "filing" | "status" | "date" | "note"`.
  - Add `addManualFact(userId: string, quote: string): Promise<RememberedFact>` in `apps/haven/src/lib/advisor/memory.ts`: validates `1 <= quote.trim().length <= 240`, upserts into `advisor_remembered_facts` on `(user_id, quote_hash)` with `dismissed_at: null` (so re-adding a previously dismissed note un-dismisses it!).
  - Add `POST /api/advisor/memory` in `apps/haven/src/app/api/advisor/memory/route.ts` to create a manual note and return `{ fact }`.
  - Update `renderFactsForPrompt` in `apps/haven/src/lib/advisor/memory.ts` so facts with `kind === "note"` are labeled `(added by the user in Case Memory on ${said})` while chat-extracted facts remain labeled `(said in a conversation on ${said})`.
- **Rationale**: `advisor_remembered_facts` already has RLS, deduplication via `quote_hash`, soft-deletion via `dismissed_at`, and prompt rendering with date-safety guardrails (`mentionsWhen`). Using `kind = "note"` requires zero database schema migrations!
- **Alternatives considered**:
  - Separate `user_case_notes` table: Would duplicate CRUD, deduplication, prompt injection, and lawyer lookup queries with no benefit.

### 4. Unified "Case Memory & Extracted Facts" Component and Lawyer Visibility
- **Choice**:
  - Create a reusable client component `<CaseMemoryCard />` (`apps/haven/src/components/app/case-memory-card.tsx`) that renders:
    1. An input form to add a new manual case note (`POST /api/advisor/memory`)
    2. The list of active `RememberedFact` items (showing a badge `"Added by you"` for `kind === "note"` and `"From chat"` for chat-extracted facts, relative/formatted date, and a remove button calling `DELETE /api/advisor/memory`)
    3. When rendered on `/profile` ("Your Info"), an additional sub-section listing facts extracted from uploaded documents (`describeFacts` across the user's documents, with document name, page, extracted value, and status/link).
  - Use `<CaseMemoryCard />` in `/profile` and in `/advisor` (`AdvisorWorkspace.tsx`), so users can also add or remove memories right from the chat page.
  - In `apps/haven/src/lib/firms/clients.ts` (`getFirmClient`), query `advisor_remembered_facts` where `user_id = row.user_id` and `dismissed_at is null` (ordered by `created_at desc`, limit 24) and attach `rememberedFacts: RememberedFact[]` to `FirmClientDetail`.
  - Render a **Case Memory & Client Notes** section on `apps/haven/src/app/firm/clients/[id]/page.tsx` displaying those facts with their origin (`Client note` vs. `From chat`) and date recorded.

## Risks / Trade-offs

- **[Risk] Re-adding a previously dismissed manual note hits unique constraint `(user_id, quote_hash)`** → **Mitigation**: In `addManualFact`, use `.upsert({ user_id, kind: "note", quote, dismissed_at: null }, { onConflict: "user_id,quote_hash" })` so re-adding an identical sentence clears `dismissed_at` instead of failing or staying hidden.
- **[Risk] Legacy profiles with flat green card fields but no `immigrantPetitions` array appear empty when "Green card journey" is removed** → **Mitigation**: `seedPetitionsFromLegacyProfile(profile)` synthesizes initial `ImmigrantPetition` items for `<GreenCardEditor />` whenever `immigrantPetitions` is empty and flat green card fields exist.
- **[Risk] Bookmarks or internal links to `/settings#case-details` or `/settings#green-cards` land on system preferences** → **Mitigation**: Update all internal links (`dashboard-consistency.ts`, `document-facts/describe.ts`, `immigration-journey.ts`) to `/profile#case-details` and `/profile#green-cards`, and include a clear banner link on `/settings` pointing to `/profile` ("Looking for your visa, green card, or case memory? Go to Your Info →").

## Migration Plan

1. No destructive database migration is required (`advisor_remembered_facts.kind` is unrestricted `text`, and `user_profiles` columns remain intact for backward compatibility).
2. Deploy `/profile` ("Your Info"), updated `/settings`, `<CaseMemoryCard />`, and Lawyer Dashboard memory panel together.
3. Verify with unit/integration tests covering legacy green card seeding, petition-to-flat-field sync, manual memory add/dismiss/un-dismiss, Advisor prompt rendering, and Lawyer Dashboard rendering.

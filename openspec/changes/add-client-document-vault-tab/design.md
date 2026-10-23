# Design

## Context

- See `proposal.md` for motivation and scope.
- Today, `/documents` (`apps/haven/src/app/documents/page.tsx`) is gated behind `documentContextAvailableFor(user.email)` (which checks `DOCUMENT_READING_ALLOWLIST` or `isJoinedFirmClientEmail`) and is only reachable via an inline text link at the top of `/advisor`.
- `AppShellNav` (`apps/haven/src/components/app/app-shell-nav.tsx`) currently renders only two sidebar items: `Ask` (`/advisor`) and `Settings` (`/settings`).
- `user_documents` (`supabase/migrations/0005_document_vault.sql`) already stores `document_kind text not null` and `display_label text not null` with no restrictive Postgres enum constraint, and `GET /api/files/sign?documentId=...` already issues a 5-minute signed download URL for the document owner.
- Law firms (`public.firms` in `supabase/migrations/0033_firms.sql`) currently have `id`, `name`, `is_demo`, and `created_at`, with no column for required documents.

## Goals / Non-Goals

**Goals:**
- Give every signed-in invited client a `Documents` tab in `AppShellNav` and an organized vault on `/documents`.
- Let lawyers configure a firm-wide required documents list on `/firm` (selecting from common immigration presets and adding custom document items) and see each client's progress on `/firm` and `/firm/clients/[id]`.
- Reuse `user_documents.document_kind` and `user_documents.display_label` so slot uploads, relabeling, and lawyer views stay in sync without a second document-mapping table.

**Non-Goals:**
- Per-client custom document requests (one required-documents list per firm for now).
- Email notifications when a client uploads a document or when a lawyer updates the required list.

## Decisions

### 1. Storing firm required documents on `public.firms`
Add `required_documents jsonb default null` to `public.firms` via migration `0039_firm_required_documents.sql`.
- `null` means the firm has not saved its required-documents setup yet, which triggers the first-time setup card on `/firm`.
- Once saved, `required_documents` holds a JSON array of `{ key: string, label: string, isCustom?: boolean }` objects (validated on the server: max 25 items, non-empty label up to 80 chars, deterministic slug `key` such as `passport_biographic_page` for presets or `custom_<slug>` for custom items).
- *Alternative considered:* A separate `firm_required_documents` table. Since the list is firm-wide, small (<25 items), and always read together with the firm on `/firm`, `/firm/clients/[id]`, and `/documents`, a single JSONB column on `firms` avoids extra joins and RLS policies while keeping updates atomic.

### 2. Matching client uploads to required document items
Each preset or custom required document has a `key` (stored in `user_documents.document_kind`) and a `label` (stored in `user_documents.display_label`).
- **Targeted upload:** When a client uploads a file directly from a required-document row (or selects a category in the uploader), the form passes `documentKind` and `displayLabel` to `POST /api/files/sign`, which saves those exact values on `user_documents`.
- **Auto-inferred upload:** When a client uploads via the general uploader without picking a slot, `inferDocumentMetadata(fileName, mimeType)` assigns the preset `document_kind` and `display_label` (expanded to give `i94_record` and `i20_form` their own keys alongside `passport_biographic_page`, `uscis_notice`, `i140_notice`, `h1b_petition`, `perm_certification`, `ead_card`, `paystub`, and `visa_stamp`).
- **Relabel / recategorize:** A server action `updateVaultDocumentAction` lets the client change `document_kind` and `display_label` on any existing row in `user_documents` they own, so an already uploaded file can be assigned to a firm's requested item or a standard category without re-uploading.

### 3. Opening `/documents` and background reading to all signed-in clients
- Add `{ href: "/documents", label: "Documents", icon: FileText }` to `navItems` in `AppShellNav`.
- Update `documentContextAvailableFor` so it returns `true` for any signed-in invited client unless an explicit kill-switch (`DOCUMENT_READING_DISABLED=true`) is set, while keeping the existing daily page cap and 30-page limit.

## Risks / Trade-offs

- [AI reading cost now that all invited clients have the Documents tab] → Haven is invite-only, and the existing per-user daily page cap (`DAILY_PAGE_CAP`) and 30-page limit in `src/lib/document-context/read.ts` remain enforced.
- [A client uploads a file with a generic filename and doesn't use the slot button] → The client can re-assign the category/label in one click on `/documents`, or upload directly on the requested slot row.
- [Demo firm reset (`ResetDemoButton`)] → Seed the demo firm with a realistic default `required_documents` list during demo reset so lawyer demo accounts showcase the feature immediately.

## Migration Plan

1. Apply migration `0039_firm_required_documents.sql` adding `required_documents jsonb` to `public.firms`.
2. Ship the firm required-documents setup/edit controls, the updated `/firm` and `/firm/clients/[id]` views, the `Documents` sidebar tab in `AppShellNav`, and the organized `/documents` vault.

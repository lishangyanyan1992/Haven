# Tasks

## 1. Database & Shared Document Catalog

- [x] 1.1 Add migration `supabase/migrations/0039_firm_required_documents.sql` adding `required_documents jsonb default null` to `public.firms` with a check constraint ensuring it is null or a JSON array, and update `apps/haven/src/types/database.ts` and `apps/haven/src/lib/firms/types.ts`. Verify `npm --prefix apps/haven run typecheck` passes.
- [x] 1.2 Define the preset immigration document catalog, custom document slug/normalization helpers, and `inferDocumentMetadata` updates (`i94_record`, `i20_form`, plus existing categories) in `apps/haven/src/lib/document-vault.ts`, and add unit checks verifying preset lookup, custom item validation, and filename auto-detection.

## 2. Lawyer Required Documents Setup & Firm Views

- [x] 2.1 Add server queries and actions in `apps/haven/src/lib/firms/` and `apps/haven/src/server/` to load and save a firm's `required_documents` list (scoped to `requireFirmMember`), and update demo firm seeding (`apps/haven/src/lib/firms/demo.ts`) to include a default required documents list. Verify with a script/check that saving preset and custom items persists only on the caller's firm.
- [x] 2.2 Build the required-documents setup card (shown when `required_documents` is `null`) and "Edit required documents" control on `apps/haven/src/app/firm/page.tsx`, allowing lawyers to toggle preset documents and add/remove custom document items. Verify `npm --prefix apps/haven run typecheck` passes and the controls render on `/firm`.
- [x] 2.3 Update `listFirmClients` (`apps/haven/src/lib/firms/clients.ts`), `apps/haven/src/app/firm/page.tsx`, and `apps/haven/src/app/firm/clients/[id]/page.tsx` to display required-document completion counts (e.g., `2/4 required`) on the table and a required vs. additional documents breakdown (with `OpenDocumentButton` for uploaded items and missing status for unuploaded items) on the client detail page. Verify `npm --prefix apps/haven run typecheck` passes.

## 3. Client Document Vault Tab & Management Actions

- [x] 3.1 Add the `Documents` (`/documents`) tab to `AppShellNav` (`apps/haven/src/components/app/app-shell-nav.tsx`) and update `documentContextAvailableFor` (`apps/haven/src/lib/document-context/store.ts`) so all signed-in invited clients have access to `/documents` and background reading. Verify that `AppShellNav` renders `Ask`, `Documents`, and `Settings` and `npm --prefix apps/haven run typecheck` passes.
- [x] 3.2 Update `POST /api/files/sign` (`apps/haven/src/app/api/files/sign/route.ts`) to accept optional `documentKind` and `displayLabel` fields for targeted slot/category uploads, and add `updateVaultDocumentAction` in `apps/haven/src/server/document-actions.ts` so clients can change the category/label of an existing document they own. Verify ownership enforcement and `npm --prefix apps/haven run typecheck`.
- [x] 3.3 Rebuild `apps/haven/src/app/documents/page.tsx` as an Organized Vault showing the firm's required documents checklist (for firm clients) or Haven's standard document categories (for non-firm clients), per-slot upload buttons, signed-URL Open/Download links (`/api/files/sign?documentId=...`), category/label editor, AI reading status/retry, and delete. Verify `npm --prefix apps/haven run typecheck` and `npm --prefix apps/haven run build` succeed.

## Workflow follow-up

- Apply the change with `/openspec-apply-change add-client-document-vault-tab`.
- Archive the change with `/openspec-archive-change` once verified.

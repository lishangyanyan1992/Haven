# Proposal

## Why

Clients currently have no sidebar tab for their documents, cannot open or relabel files they have already uploaded, and have no checklist showing which immigration documents their law firm needs from them. Giving every signed-in client an organized Document Vault tab—backed by a firm-configurable required documents list that lawyers set up on `/firm`—lets clients manage their files in one place and gives lawyers a structured view of what is uploaded and what is still missing.

## What Changes

- **Document Vault tab for all signed-in clients.** Add `Documents` (`/documents`) to the client sidebar navigation (`AppShellNav`) alongside `Ask` and `Settings`, and enable the vault and background AI reading for all signed-in invited clients instead of gating behind `DOCUMENT_READING_ALLOWLIST`.
- **Lawyer setup and editing of required documents on `/firm`.** When a lawyer opens `/firm` before configuring their firm's document list, show a setup card pre-populated with common immigration documents to check/uncheck plus an input to add custom required documents. Once saved, lawyers can edit the firm's required documents list at any time from `/firm`.
- **Organized client Document Vault (`/documents`).**
  - Clients linked to a firm see a **"Requested by [Firm Name]"** checklist showing each required document's status (`Uploaded` vs. `Needed`), with a direct upload control for missing items.
  - Clients not linked to a firm (or whose firm has not saved a list yet) see Haven's standard immigration document categories to organize their vault.
  - Clients can **upload**, **open/download** (via signed URLs), **change the category/label** (`document_kind` and `display_label`), **check or retry AI reading status**, and **delete** any document in their vault.
- **Required-document tracking for lawyers (`/firm` and `/firm/clients/[id]`).** Show required-document completion on the `/firm` client table (e.g., `2/4 required`) and display the firm's required documents checklist on `/firm/clients/[id]` alongside any additional uploaded documents.

## Capabilities

### New Capabilities

- `document-vault`: Client sidebar tab and organized document vault where all signed-in clients upload, open/download, categorize/relabel, delete, and fulfill requested documents.
- `firm-required-documents`: Law firm setup, editing, and client-level tracking of required immigration documents (both preset types and custom firm items).

### Modified Capabilities

None. The project has no archived specs in `openspec/specs/` yet.

## Impact

- **Database:** New migration adding `required_documents jsonb` on `public.firms` (`null` until the lawyer saves their firm's setup; stores an ordered array of `{ key, label, isCustom }` items).
- **Client navigation & access (`apps/haven/src/components/app/app-shell-nav.tsx`, `apps/haven/src/lib/document-context/store.ts`, `apps/haven/src/app/advisor/page.tsx`):** Add `Documents` tab to `AppShellNav` and open document context/vault access to all signed-in invited clients.
- **Client vault (`apps/haven/src/app/documents/page.tsx`, `apps/haven/src/server/document-actions.ts`, `apps/haven/src/lib/document-vault.ts`, `apps/haven/src/app/api/files/sign/route.ts`):** Organized checklist/category layout, targeted slot uploads, signed-URL open/download link, category/label editing action, AI reading status, and delete.
- **Firm dashboard & client detail (`apps/haven/src/app/firm/page.tsx`, `apps/haven/src/app/firm/clients/[id]/page.tsx`, `apps/haven/src/lib/firms/clients.ts`):** First-time required-documents setup card and edit modal/drawer on `/firm`, required-document completion count in the client list, and required vs. additional document breakdown on `/firm/clients/[id]`.

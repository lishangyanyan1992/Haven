# Tasks

## 1. Database Migration & Data Model

- [x] 1.1 Create migration `0042_firm_leads_pipeline.sql` adding `phone`, `full_name`, and `pipeline_status` (with check constraint) to `firm_clients` and verify with local migration scripts
- [x] 1.2 Update TypeScript types in `apps/haven/src/lib/firms/types.ts` to include `phone`, `fullName`, and `FirmPipelineStatus`, verifying compilation passes with `pnpm --filter haven typecheck`

## 2. Intake Flow (Mandatory Phone & Name Collection)

- [x] 2.1 Update `requestFirmIntake` and `requestFirmIntakeAction` to require and validate `fullName` and `phone`, storing them on `firm_clients`
- [x] 2.2 Update `FirmIntakeForm.tsx` on `/i/[token]` to render required Name and Phone inputs with client-side and server-side validation
- [x] 2.3 Add test coverage in `apps/haven/evals/` or unit tests ensuring intake rejects submissions missing phone numbers or names and persists them on success

## 3. High-Visibility Contact Quick Actions

- [x] 3.1 Create reusable `<ContactQuickActions />` component providing large contact typography, `mailto:` link, `tel:` link, and 1-click clipboard copy with animated visual checkmark feedback
- [x] 3.2 Integrate `<ContactQuickActions />` into `/firm/clients/[id]/page.tsx` header with clear visual prominence

## 4. Leads Dashboard, Filters & CRM Export

- [x] 4.1 Create `updateFirmClientPipelineStatusAction` in `firm-actions.ts` allowing firm members to change a lead's pipeline status with firm isolation enforcement
- [x] 4.2 Update `/firm/page.tsx` to list active leads (`pipeline_status != 'contract_signed'`), rendering quick contact actions and a pipeline status dropdown for each lead
- [x] 4.3 Add filter controls on `/firm/page.tsx` for urgency tier, pipeline stage, and date range
- [x] 4.4 Implement CRM CSV export utility and download button to export filtered leads into standard CRM format

## 5. Dedicated Retained Clients View & CMS Export

- [x] 5.1 Add `/firm/clients/page.tsx` dedicated exclusively to retained clients (`pipeline_status == 'contract_signed'`) with a top-level tab switcher between Leads and Retained Clients
- [x] 5.2 Implement CMS dossier and document export endpoint/action to download client details and uploaded vault documents in an archive package
- [x] 5.3 Verify the end-to-end lifecycle: lead creation -> intake -> manual stage override -> graduation to `/firm/clients` upon `contract_signed` -> CMS export

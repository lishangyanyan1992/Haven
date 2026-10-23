# Proposal

## Why

Law firms using Haven currently see an undifferentiated list of "Clients", even when a prospect has only submitted an email address. In actual legal practice, prospective inquiries are **Leads** that require immediate outreach (emailing and phone calls), active pipeline tracking (consultations, retainers), and CRM export (e.g. to HubSpot, Clio Grow, or Salesforce). Once a retainer contract is signed, they become **Clients**, who belong in a dedicated retained client view with streamlined export capabilities to case management systems (e.g. Clio Manage, MyCase, Filevine).

Capturing mandatory phone numbers during initial intake, providing 1-click email and calling actions, separating leads from signed clients, and enabling CRM/CMS exports makes Haven a practical, high-converting growth tool for immigration firms.

## What Changes

- **Mandatory Phone Collection on Intake**: Update the firm intake landing page (`/i/[token]`) to require Full Name and Phone Number alongside Email, ensuring firms capture direct phone contacts upfront even if prospects abandon subsequent questionnaire steps.
- **High-Visibility Contact & Quick-Action Card**: On both the leads table and client details view, display contact information prominently with 1-click actions:
  - "Open Email" (`mailto:`) and "Copy Email" (with clipboard feedback).
  - "Call" (`tel:`) and "Copy Phone" (with clipboard feedback).
- **Dual Status Tracking (Intake vs. Pipeline)**:
  - Preserve automated **Intake Status** (`email_sent`, `in_progress`, `finished`).
  - Introduce firm-controlled **Pipeline Status** (`new_lead`, `contacted`, `consultation_scheduled`, `consultation_completed`, `contract_sent`, `contract_signed`, `archived`), allowing lawyers to manually override and update a lead's stage.
- **Dedicated Leads Dashboard with CRM Export**:
  - The default `/firm` dashboard focuses strictly on active leads (everyone prior to `contract_signed`).
  - Add filters for date range, urgency tier, pipeline stage, and visa type.
  - Add an "Export Leads (CSV)" button that produces CRM-ready spreadsheets.
- **Dedicated Clients Page with CMS Export**:
  - Introduce `/firm/clients` for retained clients who have signed a contract.
  - Provide a CMS Export action allowing lawyers to download client dossiers and complete document packages (ZIP or structured export) for ingestion into case management software.

## Capabilities

### New Capabilities

- `firm-intake`: Prospective client intake link submission with mandatory phone, email, and full name collection.
- `firm-leads-pipeline`: Lead management on the lawyer dashboard, manual pipeline status overrides, quick contact action buttons, filtering, and CRM spreadsheet export.
- `firm-client-management`: Retained client workspace for contract-signed clients, separated from leads, with case dossier and document package CMS export.

### Modified Capabilities

*(None. No existing durable specs exist in the repository.)*

## Impact

- **Database / Schema**:
  - `firm_clients` table: Add `phone` (text), `pipeline_status` (text, default `'new_lead'`).
  - Migration script for schema alterations and index support for pipeline filtering.
- **Backend / Actions**:
  - `requestFirmIntake`: accept and store `fullName` and `phone`.
  - New server action `updateFirmClientPipelineStatusAction(firmClientId, status)`.
  - Lead CSV generation helper for CRM export.
  - Client case dossier & document archive export endpoint/action for CMS export.
- **Frontend / UI**:
  - `/i/[token]` (`FirmIntakeForm`): Add required Full Name and Phone input fields with validation.
  - `/firm`: Filter bar, Contact quick-action buttons, pipeline status dropdown selector, and "Export Leads to CRM" button.
  - `/firm/clients`: Retained clients view showing signed clients and "Export Client to CMS" download action.
  - `/firm/clients/[id]`: Enhanced contact hero section with large contact typography and 1-click mail/call/copy buttons.

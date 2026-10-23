# Design

## Context

See `proposal.md` for motivation and background.

Currently, `firm_clients` stores `normalized_email`, `shared_answers`, and intake lifecycle timestamps (`email_sent_at`, `consented_at`, `joined_at`, `completed_at`, `reviewed_at`). The lawyer dashboard (`/firm`) lists all entries under a single table titled "Clients" and derives status purely from setup completion flags (`firmClientStatus`).

We are evolving this into a two-tier model:
1. **Leads** (`pipeline_status != 'contract_signed'`): Early prospects who submitted their contact information via `/i/[token]`.
2. **Clients** (`pipeline_status == 'contract_signed'`): Retained clients whose matters are actively under representation.

## Goals / Non-Goals

**Goals:**
- Collect mandatory phone numbers and full names at the initial intake link screen (`/i/[token]`) so lawyers have phone and email immediately.
- Display high-visibility contact details with 1-click actions (`mailto:`, `tel:`, clipboard copy with checkmark feedback) on leads lists and detail views.
- Provide a lawyer-controlled `pipeline_status` field separate from the automated intake completion state.
- Split the lawyer experience into a primary Leads dashboard (`/firm`) and a Retained Clients workspace (`/firm/clients`).
- Support filtering leads and exporting them to a CRM-compatible CSV file.
- Support exporting retained client data (profile dossier + uploaded documents) for Case Management System (CMS) ingestion.

**Non-Goals:**
- Building a full CRM or Case Management System inside Haven (no billing, time tracking, invoice generation, or trust accounting).
- Direct bi-directional API sync with Clio/Salesforce/HubSpot (file-based export via CSV and ZIP is sufficient and avoids third-party API token overhead).

## Decisions

### 1. Schema Extensions in `firm_clients`
We add columns directly to `firm_clients`:
```sql
ALTER TABLE firm_clients
  ADD COLUMN phone text,
  ADD COLUMN full_name text,
  ADD COLUMN pipeline_status text NOT NULL DEFAULT 'new_lead';

ALTER TABLE firm_clients
  ADD CONSTRAINT firm_clients_pipeline_status_check
  CHECK (pipeline_status IN (
    'new_lead',
    'contacted',
    'consultation_scheduled',
    'consultation_completed',
    'contract_sent',
    'contract_signed',
    'archived'
  ));

CREATE INDEX idx_firm_clients_pipeline
  ON firm_clients(firm_id, pipeline_status);
```
*Rationale*: Storing `phone` and `full_name` directly in `firm_clients` ensures they are queryable and indexed alongside `normalized_email` without parsing JSONB `shared_answers`.

*Alternatives Considered*: Storing phone only in `shared_answers`. Rejected because `shared_answers` is only written when someone enters the onboarding flow; if a visitor submits `/i/[token]` and doesn't finish onboarding, their phone would be lost.

### 2. Dual Status: Intake State vs. Pipeline Stage
- **Intake State (Automated)**: `email_sent` | `in_progress` | `finished` (tracks visitor technical progression).
- **Pipeline Stage (Manual)**: `new_lead` | `contacted` | `consultation_scheduled` | `consultation_completed` | `contract_sent` | `contract_signed` | `archived` (tracks firm business progression).
- Setting `pipeline_status = 'contract_signed'` moves the lead out of the `/firm` leads table and into `/firm/clients`.

### 3. CRM Export Format (CSV)
Exported CSV includes standard fields compatible with HubSpot, Salesforce, and Clio Grow:
- `First Name`, `Last Name`, `Email`, `Phone`, `Visa Type`, `Employer`, `Urgency Tier`, `Urgency Reason`, `Pipeline Stage`, `Intake Status`, `Joined Date`.

### 4. CMS Export Format (Client Dossier & Documents)
For retained clients (`/firm/clients` and `/firm/clients/[id]`), provide an export route (`/api/firm/clients/[id]/export`):
- Downloads a structured ZIP containing:
  - `case-summary.json` / `case-summary.csv` (profile answers, urgency, dates, questionnaire answers).
  - Folder `documents/` containing decrypted vault files named `<document_kind>_<filename>`.
- Uses streaming ZIP compression (`fflate` or `archiver`) without buffering large files in server memory.

### 5. UI Architecture & Reusable Contact Actions
Create a reusable `<ContactActionGroup />` component:
- Displays email and phone with larger typography (`text-body` or `text-h3` on detail view).
- Email: `mailto:<email>?subject=Haven%20Immigration%20Intake` + Copy button with a 2-second checkmark icon feedback.
- Phone: `tel:<phone>` + Copy button with checkmark icon feedback.

## Risks / Trade-offs

- **[Risk]** Adding mandatory phone number increases friction on the initial `/i/[token]` intake page.
  → *Mitigation*: The form remains concise (3 fields: Name, Email, Phone Number). Immigration leads expect phone contact from legal counsel, making friction minimal compared to value captured.
- **[Risk]** Existing rows in `firm_clients` do not have `phone` or `pipeline_status`.
  → *Mitigation*: The database migration sets default `pipeline_status = 'new_lead'` and leaves `phone` nullable for legacy entries. UI renders `—` when phone is absent.
- **[Risk]** Generating ZIP archives of multiple large vault documents could hit serverless execution timeouts.
  → *Mitigation*: Stream files directly through a Next.js Route Handler using `ReadableStream` piping from Supabase Storage.

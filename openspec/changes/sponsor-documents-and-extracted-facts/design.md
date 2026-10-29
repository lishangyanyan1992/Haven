# Design

## Context

See proposal.md for motivation and specs for behavior.

Current state, observed in code:

- Uploads land in `user_documents`. A background job (`lib/document-context/store.ts`, `readQueuedDocument`) transcribes pages with the Advisor model and stores passages in `document_chunks`. Reading is transcription only; nothing is interpreted (`lib/document-context/read.ts`).
- Required documents are a firm-level ordered list `{ key, label, isCustom }` in `firms.required_documents` (`lib/firms/required-documents.ts`, `lib/document-vault.ts`). Presets include `i140_notice`, `perm_certification`, `h1b_petition`. Uploads carry a `document_kind`; nothing links a document to a sponsor.
- Green card records are JSON in `user_profiles.deadline_answers.immigrantPetitions`, each with a stable `id`, read through `normalizePetitions` and matched with `sponsorMatches` in `lib/petitions.ts` (from `dashboard-consistency-multi-green-card`, partly built).
- Settings saves flat profile fields (`priorityDate`, `employerName`, `visaType`, `countryOfBirth`, `preferenceCategory`, …) through `saveProfileSettingsAction`. No field records where its value came from.

Constraint: this change builds on two unfinished changes. The Settings "Green cards" editor (task 6.2 of `dashboard-consistency-multi-green-card`) and the checklist on `/documents` and `/firm/clients/[id]` (`add-client-document-vault-tab`) must exist first.

## Goals / Non-Goals

**Goals:**
- One place records where each value came from, and every screen reads it.
- Extraction is a separate step after transcription, so a failure never blocks the searchable text the Advisor already uses.
- The field list per document type lives in code, in one table, so the "what Haven will read" copy and the extractor cannot drift apart.

**Non-Goals:**
- Lawyer-side editing of client values.
- Free-form extraction or new document types beyond the fixed list.
- Re-reading all existing documents in bulk.

## Decisions

### 1. Field keys as plain strings, one table for sources
Every fillable value gets a key: profile fields use their name (`currentVisaExpiryDate`), green card fields use `petition:<petitionId>.<field>` (`petition:american-family.priorityDate`). A new table `field_sources` holds one row per user and key: `origin` (`document` | `person` | `document_deleted`), current `value`, `document_fact_id` (set null on delete), `document_value` when a person's value differs, `resolution` (`open` | `kept_mine` | null), `updated_by`, `updated_at`. Unique on (user_id, field_key). Owner-only RLS; firm access through the existing firm-client access check.

*Why not store the source inside `deadline_answers` JSON next to each value?* The profile is split between columns and JSON; a separate table works the same for both, can be queried for "open disagreements" on the lawyer's client list, and cascades cleanly. *Why string keys rather than a foreign key to petitions?* Petitions are JSON, not rows.

### 2. Extracted details stored per document
New table `document_facts`: `document_id` (cascade delete), `user_id`, `fact_key` (from the fixed list, e.g. `i140.priority_date`), `value` (normalized: ISO date, receipt number, category enum), `raw_text` (what was read), `page`, `confident` boolean, `applied_to` (field key or null), `state` (`filled` | `needs_check` | `not_used_person_value` | `not_used_record_removed`). This drives the "What Haven took" list.

### 3. Extraction runs after transcription, from text
After `readQueuedDocument` stores chunks, a second step calls the model with the transcribed pages and a strict schema for that document kind's fields only (structured output). No images are resent. The model returns each value plus the page and the exact text it came from; code then validates format (date parses, receipt number matches `^[A-Z]{3}\d{10}$`, category in the allowed set). A value that fails validation, or the model marks unsure, is stored with `confident = false` and not applied. Document kind comes from the upload slot or `inferDocumentMetadata`; the I-797 for H-1B is recognised as an `h1b_petition` or `uscis_notice` whose text names Form I-129.

*Alternative considered:* extracting during transcription in one call. Rejected: it couples the Advisor's search text to the extractor's schema and makes a schema failure lose the transcript.

### 4. One extraction table drives copy, prompt and mapping
`lib/document-facts/catalog.ts` lists per document kind: fact key, plain label ("Priority date"), target field, and whether it is sponsor-scoped. The checklist copy ("Haven will take…"), the extractor schema, and the apply step all read this one table.

### 5. Apply rules
For each confident fact with a target field:
- No `field_sources` row, or origin `document`/`document_deleted` → write the value, origin `document`.
- Origin `person`, same value → relabel origin `document` (confirmed).
- Origin `person`, different value → keep value, set `document_value`, `resolution = open`, fact state `not_used_person_value`.
Existing values saved before this change have no row; they count as `person` when non-empty (they were typed in onboarding or Settings), so documents never silently replace them.

Confirmed by the product owner on 2026-10-28: a document never replaces a value a person typed; it flags the difference instead. Alternative rejected: document always wins, with a switch-back label.

Status end date: I-94 admit-until beats H-1B valid-to (spec "One Status Date"), applied by giving H-1B valid-to no target field when an I-94 fact exists.

### 6. Sponsor routing
Green card facts go to the document's linked `petition_id` (new nullable column on `user_documents`). If unset, use `sponsorMatches` against the extracted sponsor name; on a match, also set the link. No match → create a petition via the same save path as the Settings editor (normalized, validated), stage inferred from the document (I-140 approval notice → `i140_approved`; PERM certification → `perm_certified`), then link.

### 7. Per-sponsor checklist is computed, not stored
`RequiredDocumentItem` gains `perSponsor?: boolean` (true by default for the three preset kinds; settable on custom items). The checklist builder expands each per-sponsor item over the client's normalized petitions and applies the stage gate (PERM cert ≥ `perm_certified`, I-140 ≥ `i140_filed`; unknown → requested). H-1B packet expands over the current employer only. Expansion is a pure function used by `/documents`, `/firm/clients/[id]` and the client-list count, so all three agree.

### 8. Settings writes sources
`saveProfileSettingsAction` and the green card save action compare each submitted value with the stored one; any changed field gets origin `person`, keeping `document_value` if a fact exists for it ("You changed this. Your I-140 notice says…"). Resolve actions are two small server actions: use-document (write fact value, origin `document`, clear resolution) and keep-mine (`resolution = kept_mine`).

### 9. Deletion
Document delete already removes `user_documents` rows; `document_facts` cascade and `field_sources.document_fact_id` is set null. A trigger or the delete action then sets origin `document_deleted` on rows whose fact disappeared and clears disagreements that referenced only that document.

### 10. Decisions made while building
- **A document moves a green card forward, never back.** An I-140 approval notice for a green card still marked "PERM certified" sets it to "I-140 approved", so the dashboard doesn't contradict the document. The step is not a labeled field.
- **The status end date is changed on the dashboard, not in Settings.** Settings shows it read-only with its label and a link, because "Your deadlines" owns that value and writes the firm's copy.
- **The firm's copy carries the sponsor list.** Lawyers never read the client's profile, so the shared answers gain `greenCardSponsors` (id, sponsor, step), written wherever the green card list is shared. Details and value sources are read by the server for the lawyer, like documents are.
- **Deploy order:** the migration must be applied before this code is live, or uploads fail on the new sponsor column.

## Risks / Trade-offs

- [Misread dates silently fill the dashboard] → Only confident, format-valid values are applied; every applied value is labeled and linked to its page; the lawyer sees each document's "What Haven took".
- [Reverses an earlier decision to cut extraction] → Scope kept to five document types and existing fields; no hidden review queue. Note in `log.md` when built.
- [Treating all pre-existing values as hand-entered may leave many disagreements on first upload] → That is the intended safe default; each one resolves in one click.
- [Auto-created green card records from a wrong document] → Card says "Added a new green card for IBM"; the record is removable in Settings and removal clears its labels.
- [Dependence on two unfinished changes] → Tasks start with a gate that checks both are merged.
- [Extra AI cost] → One text-only call per document, counted against the existing daily page cap.

## Migration Plan

1. Migration adds `document_facts`, `field_sources`, `user_documents.petition_id`, with RLS. Check live `schema_migrations` after merge (merging doesn't apply them).
2. Ship extraction behind the existing document-reading switch; turn on for a test account first and run "Read details" on his I-140 and PERM documents.
3. Rollback: turn off the extraction step; labels fall back to "You entered this"; the tables can stay.

## Open Questions

- Exact wording of labels and resolve buttons can be tuned in review without changing behavior.

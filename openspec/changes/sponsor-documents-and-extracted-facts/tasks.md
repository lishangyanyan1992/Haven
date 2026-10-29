# Tasks

## 1. Prerequisites and data

- [x] 1.1 Confirm `dashboard-consistency-multi-green-card` (Settings "Green cards" editor, `normalizePetitions`, `sponsorMatches`) and `add-client-document-vault-tab` (checklist on `/documents` and `/firm/clients/[id]`) are merged. Verify: both are on `main` and their screens load locally; stop and tell the owner if not.
- [x] 1.2 Add migration `0049_document_facts_and_field_sources.sql` (0048 was taken): `document_facts` (cascade on document delete), `field_sources` (unique user_id + field_key, `document_fact_id` set null on delete), `user_documents.petition_id`, owner-only RLS plus firm read through the existing firm-client access check. Update `types/database.ts`. Verify: `npm run typecheck`; after merge, check live `schema_migrations` lists 0048.

## 2. Per-sponsor checklist

- [ ] 2.1 Add `perSponsor` to `RequiredDocumentItem`, default true for `i140_notice`, `perm_certification`, `h1b_petition`; accept it in `validateRequiredDocumentList`; add a "Tied to a sponsor" checkbox for custom items in the firm setup and edit card. Verify: a check in `evals/firms/` that saving a custom per-sponsor item round-trips, and the firm card shows the checkbox in the browser.
- [x] 2.2 Add a pure `expandRequiredDocuments(items, petitions, employerName, documents)` returning one entry per sponsor with status Uploaded / Needed / Not needed yet (with reason), using the stage gates in design decision 7. Verify: `evals/documents/sponsor-checklist.check.ts` covers two approved sponsors, the two-employer fixture (second employer ended in prevailing wage → "Not needed yet"), no petitions (one item, no sponsor), and a stage change.
- [ ] 2.3 Use `expandRequiredDocuments` on `/documents`, `/firm/clients/[id]` and the `/firm` client-list count; uploads from a sponsor item save `petition_id`; general uploads of a sponsor-tied kind ask which sponsor; add "Change sponsor" on the document card. Verify: the count check gives "2/3 required" for the spec example, and in the browser an upload from "I-140 approval notice — <sponsor>" marks only that item Uploaded.

## 3. Reading details

- [x] 3.1 Add `lib/document-facts/catalog.ts` with the fixed field list per document kind (fact key, plain label, target field, sponsor-scoped) and a helper that turns it into the "Haven will take…" sentence. Show that sentence on every checklist item and the upload screen. Verify: a check that every catalog target field exists on `ImmigrationProfile` or `ImmigrantPetition`, and the I-140 item shows the expected sentence in the browser.
- [x] 3.2 Add `extractDocumentFacts(kind, pages)` that calls the model with a structured schema built from the catalog, then validates each value (date, receipt number pattern, category set) and sets `confident`. Recognise an H-1B approval as an I-797 naming Form I-129. Verify: `evals/documents/fact-extraction.check.ts` runs on fixture transcripts (I-140, PERM, H-1B I-797, I-94, passport, paystub) with a stubbed model, and checks that a bad date and an out-of-list field are rejected.
- [x] 3.3 Run extraction after chunks are saved in `readQueuedDocument`, as its own step whose failure leaves reading status `done` and logs the error; store results in `document_facts`, replacing earlier facts for that document. Count the call against the daily page cap. Verify: a store check that an extraction failure keeps the chunks, and a reread replaces facts.
- [x] 3.4 Add "Read details" on documents read before this change. Verify in the browser on a pre-existing document: facts appear after the job runs.

## 4. Applying details and recording sources

- [x] 4.1 Add `lib/field-sources.ts`: field key helpers (`petition:<id>.<field>`), `applyDocumentFacts(userId, documentId)` with the apply rules in design decision 5 (pre-existing non-empty values count as person-entered), sponsor routing and new-record creation in decision 6, and the I-94-over-H-1B rule. Write through the existing profile and petition save paths so signals are recomputed. Verify: `evals/documents/apply-facts.check.ts` covers empty fill, same value (confirmed), different person value (disagreement), unconfident fact (not written), new sponsor (record created), and I-94 vs H-1B.
- [x] 4.2 Make `saveProfileSettingsAction` and the green card save action mark changed fields as person-entered, keeping the document value; add `useDocumentValueAction` and `keepMineAction`; on green card removal delete its sources and mark its facts "Not used: green card removed". Verify: server-action checks for overwrite, both resolve actions, undoing a resolve, and record removal.
- [x] 4.3 On document delete, set affected sources to "document deleted" and clear disagreements that referenced only that document. Verify: a check that deleting the I-140 fixture keeps the value with the deleted label, and saving the field then reads "You entered this".

## 5. Showing labels and disagreements

- [x] 5.1 Add a small source label component and show it on every profile field in Settings and every field in the Green cards editor, with the disagreement box and the two resolve buttons. Verify in the browser at desktop and phone widths: a priority date shows "From your I-140 notice, page 1", and a seeded disagreement resolves both ways.
- [ ] 5.2 Add the "What Haven took" list to the client document card and the lawyer's document view, each filled item linking to its Settings field, plus "Added a new green card for <sponsor>" when one was created. Verify in the browser for an I-140 and a paystub ("doesn't take any details").
- [ ] 5.3 On `/firm/clients/[id]` list open disagreements and "Keep mine" choices with both values and a document link; on `/firm` show "N to check" per client. Verify: a firm check on a fixture with one open and one kept-mine item, and the browser view as a lawyer.

## 6. Final check

- [ ] 6.1 Run `npm run typecheck`, `npm run check:dashboard` and the document and firm checks; on a test account upload or "Read details" both sponsors' documents and confirm the checklist shows per-sponsor items, the dashboard values match the documents, and every value is labeled. Verify: all commands pass; screenshots of Settings, Documents and the lawyer's client page attached to the PR.
- [x] 6.2 Add a dated entry to `log.md` noting that fact extraction returns (reversing the cut in `add-document-upload-profile`) with the fixed field list and labels. Verify: entry present.

## Workflow follow-up

- Archive after `add-client-document-vault-tab` and `dashboard-consistency-multi-green-card` are archived, so `sponsor-document-requests` and `field-source-labels` sit next to `firm-required-documents` and `green-card-petitions`.

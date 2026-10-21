# Tasks

## 1. Database

- [x] 1.1 Add migration `0031_document_chunks.sql`: drop `document_facts` and the `document_reading_enabled`, `document_reading_enabled_at`, `document_sourced_fields` profile columns; add `document_chunks` (owner-only rules, cascade on document delete) and `match_document_chunks` callable only by the server. Apply to the live database and verify: rules on, signed-out reads return nothing, the function is not callable without the server key.
- [x] 1.2 Update `src/types/database.ts` to match and verify `npm run typecheck` passes.

## 2. Remove the earlier build

- [x] 2.1 Delete the fact rules, review panel, review actions, dashboard reminder, profile-write code, document test personas and their checks; undo the `/inbox` and dashboard edits and the expiry-date profile field. Verify typecheck passes and every existing check in `evals/advisor/*.check.ts` that passed before still passes.

## 3. Reading

- [x] 3.1 Change the reader to transcribe each page to text, split into passages with page numbers, embed them and store them; keep the page cap, the 30-page limit and the "could not be read" reasons. Rewrite `evals/documents/extraction.check.ts` to check that sample I-797, I-20, EAD and passport documents (synthetic) produce passages containing their key dates and numbers on the right page, and that a non-immigration document produces none. Verify it passes.
- [ ] 3.2 Read every upload (no switch), keeping the daily job for deferred and failed reads. Verify by uploading a sample PDF on the owner's account and seeing it become ready, and an encrypted PDF showing "could not be read".

## 4. Vault page

- [x] 4.1 Build `/documents`: the note, the uploader (refusing Word and HEIC with the save-as message), and the list with status and delete; visible only to accounts on the test switch. Verify in the browser on the owner's account, and that a signed-out visit shows the "not part of Haven" page. (2026-10-20: page, note, upload and status checked on the owner's account; signed-out visits go to sign-in; accounts not on the switch get the "not part of Haven" page.)
- [ ] 4.2 Add one link to `/documents` from the chat, shown only to accounts on the test switch. Verify it appears for the owner and not for others.

## 5. Chat

- [x] 5.1 Look up the top passages for each question from the asking user's ready documents, embedding the question, and add them to the prompt with document name and page and the cite-it rule. Add a check with a test persona holding a synthetic I-94 passage: the answer uses its date and names the I-94; a persona with no documents gets no document block. Verify the check passes and `npm run eval:advisor:smoke` shows no new failures. (2026-10-20: 4/10 pass; every failure is the existing repeated-safety-line problem, fixed separately in PR #96.)

## 5b. Found in testing

- [x] 5.2 A question that names no topic ("until what date can I stay?") got the "which of these did you mean?" menu even when the user's I-94 answered it, because that check ran before the document lookup. Moved the lookup ahead of it; a passage scoring at least 0.40 now counts as understood. Uploads named "I-94.pdf" were labelled "Immigration document"; added I-94 and I-20 auto-labels and cite by file name when the label is generic. Verified by the new vague-question case in `npm run check:document-advisor` and on the owner's account: the answer used the I-94 date and cited "your uploaded I-94 (page 1)".

## 6. Release checks

- [x] 6.1 End to end on the owner's account: upload a sample I-94, see it become ready, ask the chat a question it answers, see the citation, delete the document, ask again and see it no longer used. (2026-10-20, with the owner's real I-94: read, answered and cited as "your uploaded I-94 (page 1)"; after delete the record, passages and stored file were gone and the chat's lookup returned nothing for the same questions. Checked by running the lookup directly rather than spending another of the owner's conversations.)
- [x] 6.2 Update the privacy policy wording to match the vault note, and confirm with the owner before it ships. (Approved by the owner 2026-10-20.)

## Workflow follow-up

- Widen the test switch after 6.1 and 6.2 are signed off.
- Archive the change with `/opsx:archive` once shipped.

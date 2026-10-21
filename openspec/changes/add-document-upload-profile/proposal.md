# Proposal

## Why

Haven's answers are only as good as what it knows about the person asking, and today that is a profile they type in by hand. Most of the detail that changes an answer — dates, receipt numbers, visa class, priority date, employer — is already printed on the person's own immigration documents. Letting people put those documents in one place, and letting the chat look things up in them when answering, gives better answers without a long form.

This is deliberately the smallest version of that idea: a place to keep documents, and a chat that can read them. It replaces an earlier, larger plan in this change (fact extraction, a review screen, automatic profile updates) that was built and then cut back before launch.

## What Changes

- A simple document vault: upload, see the list, delete. Nothing else on the page.
- When a document is uploaded, Haven turns it into searchable text in the background.
- When the user asks the chat something, Haven looks up the most relevant passages from that user's own documents and gives them to the Advisor alongside everything it already uses.
- When an answer relies on a document, it names the document and page, so the user can check it.
- Deleting a document removes everything Haven made from it.
- A plain note on the vault says documents are sent to OpenAI to be read.
- Hidden behind a test switch until it has been tried on real accounts.

Removed from this change (built earlier, now cut): extracting individual facts, the review/confirm screen, automatic profile updates and conflict questions, the on/off switch, and the dashboard reminder.

Not in this change: documents arriving by email, sharing documents with lawyers, Word and iPhone HEIC files (people are asked to save them as PDF or JPG).

## Capabilities

### New Capabilities
- `document-context`: keeping a user's immigration documents in a vault and letting the chat answer from them, with citations.

### Modified Capabilities
- None. There are no existing specs in this project yet.

## Impact

- **Vault page**: a new, simple page. The old vault (`/inbox`) stays retired.
- **Database**: one new table of searchable passages per document, owner-only, removed with the document. The fact tables and profile columns added earlier in this change are removed again.
- **Chat**: one extra lookup per question for users who have documents.
- **AI provider**: document contents, including passport pages, are sent to OpenAI to be read and searched.
- **Cost and usage**: one reading call per page at upload and one search per question; the existing daily page cap stays.

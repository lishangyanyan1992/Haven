# Design

## Context

- Upload already works: `/api/files/sign` stores files in the private `haven-vault` bucket with a row in `user_documents` (owner-only rules, 15 MB). The page that showed it, `/inbox`, was retired on 2026-08-19 with the dashboard, when Haven narrowed to the chat.
- The Advisor already searches its own knowledge with OpenAI embeddings (`text-embedding-3-small`, 1536 dimensions) and pgvector, through `match_knowledge_chunks` (migration 0002). Document search uses the same model and the same pattern.
- An earlier version of this change was built and partly applied: migration 0030 (live), plus fact extraction, review, profile writes and their checks. This design keeps the parts that still fit and removes the rest.
- Hosting is under usage pressure, so reading happens once per document, off the request path, and is capped.

## Goals / Non-Goals

**Goals:**
- Simplest thing that lets the chat answer from a user's documents and say where it got the answer.
- Reuse what exists: the upload route, the background reader, the page cap, the embedding model and search pattern.

**Non-Goals:**
- Pulling out individual facts, asking the user to confirm them, or writing to the profile.
- Searching across users, or any admin view of documents.

## Decisions

### 1. A new small page, not reopening `/inbox`
`/documents` with three things: the note, the uploader, and the list (name, status, delete, and "Read it" for documents uploaded before reading existed). `/documents` was on the retired-pages list as an old unused page; it comes off that list and is hidden by the test switch instead, and requires sign-in. `/inbox` stays retired; it carries email import and crisis copy that are out of scope. While testing, the page is visible only to `DOCUMENT_READING_ALLOWLIST`; for anyone else it is the same "not part of Haven right now" page. The chat gets one link to it.

### 2. Reading = turning each page into text
Reuse the background reader (upload route's `after()` plus the daily job, the page cap, the "could not be read" reasons). Instead of extracting fields, the model transcribes each page to plain text. Plain-text uploads skip the model.
*Why the model and not a PDF library:* scans and phone photos are the common case and have no text layer; one path handles PDFs and images alike.

### 3. Passages stored with their page
Split each page's text into passages of about 800 characters with some overlap, embed each with `text-embedding-3-small`, and store them in `document_chunks` (`user_id`, `document_id` → `user_documents` on delete cascade, `page`, `content`, `embedding vector(1536)`). Owner-only rules; inserts by the server only.

### 4. Lookup per question
For a signed-in user with at least one read document: embed the question (a separate small call — the Advisor's own question embedding happens deep inside community search and only sometimes, so reusing it would have meant re-plumbing that path), call `match_document_chunks(user_id, embedding, k=5, min_similarity)`, and pass the hits to the prompt as "From the user's own documents", each tagged with document name and page. The prompt says: use these when they decide the answer, name the document and page when you do, and never guess at anything they do not say. The function takes `user_id` and only the server can call it, so one user's question can never search another's documents.
*Alternative considered:* putting every document's full text in the prompt. Cheaper to build, but cost grows with each upload and long documents crowd out the rest of the prompt.

### 5. Consent by notice, not a switch
Uploading is the choice. The note on the page says what happens. Removing the switch also removes the queue states it needed.

### 6. Removing the earlier build
Migration 0031 drops `document_facts` and the three profile columns from 0030; keeps the reading-status columns, the usage table and the page-cap function; adds `document_chunks` and `match_document_chunks`. Code for facts, review, profile writes, conflicts, the dashboard reminder and their checks is deleted. Nothing outside this change used it.

## Risks / Trade-offs

- [Passport pages and petitions are sent to OpenAI] → Stated on the page before upload and in the privacy policy; test switch until reviewed.
- [The Advisor misreads a date from a passage] → Every use is cited with document and page, so the user can check the original; the prompt forbids inferring values a passage does not state.
- [Search misses the relevant passage] → The answer falls back to the profile, same as today; checked with sample documents.
- [Cost and hosting usage] → One read per document, daily page cap, 30-page limit per document, one search per question only for users who have documents.

## Migration Plan

1. Apply 0031 to the live database (feature still hidden).
2. Ship the page, reader and chat lookup behind the test switch.
3. Test on the owner's account with sample documents; run the Advisor checks.
4. Widen the switch.
Rollback: empty the switch. The tables can stay; nothing else reads them.

## Open Questions

- Passage size and similarity threshold — tune after trying sample documents.

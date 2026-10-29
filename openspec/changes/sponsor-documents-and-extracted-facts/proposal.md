# Proposal

## Why

Many immigration documents belong to one sponsor. A client with two green card sponsors (Acme Insurance and Harbor Ventures / Lakeside) has two PERM records and possibly two I-140 notices, but the document checklist asks for "I-140 approval notice" once, so the lawyer cannot tell which sponsor's notice is missing. And once a document is uploaded, Haven only keeps it as searchable text: the dates and numbers printed on it are still typed in by hand, and nobody can see where a value on the dashboard came from or whether it matches the paper.

This change makes the checklist ask per sponsor, fills the client's details from their documents automatically, and labels every filled value with the document it came from, so clients and lawyers can check it, change it, and settle any disagreement.

This brings back, in a narrower and visible form, the fact extraction that `add-document-upload-profile` cut before launch. The difference: a fixed short list of fields per document type, a clear "what Haven took" note on every document, and a label on every field instead of a hidden review screen.

## What Changes

- **One request per sponsor.** Documents that belong to a sponsor (I-140 notice, PERM certification, H-1B petition packet) appear once per sponsor in the client's checklist and the lawyer's view, named after the sponsor ("I-140 approval notice — Acme Insurance"). A sponsor's document is only requested once that sponsor's case has reached the step that produces it. Each upload is tied to one sponsor.
- **Haven tells people what it will read.** Every checklist item and upload screen lists the details Haven takes from that kind of document (for example, an I-140 notice: sponsor, receipt number, priority date, category, filing and approval dates).
- **Details are filled automatically.** After a document is read, Haven pulls those details and writes them into the client's profile or the matching sponsor's green card record without a confirm step. A sponsor named on a document that matches no green card record creates a new record.
- **Every filled value is labeled.** In Settings, on the dashboard's detail views, and on the lawyer's client page, each value shows where it came from: "From your I-140 notice, page 1", "You entered this", or "Haven wasn't sure — please check".
- **Anything can be changed.** Every value Haven filled can be overwritten in Settings. An overwritten value is labeled "You changed this. Your I-140 notice says Jun 14, 2021", with two actions: use the document's value, or keep mine (which clears the warning).
- **Hand-entered values are not overwritten.** If a person already typed a different value, the document does not replace it; the field is flagged as a disagreement to resolve instead.
- **Each document shows what Haven took from it**, for the client and the lawyer, with links to the fields it filled.
- **Deleting a document** keeps the values it filled but relabels them "From a document you deleted — please confirm".
- **Lawyers see disagreements.** The lawyer's client page lists every field where the client's value differs from a document.

Not in this change: lawyers editing a client's values (lawyers see labels and disagreements; the client edits), reading details from document types outside the fixed list, and asking for an H-1B packet from former H-1B employers (Haven only knows the current one).

## Capabilities

### New Capabilities
- `sponsor-document-requests`: Which documents are tied to a sponsor, how the checklist repeats them per sponsor and per case step, and how an upload is linked to its sponsor.
- `document-fact-extraction`: The fixed list of details Haven reads from each document type, how they are pulled and written into the profile and green card records automatically, and how the client and lawyer are told what was taken.
- `field-source-labels`: How every profile and green card value records and shows where it came from, how people overwrite it, and how disagreements between a person's value and a document are shown and resolved.

### Modified Capabilities
None. The related in-flight changes (`add-client-document-vault-tab`, `add-document-upload-profile`, `dashboard-consistency-multi-green-card`) have not been archived to `openspec/specs/`. Once archived, `sponsor-document-requests` extends `firm-required-documents`, and `field-source-labels` extends the green card editor in `green-card-petitions`.

## Impact

- **Depends on** `dashboard-consistency-multi-green-card` (the Settings "Green cards" editor, petition matching by sponsor) and `add-client-document-vault-tab` (the checklist and lawyer document view). Both must land first.
- **Database:** new tables for extracted details and for where each value came from; documents gain an optional sponsor link.
- **Reading pipeline:** one extra AI call per document after the text is read, using that text (no images resent). Document text is already sent to OpenAI; no new provider.
- **Screens:** client Documents page, Settings (profile fields and Green cards editor), lawyer's client page and client list completion count.
- **Data:** existing documents are not re-read automatically; a "Read details" action lets a client run it on older uploads.

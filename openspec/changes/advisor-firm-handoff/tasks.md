# Tasks

## 1. Contact-request storage

- [ ] 1.1 Add migration `supabase/migrations/0044_firm_contact_requests.sql` creating `firm_contact_requests` (columns per design §4), the partial unique index on open requests, the dashboard index, RLS enabled with a single lawyer `select` policy on `public.haven_firm_id()`, and no client or write policies. Verify by applying locally and checking that a second open insert for the same `firm_client_id` fails, and that a handled one does not block a new insert
- [x] 1.2 Add the table to `apps/haven/src/types/database.ts` and verify `npm run typecheck:haven` passes
- [x] 1.3 Extend `apps/haven/evals/firms/isolation.check.ts` with contact-request cases: a lawyer at firm A cannot read firm B's requests, and no client-role read or insert is allowed. Verify `npm run check:firm-isolation` passes

## 2. Firm membership lookup for the advisor

- [x] 2.1 Add `getAdvisorFirmLink(userId)` in `apps/haven/src/lib/firms/` returning `firm` (firm id, firm name, firm client id, pipeline status), `none`, or `unknown` on error, per design §1. Add a deterministic check covering all three outcomes with a stubbed client. Verify the new check passes
- [x] 2.2 Call it inside the retrieval `Promise.all` in `streamAdvisorResponse`, skip it for mock identities, and record `firmLink: firm|none|unknown` and the pipeline stage on the trace metadata, never the firm name. Verify with a local run that the trace shows the field and that end-to-end latency on the smoke preset is unchanged within noise

## 3. Handoff destination and wording

- [x] 3.1 Change `buildAttorneyHandoff` to take the firm link and produce the four variants in design §2 (signed, not signed including archived, none, unknown), with the new firm heading and `HANDOFF_DELIVERED` matching both headings. Return `contactOffer` for firm variants only. Verify by extending `apps/haven/evals/advisor/attorney-handoff.check.ts`. For each stage: no directory link, no "boutique firm" suggestion, and no not-a-referral note for firm clients. "your lawyer" appears only at contract signed. The `none` variant is unchanged. `unknown` has dates and questions only. The once-per-thread rule holds across old and new headings
- [x] 3.2 Wire the firm link into the handoff call in `service.ts` and attach `firm_contact_offer` to the answer payload. Add the optional field to `advisorAnswerPayloadSchema` in `lib/advisor/schema.ts`. Verify `npm run check:request-contract` passes and a stored payload without the field still parses
- [x] 3.3 Add the firm-client instruction to the advisor context (stage wording, never find/hire/compare attorneys, defer case-specific conflicts to the firm) per design §6. Add a deterministic check that flags "find / hire / retain / shop for an attorney" in firm-client answers. Verify the check passes on the firm-client fixtures in 3.4
- [x] 3.4 Add starter cases N03 (firm client asks whether to get a lawyer) and N04 (lawyer's advice conflicts with the general rule) to `evals/advisor/fixtures/stage-2-detailed-cases.json` with verified contracts, plus a firm-client persona in `src/lib/repositories/test-personas.ts`. Verify with `npm run eval:advisor -- --runs 3` on those cases: both pass on every run

## 4. "Let [firm] know" for the client

- [x] 4.1 Add a server action `sendFirmContactRequestAction(traceId)` per design §3. It loads the user's own answer by trace id, reads `firm_contact_offer` from the stored payload, resolves the firm from `firm_clients` and never from input, inserts, and maps a unique violation to "already sent" with the existing time. Add a check covering: success; another user's message is rejected; a user with no firm link is rejected; a repeat while open returns the existing time; and the stored row has only practice area, dates, and questions. Verify the check passes
- [x] 4.2 Render the button in `AdvisorWorkspace.tsx` from `firm_contact_offer`: the "Let [firm] know" label, an expandable "what [firm] will see" preview listing exactly the stored fields, and a sent state with the time. When a request is already open (asked through a status action on render), show "Sent [time]" instead of the button. Verify in the browser with the firm-client persona: preview matches the stored row, a click shows the sent state, and a reload keeps the sent state

## 5. Firm dashboard marker

- [x] 5.1 Extend `listFirmClients` (and the client detail loader) in `lib/firms/clients.ts` with `openContactRequest: { id, sentAt } | null` using one query per firm. Verify with a check that urgency tier, reason, and ordering from `lib/firms/urgency.ts` are identical with and without an open request, and that pipeline stage is unchanged. Run `npm run check:lead-urgency` and verify it still passes
- [x] 5.2 Show the "Asked to be contacted, [time ago]" marker and an "asked to be contacted" filter in `LeadsTableWithFilters.tsx`, and the same marker on the clients page. Verify in the browser on the demo firm that the marker and filter appear and that the urgency column is unchanged
- [x] 5.3 On the client detail view, show the request contents (practice area, dates, questions, time) and a "Mark handled" button backed by a new `markContactRequestHandledAction` in `server/firm-actions.ts` (uses `requireFirmMember`, scoped by `firm_id`). Verify that marking a request handled removes the marker and that the client's next handoff offers the button again
- [x] 5.4 Seed one open contact request in the demo firm reset (`lib/firms/demo.ts`). Verify `npm run check:firm-demo` passes and the demo dashboard shows the marker after reset

## 6. Integration

- [x] 6.1 Add the new deterministic checks to `check:advisor` / `check:firms` in the root `package.json` so CI gates them. Verify `npm run check:advisor && npm run check:firms` pass locally
- [ ] 6.2 End-to-end walkthrough on the demo firm. A firm-client persona at the new-lead stage asks a layoff question, gets the firm handoff with no directory, previews the request, and sends it. The lawyer sees the marker with the same contents and marks it handled. Moving the persona to contract signed changes the wording to "your lawyer at [firm]". An owner-invited user still gets the directory. Verify by recording each step's outcome in the change's notes

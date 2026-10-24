# Design

## Context

See `proposal.md` for why. What shapes the approach:

- **The client-to-firm link already exists.** `firm_clients` holds `firm_id`, a unique `user_id`, and `pipeline_status` (`new_lead` → `contract_signed`, plus `archived`). `firms` holds only `id` and `name`. Lawyers read their own firm's rows through RLS policies keyed on `public.haven_firm_id()`. Server code reads and writes firm tables with the admin client (`lib/firms/intake.ts`, `lib/firms/clients.ts`).
- **The handoff is built in code, not by the model.** `buildAttorneyHandoff` in `lib/advisor/attorney-handoff.ts` runs after the answer is finished. It fires only when `RECOMMENDS_COUNSEL` matches the answer, and returns plain markdown that `service.ts` (~5287) appends to the stream. A repeat in the same thread is detected by matching the block's heading (`HANDOFF_DELIVERED`).
- **The answer payload is structured and persisted.** `advisorAnswerPayloadSchema` (`lib/advisor/schema.ts`) is stored in `advisor_messages.answer_payload` (jsonb). `AdvisorWorkspace.tsx` renders the markdown plus payload extras such as follow-up chips.
- **Retrieval steps already run in parallel** (`Promise.all` in `streamAdvisorResponse`). The writing model's latency budget is already over its 15s target, so this change must add no sequential round trip.

## Goals / Non-Goals

**Goals:**
- Decide the handoff destination from facts in the database, never from the model.
- Make "what the firm receives" provably equal to what the client saw, and nothing more.
- Leave the urgency ranking and pipeline stage code untouched.

**Non-Goals:**
- Emailing or notifying the firm when a request arrives. The dashboard marker is the only surface for now.
- Firm contact details (phone, booking link) shown to the client. Deferred; see Open Questions.
- Giving firms any access to advisor conversations.
- Changing the generic "an immigration attorney" safety lines in the guardrail registry. They stay accurate; the handoff and one prompt instruction carry the firm-specific wording.

## Decisions

### 1. Firm membership is a three-state lookup, read per message
A new `getAdvisorFirmLink(userId)` in `lib/firms/advisor-link.ts` returns `{ kind: "firm", firmId, firmName, firmClientId, pipelineStatus }`, `{ kind: "none" }`, or `{ kind: "unknown" }` on any error. It runs inside the existing retrieval `Promise.all`, so it adds no sequential wait. It is skipped (treated as `none`) for mock identities.

*Why three states:* a failed lookup must not show the directory to someone who may be a firm client (spec: "Unknown firm membership never shows the directory"). Missing the directory for a minute costs a non-firm user little; showing it to a firm client is the failure this change exists to prevent.

*Why per message, not cached:* the firm can move someone to contract signed at any moment, and the wording must follow. One indexed read on `firm_clients.user_id` is cheap.

*Alternative considered:* putting the firm on the profile snapshot. Rejected because the snapshot loader serves several surfaces and the firm link is a different table with different access rules.

### 2. One handoff builder, three destinations
`buildAttorneyHandoff` takes the firm link as input and returns `{ text, practiceArea, contactOffer | null }`:

```
  firm link        destination block                          contactOffer
  ---------        -----------------                          ------------
  firm, signed     "Talking to your lawyer at [firm]"         yes
  firm, other      "Talking to the firm that invited you,     yes
                    [firm]"
  none             today's directory block (unchanged)        no
  unknown          dates + questions only, no destination     no
```

"Take with you" and "Worth asking" are shared by all four. The firm variants use a new heading, and `HANDOFF_DELIVERED` matches both the old and new headings so the once-per-thread rule still holds.

`archived` uses the not-signed wording. The firm closed the lead, but it is still the firm that invited them, and pointing an archived lead at the directory would reopen the competitor problem.

### 3. The contact offer travels in the payload; the request is rebuilt from it on the server
`advisorAnswerPayloadSchema` gains an optional `firm_contact_offer: { firmName, practiceArea, dates: string[], questions: string[] }`. It is optional, so stored messages without it stay valid. The workspace renders the "Let [firm] know" button from it, with an expandable "what [firm] will see" preview that lists exactly those fields.

When the client clicks, the browser sends **only the answer's trace id**, which the stored assistant message carries in `retrieval_metadata.traceId`. (The message id on a freshly streamed answer is a display id, not the database row, while the trace id is the same before and after a reload.) The server action:
1. resolves the signed-in user,
2. loads that user's assistant message with that trace id and reads `firm_contact_offer` from the stored payload,
3. resolves the user's current `firm_clients` row, and rejects the request if there is none,
4. inserts the request with those fields, and the firm id comes from step 3, never from the browser.

*Why:* the browser cannot add a sentence of the conversation to the request, or address another firm, because it supplies no contents at all. What the firm receives is, by construction, what was rendered. (Spec: "Request contents are limited…", "Requests are visible only to the client's own firm".)

*Alternative considered:* the client posts the fields. Rejected because it would need server-side validation that the fields match the shown handoff, which ends up as this design anyway.

The button's "already sent" state comes from a small status action the button calls when it renders, and from the create action's response after a click. It is never read from the payload or fixed at answer time, because both go stale once the firm handles the request.

### 4. Data model
New table `firm_contact_requests`:

| column | notes |
|---|---|
| `id` uuid pk | |
| `firm_id` uuid → firms, cascade | |
| `firm_client_id` uuid → firm_clients, cascade | |
| `practice_area` text | |
| `dates` jsonb (array of strings) | |
| `questions` jsonb (array of strings) | |
| `created_at` timestamptz default now() | |
| `handled_at` timestamptz null | |
| `handled_by` uuid → auth.users null | |

- Partial unique index on `(firm_client_id) where handled_at is null`, which gives one open request at a time at the database level. The action treats a unique violation as "already sent" and returns the existing row's time.
- Index on `(firm_id, handled_at, created_at desc)` for the dashboard query.
- RLS enabled. Policy: lawyers `select` where `firm_id = public.haven_firm_id()`. There are no client policies and no insert or update policies. Inserts and the handled update go through server actions with the admin client, matching how `firm_intake_sends` is handled.
- No advisor message id or thread id is stored, so there is no path from a request back to a conversation.

### 5. Dashboard: a marker beside urgency, never inside it
`listFirmClients` runs one extra query for the firm's open requests and attaches `openContactRequest: { id, sentAt } | null` to each summary. `LeadsTableWithFilters` shows the marker under the person's row and adds an "Asked to be contacted" filter. The clients page and client detail show the same marker, the request contents, and "Mark handled", a new action in `server/firm-actions.ts` that uses `requireFirmMember` and scopes its update by `firm_id`.

`lib/firms/urgency.ts` and the pipeline-status code are not modified. A check asserts that urgency output is identical with and without an open request.

### 6. Model wording for firm clients: one instruction, backed by checks
When the link is `firm`, the context gains one instruction: refer to the person's firm with the stage wording, and never tell them to find, hire, or compare attorneys. When a firm client reports something their firm told them, the instruction says to explain the general rule and defer the specific decision to the firm. The guardrail registry is unchanged.

The model can still slip, so this is verified rather than assumed. A deterministic check flags "find / hire / shop for an attorney" phrasing in firm-client answers, and the eval plan's starter cases N03 and N04 enter the golden set.

## Risks / Trade-offs

- [The model still says "consult an immigration attorney" for a firm client] → The handoff, which is code, names the firm right after the answer. The eval check catches regressions in the model text.
- [A lookup failure hides the directory from a non-firm user] → This is accepted, and it is visible: the lookup logs and records `firmLink: unknown` on the trace so the rate can be watched.
- [A firm ignores contact requests, and a client on day 58 waits] → This is out of scope to solve here. The handoff keeps "take with you" and questions, and the answer's own urgency language still applies. Firm contact details for direct calling are the follow-up (Open Questions).
- [Payload schema change breaks rendering of old messages] → The field is optional, and old messages render as today.
- [Demo firm shows an empty marker column] → The demo reset seeds one open request so the feature is visible in demos.

## Migration Plan

1. Ship the migration (additive: one table, indexes, one select policy).
2. Ship the code. Before deploying, run the firm-isolation check, the new contact-request check, and the handoff check in CI.
3. Rollback: revert the code. The table is inert without it and can stay. Old payloads with `firm_contact_offer` render without the button once the renderer is reverted, because the field is ignored.

## Open Questions

- Should firms get an email when a request arrives? This adds a notification path; it doesn't change the request or the marker.
- Should the handoff show firm contact details (phone, booking link) when the firm has set them? This needs new firm settings; it is additive to the handoff block.

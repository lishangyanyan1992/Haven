# Design

## Context

See proposal.md for motivation and the three specs for behavior.

Current state that shapes the approach:

- Onboarding's "Main concerns" chips write `user_profiles.top_concerns` (a Postgres `concern` enum: `layoffs`, `visa_expiry`, `gc_timeline`, `job_change`). Community matching, settings, and the firm client page read it. Firms see it through `firm_clients.shared_answers`, kept in sync for every connected firm by `recordFirmSharedAnswers`.
- Which onboarding questions a firm asks is a list of keys stored per firm and validated by the intake question catalog. `topConcerns` is one of those keys.
- AI chat lives in `advisor_threads` / `advisor_messages`. Messages are inserted server-side only (migration 0045). Clients can delete threads (0028). `answer_payload` holds the structured answer; `retrieval_metadata` holds internal retrieval detail.
- Firm data is read on the server with the service-role client after checking firm membership (`requireFirmMember`, `getFirmClient`), with read-only RLS policies keyed on `haven_firm_id()` as a second fence. `firm_contact_requests` (0044) is the closest existing pattern.
- A client can belong to several firms (0048).
- Email goes through Mailgun via a fetch in `email-notifications.ts`. Vercel crons exist but run daily or weekly; the plan may not allow frequent crons.

## Goals / Non-Goals

**Goals:**
- No copy of AI chat content is stored on the firm side; firms read the client's own rows, so client deletion removes it everywhere.
- Sharing is decided by data the server checks on every read, not by a flag a bug could leave on.
- The "AI can make mistakes" label cannot be dropped by the model.

**Non-Goals:**
- Attachments, message editing or deletion, typing indicators, real-time push. Pages refresh on load and after send.
- Per-lawyer assignment or per-lawyer read state. Read state is per firm.
- Letting the client choose per chat whether it is shared. Sharing is all-or-nothing after the notice.
- Changing what contact requests contain.

## Decisions

### 1. Help choices: new profile column, concerns derived on save
Add `user_profiles.help_needed text[]` with a check constraint against the nine fixed values. On every save (onboarding and settings), set `top_concerns` from a mapping table in code:
- Plan if I lose my job → layoffs
- Extend or renew my status → visa_expiry
- Next green card step, Review my current case → gc_timeline
- Changing employers, Other ways to stay in the US → job_change
- First consultation, Help for my spouse or children, Something else → none

`helpNeeded` is added to shared answers so every connected firm sees it.
*Alternative:* extend the `concern` enum. Rejected: mixes "what worries me" (used by Haven's matching) with "what I want from my lawyer", and enum changes are hard to undo.

### 2. Intake setting carries over by renaming the key
A migration rewrites each firm's stored question list, replacing `topConcerns` with `helpNeeded` in place. The catalog also treats `topConcerns` as an alias for `helpNeeded` when reading, so a list saved by an old deploy during rollout still works.

### 3. Messaging tables
- `firm_conversations`: `id`, `firm_id`, `firm_client_id` (unique together), `client_last_read_at`, `firm_last_read_at`, `client_last_alerted_at`, `firm_last_alerted_at`, `last_message_at`.
- `firm_messages`: `id`, `conversation_id`, `sender_role` (`client` | `lawyer`), `sender_user_id`, `body` (1–5,000 chars after trim, checked in the database), `source` (`onboarding` | `dashboard` | `advisor_reply`), `advisor_message_id` (nullable, references `advisor_messages` on delete set null), `created_at`.

Writes go through server actions using the service role, which derive firm and client from the session and `firm_clients`, never from form input. RLS adds read-only policies: lawyers where `firm_id = haven_firm_id()`; clients where the conversation's `firm_clients.user_id = auth.uid()`.
Unread = messages from the other side newer than this side's `last_read_at`. Opening the conversation sets it.
*Alternative:* per-message read receipts. Rejected: per-firm read state is all the spec needs.

### 4. Onboarding message sent once on finish
The open box is held in onboarding form state and written only in the final save, inside the same server action that records shared answers, once per firm the client is onboarding with. A unique partial index on (`conversation_id`) where `source = 'onboarding'` prevents a double submit creating two.

### 5. Chat sharing decided by acknowledgement time
New table `advisor_firm_visibility_acks` (`user_id`, `firm_id`, `acknowledged_at`, unique pair). A firm can see a thread when: the client is currently linked to that firm in `firm_clients`, an ack exists for that firm, and `thread.created_at >= ack.acknowledged_at`. This is checked in one server helper used by every firm-side read; no RLS policy grants firms access to advisor tables, so a missed check fails closed.
The chat send endpoint refuses (returns a `needs_notice` result with the firm names) when the user has a firm link without an ack. The chat screen shows the notice and records acks for all listed firms on "Got it".
*Alternative:* a `shared` flag on each thread. Rejected: harder to reason about when firms are added or removed.

### 6. Lawyer view renders the client's own rows
The firm client page loads shared threads through the helper in decision 5 and renders answers with the same answer component the client sees, in read-only mode, from `content` and the client-visible parts of `answer_payload`. `retrieval_metadata` and internal payload fields are never selected.
A lawyer reply to an answer is a normal `firm_messages` row with `source = 'advisor_reply'` and `advisor_message_id`. The quote is rendered live from the referenced message; if it is gone (set null by the delete cascade), the UI shows "The AI chat this refers to was deleted". No AI text is copied.

### 7. Label rendered by the UI
The "AI can make mistakes…" line is a fixed string rendered by the answer component under every answer, chosen by whether the viewer is a firm client, the lawyer, or a person with no firm. It is not part of the model prompt or output.

### 8. Email alerts sent at send time, throttled
After a message is saved, the server action decides whether to alert: alert if `last_alerted_at` for the recipient side is null, older than 15 minutes, or older than that side's `last_read_at`. Then it sets `last_alerted_at` and sends through the existing Mailgun helper, with a fixed subject and body naming only the firm or client and a link. Firm alerts go to every `firm_members` email. Failures are logged, not shown to the sender.
*Alternative:* a cron that batches unread messages. Rejected for now: frequent crons may not be available on the current plan, and immediate alerts are simpler.

## Risks / Trade-offs

- [Clients may not expect lawyers to read AI chats] → Notice before first chat, persistent "Visible to [Firm]" line, nothing before the notice is shared.
- [Shared chats go to every connected firm, including one the client is only consulting] → Confirmed by the owner on 29 Oct 2026 as intended, matching how answers and documents are shared. The notice names every firm; a new firm triggers a new notice.
- [Framing the AI chat as "ask your lawyer" could make clients expect a lawyer reply to every question] → The screen says the AI answers first and the lawyer "may" follow up; every answer carries the mistakes label.
- [Reverses a shipped privacy promise from advisor-firm-handoff] → Called out in the proposal; any public privacy copy that says chats stay private must be updated in the same release.
- [Firm members get emails for every client] → 15-minute throttle per conversation; per-lawyer preferences are a follow-up.
- [Lawyer reads AI content and treats it as the client's own statement] → Label shown on the lawyer side too.
- [Two concern fields drifting] → `top_concerns` is only ever written from `help_needed` once a client has help choices; settings edits go through the same mapping.

## Migration Plan

1. Migration: `help_needed` column, firm question-list key rename, `firm_conversations`, `firm_messages`, `advisor_firm_visibility_acks`, RLS read policies.
2. Deploy code. Old clients keep `top_concerns`; `help_needed` is empty until edited.
3. Check the live migrations table after merge (merging does not apply migrations).
4. Rollback: hide the Messages panels and notice behind the deploy revert; tables can stay. Reverting the key rename means rewriting `helpNeeded` back to `topConcerns`.

## Open Questions

- Exact email subject lines and the sender name.
- Whether the leads list shows all help choices or the first two plus a count.

## Implementation notes

- Firms cannot mark any setup question as required today, so the help question is always optional. The spec's "unless the firm marks it required" has nothing to hook into yet.
- The lawyer's view of an AI answer shows the answer text and the label, not the client's collapsible "Sources and context" panel. Lawyers see less than the client, never more.
- The send-endpoint gate is checked in `evals/advisor/firm-visibility.check.ts` rather than the request-contract check.
- The migration was tested on an in-memory Postgres with stand-ins for Supabase's auth schema, not on a Supabase project.
- Deploy order matters: the migration must be live before the code. Without the new tables, a firm client's AI chat fails closed with "Haven couldn't check who can see this chat".

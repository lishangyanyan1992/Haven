# Tasks

## 1. Database

- [x] 1.1 Write migration `0050_client_lawyer_messaging.sql`: `user_profiles.help_needed text[]` with a check against the nine values; rewrite each firm's stored intake question list replacing `topConcerns` with `helpNeeded`; verify by applying locally and confirming a firm that had `topConcerns` now has `helpNeeded` in the same position
- [x] 1.2 In the same migration add `firm_conversations` (unique firm + client), `firm_messages` (body length check, `source` check, `advisor_message_id` on delete set null, unique onboarding message per conversation) and `advisor_firm_visibility_acks` (unique user + firm); verify the constraints reject an empty body, a 5,001-character body, and a second onboarding message
- [x] 1.3 Add read-only RLS policies (lawyers by `haven_firm_id()`, clients by their own `firm_clients` link) and no insert/update policies; verify with SQL as a client of Firm A that Firm B's conversations and other clients' rows return nothing
- [x] 1.4 Regenerate `src/types/database.ts` and verify `npm run typecheck` passes in `apps/haven`

## 2. Help question

- [x] 2.1 Add the nine help choices with descriptions and the help-to-concern mapping in one module under `src/lib/firms/`; add `apps/haven/evals/firms/help-needed.check.ts` covering every mapping row and verify it passes
- [x] 2.2 Replace `topConcerns` with `helpNeeded` in the intake question catalog, keep `topConcerns` as a read alias; extend the check to confirm an old saved list still enables the help question
- [x] 2.3 Replace the concerns chips in the onboarding situation step with the help question (multi-select, descriptions, required only when the firm marks it); verify in the browser that the step shows nine choices and no "Main concerns"
- [x] 2.4 Save `help_needed` and the derived `top_concerns` in the onboarding save action and add `helpNeeded` to shared answers for every connected firm; verify by onboarding a test client and checking the profile and each `firm_clients.shared_answers`
- [x] 2.5 Replace the concern checkboxes in settings with help choices using the same save path; verify an edit appears on the firm's client page
- [x] 2.6 Show help choices on the firm client page situation section ("Not answered" when empty) and on leads list rows; verify on the demo firm

## 3. Direct messaging

- [x] 3.1 Add a messaging module in `src/lib/firms/` for get-or-create conversation, list messages, send (client and lawyer), and mark read, all deriving firm and client from the session; add `apps/haven/evals/firms/messaging.check.ts` for firm isolation, length limits, and that sending leaves stage and urgency unchanged; verify it passes
- [x] 3.2 Add the optional "What would you like your lawyer to know or answer?" box after the help question and send it once per onboarding firm in the final save; extend the check so a double submit creates one message and a blank box creates none
- [x] 3.3 Build the Messages panel on the firm client page (thread, lawyer names, reply box, marks read on open); verify sending a reply as a demo lawyer shows it with name and time
- [x] 3.4 Build the Messages area per connected firm on the client dashboard; verify a client connected to two firms sees two separate conversations
- [x] 3.5 Add the unread marker and "Unread messages" filter to the leads list; verify the marker appears after a client message and clears for the whole firm when one lawyer opens it

## 4. Email alerts

- [x] 4.1 Add alert emails (client → all firm members, lawyer → client) through the existing Mailgun helper with a fixed subject and body containing only the firm or client name and a link; extend the messaging check to assert no message text appears in the email body
- [x] 4.2 Add the 15-minute throttle that resets when the recipient has read since the last alert; extend the check for the four-messages-one-email and read-then-new-message cases

## 5. AI chat visibility

- [x] 5.1 Add the visibility helper (current firm link + ack + thread created after ack) used by every firm-side read; add `apps/haven/evals/advisor/firm-visibility.check.ts` for: no ack → hidden, thread before ack → hidden even if continued, second firm sees only threads after its own ack, disconnected firm sees nothing; verify it passes
- [x] 5.2 Make the chat send endpoint return `needs_notice` with firm names when a firm link has no ack, and add an endpoint to record acks; extend the request-contract check so a firm client without an ack cannot send and a person with no firm is unaffected
- [x] 5.3 Show the "ask your lawyer" notice before the first message, record acks on "Got it", and for firm clients show the "Your lawyer at [Firm] sees these questions. Haven's AI answers first." line and the "Ask your lawyer a question" box on every chat screen; verify in the browser with a demo client connected to one firm and to two firms, and that a person with no firm sees today's chat
- [x] 5.4 Render the "AI can make mistakes" label under every answer in the answer component, with the no-firm wording for people without a firm; extend a check to confirm the label is not part of the model prompt and appears for each answer
- [x] 5.5 Add the shared AI chats list to the firm client page, rendering answers read-only with the same component and never selecting `retrieval_metadata`; verify a lawyer sees exactly what the client saw, with the label
- [x] 5.6 Add "Reply to this answer" for lawyers, saving an `advisor_reply` message with the answer link, quoting it live, and showing "The AI chat this refers to was deleted" when gone; verify by replying, then deleting the chat as the client

## 6. Copy and docs

- [x] 6.1 Find and update any privacy or help text that says AI chats stay private from the firm (including the advisor-firm-handoff contact request copy); verify by searching the app for "conversation" and "private" near firm wording
- [x] 6.2 Add a short note to `openspec/changes/advisor-firm-handoff/design.md` pointing to this change for the reversed "no conversation content" rule; verify the note is present

## 7. Unified Messages + Ask Experience

- [x] 7.1 Convert `ClientMessages` on `/dashboard` (`src/components/app/client-messages.tsx`) into a "Messages with your lawyer" call-to-action card (showing firm name, unread status/latest message preview, and "You'll get an email when your lawyer replies.") that directs the client to `/advisor`
- [x] 7.2 Unify the lawyer thread in `/advisor` (`src/app/advisor/page.tsx` and `src/app/advisor/AdvisorWorkspace.tsx`): show the ongoing lawyer conversation (client messages, AI answers, and lawyer replies) alongside the "Your conversations" list for older private chats, ask the client if they want AI answers (`Yes` / `No`, with toggle), show the accuracy + lawyer response notice when `Yes`, and send messages either with AI answering first (`Yes`) or directly to the lawyer (`No`)
- [x] 7.3 Unify the lawyer's view on `/firm/clients/[id]` (`src/app/firm/clients/[id]/ClientMessagesPanel.tsx`, `SharedChatsPanel.tsx`, `page.tsx`) so client messages, shared AI answers (with "Reply to this answer"), and lawyer replies appear in a single chronological Messages panel
- [x] 7.4 Run `npm run typecheck` and all `apps/haven/evals/firms` and `apps/haven/evals/advisor` checks; verify all pass

## 8. Background AI Execution & Unified Thread Persistence

- [x] 8.1 Keep `/api/advisor/respond` running `streamAdvisorResponse` to completion on client disconnect (`src/app/api/advisor/respond/route.ts`) so `persistExchange` and `rememberFactsFrom` always save the answer when the user leaves `/advisor` mid-generation
- [x] 8.2 Keep in-flight Ask stream state (`messages`, `streamingId`, `isPending`, `conversationId`, `aiPreference`) in a module-level background store and persist `aiPreference` across route changes and reloads in `AdvisorWorkspace.tsx`
- [x] 8.3 Hydrate shared AI messages on `/advisor` (`src/app/advisor/page.tsx` and `src/app/advisor/AdvisorWorkspace.tsx`) so returning to `/advisor` displays persisted AI answers in the unified lawyer timeline alongside `firm_messages`
- [x] 8.4 Extend `apps/haven/evals/advisor/firm-visibility.check.ts` to verify background stream completion and shared AI message hydration in `/advisor`, and run `npm run typecheck` and all checks

## Workflow follow-up

- After merge, confirm migration 0050 is in the live migrations table (merging does not apply migrations).
- Archive the change after review.

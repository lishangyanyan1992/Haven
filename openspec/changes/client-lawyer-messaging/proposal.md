# Proposal

## Why

A firm invites a client into Haven, but the client has no way to tell the lawyer what they actually want, and the lawyer has no way to answer inside Haven. Onboarding asks for "Main concerns" (Layoff risk, Visa expiry, Green card timeline, Job change), which describes worry, not the help the client wants from the lawyer. Meanwhile the client's real questions go to the AI chat, where the lawyer never sees them. Lawyers want to know what a new client is asking for, and to step in where the AI could be wrong.

## What Changes

- **"What help do you need?" replaces "Main concerns".** Onboarding asks the client to pick the kinds of help they want from their lawyer (for example: a first consultation, a review of their case, a plan if they lose their job, other paths to stay in the US). Multiple choices allowed. The lawyer sees the choices on the client's page and in the leads list. Haven's own features that used the old concerns (community matching, settings) keep working because each help choice maps to the old concern areas.
- **Open box: "What would you like your lawyer to know or answer?"** Optional, at the end of the same step. What the client types becomes the first message in a conversation with their lawyer.
- **Client and lawyer message each other in Ask (`/advisor`), with a CTA on the dashboard.** Each client has one conversation per firm. On the client dashboard, "Messages with your lawyer" is a call-to-action card (showing unread status or latest message preview) that directs the client to Ask (`/advisor`). The lawyer reads and replies from a single unified Messages panel on the client's page on the firm dashboard. The firm dashboard marks clients with unread messages.
- **In Ask, the client is asked if they want AI answers.** When the client opens Ask to message their lawyer, Haven asks if they want AI answers (`Yes` or `No`, with a toggle to switch anytime). If they say `Yes`, Haven tells them that the AI will answer first, that it may not be 100% accurate, and that their lawyer will respond once they see the message. If they say `No`, their message goes directly to the lawyer without an AI response. Lawyer replies appear in the same unified thread in Ask.
- **The lawyer can see the client's shared AI answers in the unified thread.** **BREAKING (privacy promise):** the shipped `advisor-firm-handoff` change promised that AI chat content never reaches the firm. This change reverses that on purpose for chats after the client chooses AI answers. The lawyer sees the client's questions, any AI answers, and direct messages in one unified chronological panel, and can reply to the conversation or to a specific AI answer to correct or confirm it. Every AI answer carries a label: "AI can make mistakes. Your lawyer may reach out to confirm this." Older chats started before sharing stay private in the client's past conversations list.
- **Email alerts both ways.** The lawyer gets an email when a client writes; the client gets one when the lawyer replies. The email says there is a new message and links to it; it never includes the message itself. Alerts are batched so a burst of messages sends one email.

## Capabilities

### New Capabilities
- `client-help-request`: What the client is asked about the help they want from their lawyer during onboarding, how it is stored, how it feeds Haven's older concern areas, and how the lawyer sees it.
- `client-lawyer-messaging`: The per-firm conversation between a client and their lawyer: starting it from onboarding, sending and replying, unread markers, and email alerts.
- `advisor-chat-firm-visibility`: Which AI chats a firm can see, the notice and consent shown to the client, the "AI can make mistakes" label, and the lawyer replying to a specific AI answer.

### Modified Capabilities
None in `openspec/specs/` (only `firm-consultation-booking` is archived there, and it is unaffected). This change overrides the "no conversation content reaches the firm" requirement in the in-flight `advisor-firm-handoff` change's `firm-contact-requests` spec for chats covered by the new notice. Contact requests themselves are unchanged.

## Impact

- **Onboarding:** the concerns step in the onboarding flow and the onboarding save action; the firm intake question catalog (the old "Main concerns" key is replaced by the new help question, so firms that switched it off keep it off); settings page concern checkboxes become help choices.
- **Firm dashboard:** client detail page gains a Messages panel (direct messages plus shared AI chats); leads table gains an unread marker and filter and shows help choices.
- **Client dashboard:** a Messages area per connected firm.
- **AI chat:** notice before first chat, per-screen notice, per-answer label; threads record whether they are shared.
- **Database:** new tables for help choices (or a profile column), firm conversations and messages, and a shared flag plus notice timestamp on AI chat threads; row-level security so a lawyer reads only their own firm's clients and a client reads only their own conversations.
- **Email:** new alert emails through the existing Mailgun sender.
- **Multi-firm clients:** direct messages are private to one firm. Shared AI chats are visible to every firm the client is connected to, matching how answers and documents are shared today, and the notice names every firm.
- **Evals/tests:** firm isolation, notice gating, the label on every AI answer, and no message text in emails.

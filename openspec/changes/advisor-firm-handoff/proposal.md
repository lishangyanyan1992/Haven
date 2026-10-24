# Proposal

## Why

Since the October 2026 move to invitation only, most advisor users are clients or leads of the law firm that invited them. When the advisor recommends counsel, the attorney handoff still sends everyone to the public firm directory, so a firm that paid to bring a client into Haven can watch the advisor hand that client to a competitor. The handoff should send firm clients back to their own firm, in words that don't claim a relationship that doesn't exist yet.

## What Changes

- **The advisor knows the user's firm.** When answering, the advisor looks up whether the user belongs to a firm (through the existing client-to-firm link), along with the firm's name and the person's pipeline stage.
- **Firm clients never see the directory.** For a firm client, the attorney handoff drops the directory link, the "look for a small or boutique firm" fallback, and the not-a-referral note. It names the inviting firm instead.
- **Stage-aware wording.** Before the firm marks the contract signed, the handoff refers to "the firm that invited you, [name]". Once it is signed, it says "your lawyer at [name]". The handoff never calls the firm the user's lawyer before then.
- **"Let [firm] know" action.** A firm client's handoff carries a button. Clicking it sends the firm a contact request that holds only what the handoff already shows: the practice area, the user's own dates (what to bring), and the questions worth asking. The conversation itself is never included. Nothing is sent without the click.
- **Contact-request marker on the firm dashboard.** A lead or client with an open request shows an "Asked to be contacted" marker with the time and a way to read the note, plus a filter for those people. The marker does not change the urgency tier or the pipeline stage. The firm can mark a request handled.
- **The model's own wording follows suit.** For firm clients, the system prompt tells the model to refer to their firm instead of telling them to find or hire an attorney.
- **Unchanged for everyone else.** People invited directly by the owner, with no firm, keep today's directory handoff.

## Capabilities

### New Capabilities
- `advisor-attorney-handoff`: What the advisor offers when it recommends counsel, including how firm membership and pipeline stage change the destination and the wording, and when the handoff repeats.
- `firm-contact-requests`: A client or lead asking their own firm to contact them from inside Haven, what the request contains and excludes, and how it appears on the firm's dashboard without changing urgency or pipeline stage.

### Modified Capabilities
None. The project has no archived specs in `openspec/specs/` yet. The dashboard marker builds on the leads and clients views from the in-flight `firm-leads-pipeline-and-client-crm` change; this change adds its own requirements instead of editing that change's specs.

## Impact

- **Advisor:** `apps/haven/src/lib/advisor/attorney-handoff.ts` (destination and wording by firm and stage), `apps/haven/src/lib/advisor/service.ts` (firm lookup, prompt line for firm clients, handoff wiring), `apps/haven/src/lib/advisor/schema.ts` (an optional structured contact offer on the answer payload), `apps/haven/src/app/advisor/AdvisorWorkspace.tsx` (renders the button and its sent state).
- **Firms:** a new lookup for the current user's firm membership in `apps/haven/src/lib/firms/`; a new server action for creating a contact request; the leads table (`apps/haven/src/app/firm/LeadsTableWithFilters.tsx`) and client views gain the marker, filter, and "mark handled".
- **Database:** one new migration adding a contact-requests table scoped to firm and client, with row-level security so lawyers read only their own firm's requests and clients create only their own.
- **Evals:** `apps/haven/evals/advisor/attorney-handoff.check.ts` gains firm-client cases. A new contact-request check covers what is and isn't shared, firm isolation, and that urgency and stage stay unchanged. Starter cases N03 and N04 from `docs/advisor-chatbot/advisor-eval-plan-2026-10-23.md` join the golden set.
- **Privacy:** no advisor conversation content reaches the firm. Only the fields listed above, and only when the user asks.

# Proposal

## Why

The firm dashboard lists clients newest first, so a lawyer can't see which
ones need them before a date runs out. Haven also doesn't collect the dates
that decide urgency: when someone's status ends, when their job ended, or
a deadline from USCIS. Those come up only in the chat, which the lawyer
never sees.

## What Changes

- **A new setup step, "Your deadlines".** Four optional questions:
  - when the client's current status ends (or "not sure")
  - whether their job has ended or is about to, and the last day of work
  - any deadline from USCIS or a consulate (none, request for evidence,
    interview, biometrics, or other) and its date
  - any upcoming travel outside the US, and its date

  The answers go into the firm's shared copy like the other setup answers,
  so the chat can't change them. Finishing setup now happens on this step.
- **A one-time prompt for clients who already finished setup.** On their
  next sign-in they're asked the same questions once and can skip.
- **Rule-based urgency ranking on the firm dashboard.** Clients are sorted
  by the soonest date that matters:
  - **URGENT:** a deadline or travel within 14 days, a grace period
    ending within 15 days, a status ending within 30 days, or anything
    already past
  - **SOON:** anything within 90 days
  - **LATER:** dates further out
  - **UNKNOWN:** no dates given, sorted last and marked "ask about
    deadlines"

  The grace period is the standard 60 days after the last day of work.
- **A one-line reason on every client,** for example "Laid off Sep 10,
  grace period ends Nov 9 (18 days)", plus the dates on the client page
  and a note that this is a heads-up from the client's own answers, not a
  legal calculation.
- **The dashboard's order changes.** The firm dashboard plan lists clients
  newest first. That becomes urgency first, then newest. The New badge
  stays.

Out of scope for now: AI or model-based scoring, filling in dates from
uploaded documents, firm-specific cutoffs, and alerts by email.

## Capabilities

### New Capabilities

- `intake-deadlines`: the deadline questions in setup, the one-time prompt
  for clients who already finished, and how the answers are shared with
  the firm.
- `lead-urgency-ranking`: how the firm dashboard turns those answers into
  a tier, an order and a reason, and what the lawyer sees.

### Modified Capabilities

None in `openspec/specs/`, which is empty. This change replaces the
"newest first" order in the `firm-dashboard` requirement from the
unarchived change `add-firm-dashboard`. If that change is archived first,
the ordering should become a MODIFIED requirement on `firm-dashboard`
instead.

## Impact

- **Setup:** a fifth step in the onboarding flow, and completion moves
  from step 4 to step 5. Saving and validation are extended to cover the
  new answers.
- **Data:** the new answers are stored for the client and copied into
  `firm_clients.shared_answers`. A new marker records that an existing
  client has seen the one-time prompt.
- **Sign-in:** finished clients who haven't seen the prompt are sent to it
  once.
- **Firm dashboard:** the client list is ranked and gains a tier and a
  reason column. The client page shows the deadline answers.
- **Checks:** a deterministic check covers every tier boundary, past
  dates, missing dates and the reason text. Firm isolation checks stay as
  they are.

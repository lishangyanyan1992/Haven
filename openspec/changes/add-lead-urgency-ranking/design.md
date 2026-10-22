# Design

## Context

See proposal.md for why. What exists today:

- **Setup** is four steps in `src/app/onboarding/OnboardingFlow.tsx`. The
  page's `saveStepAction` (`src/app/onboarding/page.tsx`) auto-saves each
  step, and step 4 with `_complete=true` finishes setup. Finishing writes
  the `email_aliases` row, `markFirmClientCompleted` and the firm's shared
  copy. Progress is kept in localStorage, and several places assume
  `step <= 4`.
- **The firm's shared copy** is `firm_clients.shared_answers`. Only setup
  and settings write it, via `recordFirmSharedAnswers(userId, draft,
  form)`, which sets the fields the form sent with a value and removes the
  ones it sent empty. `check:firm-intake` fails if the chat ever calls it.
- **The dashboard** (`src/app/firm/page.tsx`, `src/lib/firms/clients.ts`)
  reads only `shared_answers`, sorts newest first, and computes status in
  `src/lib/firms/status.ts`.
- **Sign-in** routes through `resolvePostAuthRedirect`, which sends
  unfinished clients to onboarding and finished ones home.
- `user_profiles.current_visa_expiry_date` exists, but the chat can write
  it (profile updates), so it isn't used here.

## Goals / Non-Goals

**Goals:**
- The ranking is a pure, deterministic function of the shared answers and
  today's date, fully covered by a check.
- One form component serves both setup step 5 and the one-time prompt.

**Non-Goals:**
- Reading dates from uploaded documents.
- Changing anything the chat can see or do.
- Time zones per firm. Day counts use calendar days in UTC.

## Decisions

### Deadline answers: shared-copy keys plus a client-owned column

The answers are stored in two places:

- **The firm's copy:** new keys in `firm_clients.shared_answers`, written
  through the existing `recordFirmSharedAnswers` path. That keeps the
  "only setup writes it" guarantee for free.
- **The client's own copy:** a new `user_profiles.deadline_answers jsonb`
  column, so a client's own setup and prompt show what they entered.
  Nothing in the chat code writes it.

```
statusEndDate        YYYY-MM-DD  | absent
statusEndUnknown     "yes"       | absent
jobEnded             "yes" | "no"| absent
lastWorkDay          YYYY-MM-DD  (only when jobEnded = yes)
agencyDeadlineType   "rfe" | "interview" | "biometrics" | "other" | absent
agencyDeadlineDate   YYYY-MM-DD  (only with a type)
travelPlanned        "yes" | "no"| absent
travelDate           YYYY-MM-DD  (only when travelPlanned = yes)
```

When a "yes" turns into "no", the form sends the matching date field empty,
so the existing merge rule removes the old date.

*Alternative considered:* reusing `current_visa_expiry_date` and
`layoff_events`. Rejected because the chat writes those, and the firm must
see only what the client entered in setup.

### Ranking is a pure function

`src/lib/firms/urgency.ts` exports
`rankUrgency(answers, today) -> { tier, daysLeft, reason, events }`:

```
events = [
  status end         (statusEndDate)
  grace period end   (lastWorkDay + 60 days)
  agency deadline    (agencyDeadlineDate, labelled by type)
  travel             (travelDate)
]
URGENT  if any event <= its urgent cutoff, or any event is past
           agency / travel <= 14, grace <= 15, status <= 30
SOON    if any event <= 90
LATER   if any event at all
UNKNOWN otherwise
reason  = the soonest event, e.g.
          "Laid off Sep 10, grace period ends Nov 9 (18 days)"
          "RFE response due Nov 3 (12 days)"
          "Status ended Oct 17 (5 days ago)"
```

It takes no database or network access, so `check:lead-urgency` can cover
every boundary with fixed dates. The sort key is `(tier order, daysLeft,
-created)`, and "email sent" rows always go last.

*Alternative considered:* an AI score. Rejected in discussion: it can't
explain itself the same way twice, it costs money per lead, and lawyers
need the reason.

### Setup gets a fifth step; completion moves to it

- Add `Step5Form` ("Your deadlines") and a `steps[4]` entry, then raise
  every `<= 4` bound to the number of steps.
- Completion becomes `step === 5 && _complete`. Step 4 now only auto-saves.
- localStorage progress saved at step 4 resumes at step 4 and moves on to
  5. Nothing is lost.
- Add `onboardingStepFiveSchema`. Every field is optional, dates must be
  real `YYYY-MM-DD` values within 10 years, and a date without its
  "yes" or type is dropped.

### One-time prompt for clients who finished earlier

- A new page, `/onboarding/deadlines`, reuses `Step5Form` with "Save" and
  "Skip for now".
- New column `user_profiles.deadlines_prompted_at`. It's set by finishing
  setup through step 5, by saving the prompt, and by skipping it.
- `resolvePostAuthRedirect`: a finished client (has `email_aliases`) with
  no `deadlines_prompted_at` goes to `/onboarding/deadlines` instead of
  home. Lawyers never reach this, because sign-in sends them to `/firm`
  first.

### Dashboard and client page

- `listFirmClients` adds `urgency` to each row from `rankUrgency`, and
  sorts by it.
- The client list gains a Priority column (tier chip) and a Why column
  (the reason), with the heads-up note above the table.
- The client page gains a Deadlines group showing the raw answers.

## Risks / Trade-offs

- [Clients guess or mistype dates] → Tiers reflect what the client entered,
  and the note says so. Lawyers see the raw dates on the client page.
- [A 60-day grace period isn't right for every case] → It's labelled a
  heads-up, not a legal calculation. Lawyers know the exceptions.
- [Moving completion to step 5 changes when clients count as Finished] →
  Clients mid-setup simply have one more step. Already-finished clients
  keep their state, and the prompt doesn't change it.
- [UTC day counts can be off by one near midnight] → Acceptable for a
  heads-up. The check pins the boundaries.

## Migration Plan

1. Migration: add `user_profiles.deadline_answers jsonb` and
   `deadlines_prompted_at timestamptz`. It only adds columns.
2. Deploy. Already-finished clients see the prompt once on their next
   sign-in.

**Rollback:** revert the code. The columns can stay.

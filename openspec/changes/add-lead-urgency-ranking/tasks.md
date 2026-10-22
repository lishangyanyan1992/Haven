# Tasks

## 1. Database

- [ ] 1.1 Add migration `0036_deadline_answers.sql` with `user_profiles.deadline_answers jsonb not null default '{}'` and `user_profiles.deadlines_prompted_at timestamptz`. Verify `db push --dry-run` lists only this migration, then apply it and check that both columns exist and existing rows have an empty object and a null.

## 2. Ranking rules

- [ ] 2.1 Add `src/lib/firms/urgency.ts` with `rankUrgency(answers, today)`, which returns the tier, days left, events and reason, plus a sort helper, as in design.md. Add the new deadline keys to `SHARED_ANSWER_KEYS` in `src/lib/firms/answers.ts`. Add `evals/firms/urgency.check.ts` covering:
  - every cutoff at and one day past its boundary (14 / 15 / 30 / 90)
  - past dates, no dates, "not sure", and job not ended
  - several dates, where the soonest wins
  - the exact reason text for each kind of date
  - sort order across tiers, and email-sent rows last

  Add it as `check:lead-urgency` and to `check:firms`, and verify it passes.
- [ ] 2.2 Extend `check:firm-isolation` so it fails if `urgency.ts` imports the database or anything outside `src/lib/firms`, keeping the ranking a pure function of the shared answers. Verify it passes, and that it fails against an example that imports the admin client.

## 3. Setup step 5

- [ ] 3.1 Add `onboardingStepFiveSchema` (all optional, real dates within 10 years, dates dropped without their yes or type) and a `Step5Form` component, "Your deadlines", with the four questions and dates shown only once the matching answer applies. Verify `npm run typecheck` passes.
- [ ] 3.2 Add step 5 to the onboarding flow: the `steps` entry, raising every `<= 4` bound, moving completion to step 5, saving step-5 answers to `user_profiles.deadline_answers` and the firm's copy through `recordFirmSharedAnswers`, and setting `deadlines_prompted_at` on completion. Verify in the browser with a test firm client that step 4 now continues to step 5, skipping every question still finishes setup, and dates entered appear in `shared_answers`. Also check that switching travel from yes to no removes the stored travel date.

## 4. One-time prompt

- [ ] 4.1 Add `/onboarding/deadlines`, which reuses `Step5Form` with "Save" and "Skip for now". Both set `deadlines_prompted_at`, and Save also stores the answers like step 5 does. Send finished clients without `deadlines_prompted_at` there from `resolvePostAuthRedirect`. Verify in the browser that a test client who finished before (no marker) sees the prompt at sign-in, that skipping goes to the chat, and that the next sign-in goes straight to the chat.

## 5. Dashboard

- [ ] 5.1 Have `listFirmClients` return `urgency` per client and sort by the urgency sort helper. Add the Priority and Why columns and the heads-up note to `/firm`. Verify in the browser with test clients in each tier that the order and reasons match `rankUrgency`, that email-sent clients come last, and that the New badge still works.
- [ ] 5.2 Add a Deadlines group to the client page showing each answer in plain words, with "Not provided" for gaps. Verify in the browser for a client with a status end date and a travel date.

## 6. Release checks

- [ ] 6.1 Run `npm run typecheck`, `npm run check:firms` and `npm run check:advisor`, and verify all pass. Run Greptile on the pull request until it scores 5/5 with no open findings.
- [ ] 6.2 Run the evidence recording for the new step, the prompt and the ranked dashboard, then delete all test firms and accounts.

## Workflow follow-up

- Archive `add-firm-dashboard` and this change once both are live and checked.

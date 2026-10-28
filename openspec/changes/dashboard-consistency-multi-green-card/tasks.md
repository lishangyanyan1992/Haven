# Tasks

## 1. Petition reading and matching

- [x] 1.1 Add `lib/petitions.ts` with `normalizePetitions` (maps `petitionKind`→`petitionType` and `category`→`preferenceCategory`, maps withdrawn to ended with a reason, adds `endedReason`/`endedDate`, drops records with no sponsor). Verify: new `evals/dashboard/petitions.check.ts` passes on a fixture copied from the test person's saved petitions plus a legacy-withdrawn record.
- [x] 1.2 Add `sponsorMatches` (ignores case, punctuation and text in parentheses; also accepts one name containing the other). Verify: the check covers "Harbor Ventures" vs "Harbor Ventures (Lakeside Insurance)" (match) and "Acme Insurance Co" vs "Acme Insurance Group" (no match).
- [x] 1.3 Add `validatePetition` (date order, approved stage needs an approval date, own priority date before PERM needs the carried-over flag). Verify: the check has one failing case per rule and one valid case.
- [x] 1.4 Rewrite `findActivePetition` and `resolveEffectivePriorityDate` to use normalized petitions: ended petitions never set the stage, and the effective date is the earliest approved I-140, then the retained date, then the profile field. Verify: the two-employer fixture gives stage "I-140 approved", priority date 2021-06-14, source Northwind Mutual. With Harbor Ventures marked active, the priority date is unchanged.

## 2. One profile reader

- [x] 2.1 Move `mapProfileRow` into `lib/profile-mapper.ts` and use it from both `lib/repositories/supabase-case-compass.ts` and `lib/profile-sync.ts`, always normalizing petitions. Verify: `npm run typecheck`, and a check that a row containing petitions, the retained date and the category round-trips with no field lost.

## 3. One resolver, live values first

- [x] 3.1 Add `lib/dashboard-facts.ts` with pure `resolveDashboardFacts` returning stage, effective priority date with its source, protection, readiness, wait estimate, status end date and `conflicts[]`. Verify: unit check on the two-employer fixture and two single-employer fixtures.
- [x] 3.2 Make `computeDerivedSignals` (`lib/haven.ts`) and `buildImmigrationJourney` take protection, readiness and stage from `resolveDashboardFacts` instead of computing them. Verify: grep shows no remaining reads of `profile.i140Approved` for protection or readiness outside the resolver, and the existing timeline and journey checks still pass.
- [x] 3.3 Flip `mapDerivedSignals` to live first; use a stored value only when the live value can't be computed. Verify: a check where the stored row says "Available after Sep 21, 2026" and today is later shows protection as unlocked.
- [x] 3.4 Have `getPriorityDateIntelligence` use the effective priority date and category, and show the priority date section when an effective date exists. Verify: a fixture with a retained date and an empty `priority_date` gets a wait estimate and the section is shown.
- [x] 3.5 Recompute and upsert `derived_signals` from the full profile on every save path (`persistProfileDraft`, `saveDeadlineAnswers`, petition saves). Verify: after a test save, the stored protection matches the live value.

## 4. Conflict checks

- [x] 4.1 Add `lib/dashboard-consistency.ts` with one rule per spec contradiction (I-140 flag vs petitions, PERM stage vs current petition, priority date before PERM, petition still active after layoff, approval before PERM filing, status end before layoff date), each returning `{ id, message, fields, fixHref, quickFix? }`. Verify: `evals/dashboard/consistency.check.ts` covers each rule plus an all-clear fixture.
- [x] 4.2 Add a cross-surface check that builds the overview, green card track, planner summary and advisor context from the same fixture and asserts stage, priority date, sponsor and protection match. Verify: it passes for the two-employer fixture and fails if any surface is stubbed with a different value.
- [x] 4.3 Register the new checks as `check:dashboard` in `apps/haven/package.json` and add them to CI next to the existing checks. Verify: `npm run check:dashboard` passes locally and appears in the CI run.

## 5. Dashboard display

- [x] 5.1 Change `GreenCardJourneyTrack` to hold `tracks: PetitionTrack[]` (each with its own nodes, a tone of active/protected/ended, and a status line), with the shared priority date banner above the tracks. Verify: the journey check for the two-employer fixture yields two tracks, Northwind Mutual protected and Harbor Ventures ended "Ended at layoff, Oct 2026".
- [x] 5.2 Render one track per petition in `immigration-journey-dashboard.tsx`, fade ended tracks, and remove the "View petitions" list. With a single petition, the layout matches today's. Verify in the browser at desktop and phone widths, with a screenshot of the test person's dashboard.
- [x] 5.3 Show "Check this" notes (at most three, plus "Show all") with a link to the right settings field and an optional one-click fix. Verify in the browser: a fixture with a PERM-stage conflict shows the note, and the one-click "mark ended" fix updates the track.

## 6. Settings green card editor

- [x] 6.1 Add `savePetitionsAction`: requires a logged-in user, validates each petition, writes the normalized list through `mergeDeadlineAnswers`, keeps the raw list once as `immigrantPetitionsLegacy`, syncs the flat profile fields, recomputes signals, and revalidates the dashboard, settings and timeline. Verify: a server-action check for valid save, an invalid-date rejection, and confirmation that the legacy copy is kept.
- [x] 6.2 Add a "Green cards" section in settings to list, add, edit, end (reason and date) and remove petitions, with inline errors from `validatePetition`. Verify in the browser: add a petition, end it, remove it; the dashboard updates after each step.
- [x] 6.3 Share the green card list with the client's law firm: write one plain line per petition (through `normalizePetitions`) into `firm_clients.shared_answers.greenCards` when petitions are saved and when a client joins a firm, and show it on the firm client view. Verify: `check:firm-green-cards` shows both petitions with correct type, category and ended state for the two-employer fixture.

## 7. Final check

- [ ] 7.1 Run `npm run typecheck`, `npm run check:dashboard` and the existing journey and firm checks; open the two-employer test person's dashboard in the browser and confirm no conflicting values and both green card tracks. Verify: all commands pass and a screenshot is attached to the PR.

## Workflow follow-up

- After merge, real accounts with a green card still marked in progress after a layoff will see a "Check this" note; confirm or fix it there or in settings.
- Archive this change together with `multi-employer-green-card`, so `green-card-petitions` supersedes its multi-petition presentation requirement.

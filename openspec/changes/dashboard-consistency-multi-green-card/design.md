# Design

## Context

What the code does today:

- The dashboard (`app/dashboard/page.tsx`) combines six inputs: the profile row, the `deadline_answers` JSON (which also holds petitions, the retained priority date and sponsor names), the stored `derived_signals` row, crisis state, visa bulletin data, and documents.
- **Two profile readers.** `mapProfileRow` exists in both `lib/repositories/supabase-case-compass.ts` and `lib/profile-sync.ts`. The profile-sync copy drops `retainedPriorityDate`, `retainedPriorityDateCategory` and `immigrantPetitions`. `persistDerivedSignals` computes from that incomplete profile, so the stored results ignore earlier-employer protections.
- **Two calculators.** `computeDerivedSignals` (`lib/haven.ts`) decides job-change protection and readiness from the single `i140Approved` flag. `buildImmigrationJourney` (`lib/immigration-journey.ts`) decides the same things from petitions and the retained priority date.
- **Stored beats live.** In `mapDerivedSignals`, the stored `ac21_portability_status`, `h1b_cap_date`, `layoff_readiness_score` and `layoff_readiness_reasoning` take priority over live values. A real stored row was seven months old and still said protection was "available after" a date that had already passed.
- **Field names don't match.** Saved petitions in production use `petitionKind` and `category`; the code reads `petitionType` and `preferenceCategory`. `findActivePetition` therefore matches no employer petition and falls back to the first record. That only happens to give the right answer when the first record is the one that matters.
- **Exact name matching.** `findActivePetition` compares sponsor and employer names exactly, so "Harbor Ventures (Lakeside Insurance)" never matches "Harbor Ventures".
- **No way to enter petitions.** Settings and onboarding only collect `greenCardSponsor` and `retainedPriorityDateSponsor`. Petitions exist only when written directly to the database.
- **One track shown.** The green card track renders the nodes for one active petition. The rest are in a collapsed "View petitions & sponsors" list.
- The priority date section depends on `profile.i140Approved`, and `getPriorityDateIntelligence` uses only `profile.priorityDate`.

## Goals / Non-Goals

**Goals:**
- A single function produces every resolved dashboard fact. All surfaces read its output.
- Petitions are normalized in one place and are the source of truth for green card stage and priority date.
- Contradictions are detected by pure, testable code and shown, never silently resolved.

**Non-Goals:**
- No new database table or migration. Petitions stay in `deadline_answers.immigrantPetitions`.
- No change to the legal rules themselves (180-day rule, AC21, grace period). This change only makes every surface use the existing rules the same way.
- The firm (lawyer) dashboard keeps its own layout. It only switches to the shared petition reader.
- No automatic edits to user data based on a conflict. The user always confirms.

## Decisions

### 1. One resolver: `resolveDashboardFacts(input)`
Add `lib/dashboard-facts.ts`, exporting a pure function. It takes the normalized profile, petitions, deadlines, crisis state and bulletin data and returns `DashboardFacts`: stage, effective priority date (with source petition), protection status, readiness, wait estimate, status end date, and `conflicts[]`. `computeDerivedSignals` and `buildImmigrationJourney` both call it instead of deciding these facts themselves.
- *Alternative:* fix each calculator separately. Rejected: the two would drift again.

### 2. Stored signals become a write-through cache
`mapDerivedSignals` flips to live-first. A stored value is used only when the live value can't be computed (for example, the bulletin feed is down for the wait estimate). Every save path (`persistProfileDraft`, `saveDeadlineAnswers`, the new petition actions) recomputes and upserts `derived_signals` from the full profile.
- *Alternative:* stop storing signals at all. Rejected for now: firm views and email jobs read the stored row.

### 3. One profile reader
Move `mapProfileRow` into `lib/profile-mapper.ts`. Both the repository and profile-sync import it. It always runs petitions through `normalizePetitions`.

### 4. `lib/petitions.ts`: normalize, match, validate
- `normalizePetitions(raw)`: maps the older field names, fills `petitionType` from `petitionKind`, adds `endedReason` and `endedDate` (the existing `isWithdrawn` and `withdrawn` values map to ended with reason "withdrawn"), and drops records with no sponsor.
- `sponsorMatches(a, b)`: lowercases, strips text in parentheses and punctuation, and compares. A match means either name equals the other or one contains the other.
- `validatePetition(p)`: checks that dates are in order and stages are consistent. Used by the settings form and by the conflict checks.
- The active petition is the non-ended employer petition that matches the current employer (skipped when the user is laid off). Otherwise it is the first non-ended employer petition still in progress, then any non-ended employer petition, then any non-ended petition. Ended petitions never set the stage. This keeps the order the existing journey tests already rely on.
- The effective priority date is the earliest priority date among approved I-140s (ended or not), then the retained priority date, then the profile field.

### 5. `lib/dashboard-consistency.ts`: conflict rules
Each rule is a small pure function. It takes the normalized input and returns at most one `Conflict { id, message, fields[], fixHref, quickFix? }`. The rules listed in the spec ship first. `quickFix` covers safe one-click answers, such as "Mark Harbor Ventures ended on Oct 8, 2026". When there is a conflict, the resolver uses the petition record over the flat profile fields for stage, because petitions are more specific, and it always reports the conflict.

### 6. Rendering one track per petition
`GreenCardJourneyTrack` gains `tracks: PetitionTrack[]`, each with its own `nodes`, `tone` (`active | protected | ended`) and `statusLine`. The shared priority date banner moves above the tracks. With one petition, the layout matches today's single track. The collapsed petitions list is removed.

### 7. Settings "Green cards" editor
Add a client component in settings that lists petitions and has add, edit, end and remove. A server action `savePetitionsAction` validates every petition with `validatePetition`, writes the normalized list into `deadline_answers.immigrantPetitions` through `mergeDeadlineAnswers`, recomputes signals, and revalidates `/dashboard`, `/settings` and `/timeline`. The flat profile fields (`i140Approved`, `permStage`, `priorityDate`) are kept in sync from the active and approved petitions, so older readers stay correct.

## Risks / Trade-offs

- [Normalizing rewrites saved petitions] → The original raw list is kept under `deadline_answers.immigrantPetitionsLegacy` on first rewrite, so it can be restored.
- [Live-first could flip a value users have seen for months] → That's the point. The conflict notes explain the change when the flat fields and petitions disagree.
- [Loose name matching could match the wrong employer, for example "Insurance Co" vs "Insurance Group"] → Matching only links a petition to the current employer for choosing the active track. It never merges records. The tests include near-miss names.
- [Too many "Check this" notes would be noisy] → At most three are shown, ordered by how much they change the stage or deadlines. The rest are behind "Show all".
- [The firm view] → The firm view reads only the answers a client shares (`firm_clients.shared_answers`), never `user_profiles`. Decided by the owner: green cards are shared. Each save from the green card editor, and joining a firm, writes one plain line per petition into `shared_answers.greenCards`; the firm still never reads `user_profiles`, and chat never writes this copy.

## Migration Plan

1. Ship the normalizer and shared reader first. They are read-only, so stored data is untouched and existing dashboards should look the same or more correct.
2. Ship live-first signals and save-time refresh.
3. Ship per-petition tracks and conflict notes.
4. Ship the settings editor. The first save of a profile rewrites its petitions in the normalized shape.
5. Rollback: each step is a code-only revert. A rewritten petition list can be restored from `immigrantPetitionsLegacy`.

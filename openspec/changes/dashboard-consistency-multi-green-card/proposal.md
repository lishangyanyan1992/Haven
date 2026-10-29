# Proposal

## Why

The dashboard shows the same facts from several places that disagree. Saved results from months ago override fresh calculations. Two separate calculators decide job-change protection and layoff readiness. Profile fields and petition records describe the same green card differently. Multi-employer green cards were modeled in `multi-employer-green-card`, but saved petition records use different field names than the code reads, no screen lets a user add or edit them, and only one petition gets a milestone track. A user with an approved I-140 from one employer and an ended petition from another (for example: one employer's I-140 approved, and a second employer's green card that ended at a layoff) sees contradictory or missing information at the moment they most need it.

## What Changes

- **One source per fact.** Each fact the dashboard shows (green card stage, effective priority date, job-change protection, layoff readiness, wait estimate, status end date) is resolved once, from the user's current input, and every card reads that result.
- **Live calculations win over saved ones.** Stored `derived_signals` rows can no longer override a value computed from the current profile. Stored values are refreshed on every profile save and treated only as a cache.
- **One calculator.** The older calculator in `lib/haven.ts` stops deciding job-change protection and readiness on its own. It delegates to the same priority-date and protection logic the green card track uses.
- **One profile reader.** The two profile mappers (repository and profile-sync) are merged, so petitions, retained priority date and category are never dropped on save.
- **Petition records read correctly.** Saved petitions are normalized on read: legacy field names (`petitionKind`, `category`) are accepted, sponsor names match employers loosely (for example, "Harbor Ventures (Lakeside Insurance)" matches "Harbor Ventures"), and an ended petition is marked with a reason and date. **BREAKING** for stored data: petitions are rewritten in the new shape on the next save.
- **A milestone track per green card.** Each petition gets its own full track: active ones in full, approved ones as protected, ended ones faded with the reason ("ended at layoff, Oct 2026"). The shared priority date is shown once, above the tracks.
- **Add and edit green cards.** Settings gets a "Green cards" section to add, edit and end petitions (sponsor, category, stage, key dates).
- **Conflict checks.** A consistency check runs whenever the dashboard is built. It catches contradictions (for example: profile says I-140 approved but no petition is approved; a petition has a priority date before PERM is filed; the current employer's petition is still active after a layoff) and shows a plain "Check this" note asking the user to confirm, instead of quietly picking one answer.
- **Priority date section** shows whenever any petition gives the user a priority date, not only when the single "I-140 approved" field is on.

## Capabilities

### New Capabilities
- `dashboard-data-consistency`: How dashboard facts are resolved from user input, which source wins, how stored results are refreshed, and how contradictions are detected and shown.
- `green-card-petitions`: How a user's green card petitions are stored, entered, normalized, ended, and shown as separate milestone tracks.

### Modified Capabilities
None. The overlapping `multi-employer-green-card` change has not been archived to `openspec/specs/` yet. Its "Green Card Track Multi-Petition Presentation" requirement is superseded by `green-card-petitions` once both are archived.

## Impact

- `apps/haven/src/lib/haven.ts` (`computeDerivedSignals`): delegates protection and readiness to shared logic.
- `apps/haven/src/lib/immigration-journey.ts`: `findActivePetition`, `resolveEffectivePriorityDate`, green card track now produces one track per petition.
- `apps/haven/src/lib/repositories/supabase-case-compass.ts` and `apps/haven/src/lib/profile-sync.ts`: a single profile reader; `mapDerivedSignals` precedence flipped to live-first.
- New `apps/haven/src/lib/petitions.ts` (normalize, match, validate) and `apps/haven/src/lib/dashboard-consistency.ts` (conflict checks).
- `apps/haven/src/app/dashboard/page.tsx`, `apps/haven/src/components/app/immigration-journey-dashboard.tsx`: per-petition tracks, conflict notes, priority date section condition.
- `apps/haven/src/app/settings/page.tsx`, `apps/haven/src/server/actions.ts`: green card add/edit/end.
- Firm client view (`apps/haven/src/app/firm/clients/[id]/page.tsx`) shows the client's green card list, shared through `firm_clients.shared_answers.greenCards`.
- Data: `user_profiles.deadline_answers.immigrantPetitions` is rewritten to the normalized shape; no new table.
- Tests in `apps/haven/evals/`: new consistency and petition checks, including a fictional two-employer fixture with the same shape as a real case.

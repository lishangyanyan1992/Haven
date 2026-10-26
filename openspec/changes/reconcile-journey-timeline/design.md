# Design

## Context

The current `buildImmigrationJourney()` function calculates visa validity and employment status independently. When an H-1B holder is laid off, `jobLifecycle` becomes `grace_period` with a 60-day window (`lastWorkDay + 60 days`), while `visaLifecycle` continues tracking the original petition expiration date. If the petition expires before the 60th day, the user sees conflicting countdowns. Furthermore, the single-axis `OverlaySwimlane` plots pins across a multi-year range, which crowds immediate events into a single pixel clump.

## Goals / Non-Goals

**Goals:**
- Provide a single reconciliation engine in `immigration-journey.ts` that enforces 8 CFR 214.1(l)(2): `effectiveStayEnd = min(graceEndDate, visaExpiryDate)`.
- Reconcile status badges, summaries, and countdowns across both Visa and Job tracks so no contradictory dates appear.
- Introduce a dual-resolution timeline view: Macro Horizon (multi-year) plus an always-visible Tactical 90-Day Window (spanning 45 days past to 45 days forward from today).
- Replace loose wrapped milestone pills with three structured summary cards (`Visa · H-1B`, `Job & Sponsor`, `Green Card · EB-2 China`) matching the card design of the engagement pipeline and permanent residency stages.

**Non-Goals:**
- Modifying underlying database schemas: reconciliation is calculated deterministically from existing profile dates.
- Changing USCIS legal definitions or supporting non-standard visa categories outside the existing profile model.

## Decisions

### 1. Calculation of Effective Authorized Stay
- **Decision**: In `buildImmigrationJourney()`, calculate `effectiveStayEnd = min(graceEndDate, visaExpiryDate)` whenever `isLaidOff` is true and both dates exist.
- **Rationale**: Reflects 8 CFR 214.1(l)(2) accurately. If `visaExpiryDate < graceEndDate`, mark `isGraceCappedByVisa = true`, set the remaining days based on `visaExpiryDate`, and append an explicit note explaining the cap.
- **Alternative considered**: Showing both dates independently with an alert box. Rejected because having two different countdown headers ("Expires in 3 days" vs "42 days left") causes immediate confusion for users facing layoffs.

### 2. Dual-Resolution Timeline Layout
- **Decision**: Render two synchronized timeline sections:
  1. **Macro Horizon**: Retains the 3 swimlanes across the full multi-year span (e.g., 2018–2028) with a visual bracket highlighting the 90-day focus zone.
  2. **Tactical 90-Day Window**: Renders directly below the macro timeline, spanning `[today - 45 days, today + 45 days]`. Plots immediate events (last day of work, today, visa expiration, interviews, grace period end) with ample horizontal breathing room and clear leader lines.
- **Rationale**: Multi-year context is necessary for green card queue tracking, but urgent day-to-day decisions need high temporal resolution without dot collisions.
- **Alternative considered**: Toggle between "90-day view" and "Full view". Rejected because the user wants both perspectives simultaneously without having to flip tabs.

### 3. Reconciled Track Summary Cards
- **Decision**: Replace `pins.map(...)` wrapped pills with three structured cards below the timelines:
  - **Visa Track Card**: Reconciled status badge, effective stay deadline, I-94 expiration, and change of status or extension action.
  - **Job Track Card**: Employment status, last day of work, grace period cap details, scheduled interviews, and severance/I-9 review action.
  - **Green Card Track Card**: Priority date, category queue, AC21 portability status, and official Visa Bulletin action.
- **Rationale**: Matches the 3-card horizontal grid pattern established for the Firm Engagement and Permanent Residency stages, creating a consistent visual language across the Case dashboard.

## Risks / Trade-offs

- **[Risk] Users with incomplete dates** → When dates are missing (e.g., no last day of work recorded), graceful fallbacks prompt the user to input the date rather than calculating false grace period truncations.
- **[Risk] Narrow mobile screens on Tactical Window** → Implement horizontal scroll snapping (`overflow-x-auto` with `min-w-[500px]`) for the tactical timeline on mobile viewports so pin labels never overlap.

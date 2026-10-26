# Tasks

## 1. Reconciliation Engine in Domain Logic

- [x] 1.1 Implement legal grace period truncation rule `effectiveStayEnd = min(graceEndDate, visaExpiryDate)` in `apps/haven/src/lib/immigration-journey.ts` and verify with unit tests
- [x] 1.2 Reconcile Visa Track and Job Track status badges, countdowns, and summaries when employment terminates so no contradictory dates appear
- [x] 1.3 Add AC21 portability and I-140 bridge protection callout data to `buildImmigrationJourney()` return payload and verify output structure
- [x] 1.4 Compute tactical 90-day window metrics (`tacticalStartMs`, `tacticalEndMs`, filtered pins, and relative positions) in `buildImmigrationJourney()`

## 2. Dual-Resolution Timeline Presentation

- [x] 2.1 Update Macro Horizon swimlanes to remove loose pill wrapping and render a visual 90-day focus bracket around the active window
- [x] 2.2 Build the `TacticalTimelineWindow` component rendering immediate milestones across 90 days with dedicated leader lines, dates, and days-remaining counters
- [x] 2.3 Ensure responsive mobile horizontal scrolling with scroll snap for the tactical timeline on narrow viewports

## 3. Reconciled Track Summary Cards

- [x] 3.1 Create three structured track summary cards (`Visa · H-1B`, `Job & Sponsor`, `Green Card · EB-2 China`) matching the 3-in-view layout
- [x] 3.2 Add explicit reconciliation warning text when an I-94 caps the 60-day grace period
- [x] 3.3 Add actionable CTAs to each track card (e.g., check Visa Bulletin, upload records, file change of status)

## 4. Verification and Safety Tests

- [x] 4.1 Add test cases to `apps/haven/evals/firms/case-dashboard.check.ts` verifying date reconciliation and grace period truncation
- [x] 4.2 Run `npm run typecheck:haven` and `npm run check:firms` to verify complete type safety and isolation compliance

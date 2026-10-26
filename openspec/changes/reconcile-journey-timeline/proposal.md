# Proposal

## Why

The current immigration journey timeline displays separate Visa, Job, and Green Card tracks that can display contradictory legal dates. When an H-1B worker experiences a layoff, their authorized stay is legally capped by the shorter of their 60-day grace period or their approved petition expiration date under 8 CFR 214.1(l)(2), yet the timeline currently shows conflicting dates (e.g., visa expiring in 3 days while job grace period shows 42 days remaining). Furthermore, stretching 10 years across a single horizontal bar squeezes critical short-term deadlines into an unreadable cluster of overlapping pins and detached pills. 

Users need a reconciled timeline that mathematically reconciles employment end dates with visa validity, pair a macro multi-year horizon with a tactical 90-day countdown, and replaces wrapped pills with structured track cards.

## What Changes

- **Automatic Legal Date Reconciliation**: Reconcile H-1B status and 60-day grace periods using the regulatory rule `effectiveDeadline = min(lastWorkDay + 60 days, visaExpiryDate)`. If an I-94 expiration date is earlier than day 60, truncate the grace period and surface a clear notice explaining that the I-94 caps authorized stay. If employment ends, switch the Visa track headline from active status to grace period status.
- **Dual-Resolution Timeline Presentation**:
  - **Macro Horizon (Multi-Year Trajectory)**: High-level view spanning from initial visa start through projected green card approval, displaying overall progress without dense pin clutter.
  - **Tactical 90-Day Zoom Window**: Dedicated countdown window focusing on the 90 days around the current date (45 days past, 45 days forward), providing generous spacing for immediate milestones (last work day, interviews, filing deadlines, grace end).
- **Structured Track Cards**: Replace loose wrapping milestone pills beneath the timeline with three organized cards (`Visa · H-1B`, `Job & Sponsor`, `Green Card`) matching the visual hierarchy of the engagement pipeline and permanent residency stages.
- **Cross-Track Protection Callouts**: Highlight how green card milestones (such as an approved I-140) protect employment portability and unlock AC21 extensions during a layoff window.

## Capabilities

### New Capabilities
- `immigration-journey-timeline`: Defines requirements for multi-track timeline reconciliation, legal grace period truncation, dual-resolution macro and tactical zoom rendering, and structured journey track cards.

### Modified Capabilities
None.

## Impact

- `apps/haven/src/lib/immigration-journey.ts`: Update `buildImmigrationJourney()` to implement legal truncation, reconciled status messaging, and tactical 90-day window metrics.
- `apps/haven/src/components/app/immigration-journey-dashboard.tsx`: Replace loose milestone pills with the dual-resolution timeline view and three structured summary cards.
- `apps/haven/evals/firms/case-dashboard.check.ts`: Add test cases verifying legal date reconciliation and tactical window calculation.

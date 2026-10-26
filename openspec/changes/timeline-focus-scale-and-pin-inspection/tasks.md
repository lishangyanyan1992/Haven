# Tasks

## 1. Focus-Expanded Timeline Scale Engine

- [x] 1.1 Implement the piecewise monotonic focus projection function in `apps/haven/src/lib/immigration-journey.ts` allocating 40% to 45% of visual bar width to the immediate focus zone (`todayMs - 90d` to `todayMs + 180d`), and verify monotonic ordering.
- [x] 1.2 Update macro timeline tick generation to place ticks at logical piecewise boundaries (timeline start, focus start, today anchor, focus end, future horizon) and verify clean label formatting.
- [x] 1.3 Add eval tests in `apps/haven/evals/firms/case-dashboard.check.ts` asserting strict monotonicity, expanded focus zone width, and non-colliding immediate pins.

## 2. Interactive Pin Inspection & Bi-Directional Highlighting

- [x] 2.1 Convert pin dots in `OverlaySwimlane` and `TacticalTimelineWindow` into interactive `<button>` triggers with distinct active inspection rings and hover states in `apps/haven/src/components/app/immigration-journey-dashboard.tsx`.
- [x] 2.2 Implement the floating inspection popover component anchored to the active pin displaying milestone title, formatted date, relative days countdown pill, tone, and legal details with viewport edge clamping.
- [x] 2.3 Connect bi-directional highlighting between timeline pins and immediate milestone sequence cards, ensuring clicking either element highlights its counterpart with smooth scrolling.
- [x] 2.4 Add keyboard navigation (Tab, Enter/Space to inspect, Escape to close) and click-outside dismissal for active pin popovers.

## 3. Verification & Visual Review

- [x] 3.1 Run full typecheck and evals (`npm run typecheck:haven` and `npm run check:firms`) and verify 100% pass rate.
- [x] 3.2 Capture visual before and after screenshots of the expanded focus timeline and active pin inspection popover using the `/before-and-after` workflow.

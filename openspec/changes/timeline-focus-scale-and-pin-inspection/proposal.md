# Proposal

## Why

Foreign workers managing dual visa and green card journeys often have timelines spanning 6 to 10 years across historical status changes, active employer sponsorship, and multi-year priority date backlogs. On a strictly linear time axis, the most critical window—the immediate present encompassing today, 60-day grace periods, imminent I-94 expirations, upcoming agency deadlines, and next-stage filings—is compressed into a tiny 2% to 4% sliver of the bar, causing pin collisions and obscuring urgent deadlines.

Additionally, the dots on the timeline currently enlarge slightly on hover but do not provide immediate identification or interactive feedback. Users cannot readily tell what time points they represent, and clicking a dot does not reveal an obvious popup or highlight the corresponding milestone detail card. Making the timeline focus-scaled around the active window and providing instant interactive pin inspection solves these usability bottlenecks.

## What Changes

- **Focus-Expanded Macro Timeline Scale**: Replace purely linear timestamp-to-percentage mapping with a focus-weighted scale that allocates a generous portion (40% to 45%) of visual timeline width to the immediate focus window (the active operational horizon around today, grace periods, and upcoming deadlines), while compressing distant past history and multi-year future queues into proportional outer flanks.
- **Interactive Pin Inspection Popovers**: Upgrade timeline dots on both macro swimlanes and the tactical ruler into interactive buttons. Clicking any dot instantly displays an obvious, high-contrast inspection popover showing the milestone title, date, relative days countdown (`3d left`, `in 12d`, `45d ago`), status tone, and legal guidance.
- **Bi-Directional Card Highlighting**: When a timeline dot is clicked, the corresponding milestone card in the immediate sequence grid (or the relevant stage node) is highlighted with an active focus ring, accent border, and smooth scroll into view. Clicking a milestone card similarly highlights its pin on the timeline.
- **Active Pin State & Accessibility**: Add clear selected visual states (enlarged anchor dot, contrast outline ring, elevation) to inspected pins, with keyboard accessibility (Tab, Enter/Space to inspect, Escape to dismiss) and click-outside dismissal.

## Capabilities

### New Capabilities
- `immigration-journey-timeline`: Interactive milestone inspection, bi-directional pin-to-card highlighting, and focus-expanded timeline scaling for the immigration journey dashboard.

### Modified Capabilities
*(None; no existing spec requirements under `openspec/specs/` are being modified.)*

## Impact

- **Domain & Journey Engine**: `apps/haven/src/lib/immigration-journey.ts` introduces a monotonic focus-transfer function for `toPercent` that expands the immediate operational zone while preserving chronological ordering, and aligns axis ticks with the non-linear scale.
- **Dashboard UI Components**: `apps/haven/src/components/app/immigration-journey-dashboard.tsx` updates `OverlaySwimlane` and `TacticalTimelineWindow` with interactive pin buttons, floating inspection popovers, and synchronized active card highlighting.
- **Evals & Verification**: `apps/haven/evals/firms/case-dashboard.check.ts` adds assertions for focus scale monotonicity, focus-zone expansion ratio, and interactive pin metadata.

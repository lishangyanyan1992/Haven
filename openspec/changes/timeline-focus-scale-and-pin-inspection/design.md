# Design

## Context

See [proposal.md](./proposal.md) for background and motivation.

The immigration journey timeline currently visualizes milestones across two main views:
1. **Macro Overlaid Swimlanes** (`OverlaySwimlane`): Showing synchronized bar segments and pin dots across the Visa/Status track and the Green Card track.
2. **Tactical 90-Day Window** (`TacticalTimelineWindow`): Showing a ±45-day focused ruler line with Today centered at 50%, alongside a collision-free grid of sequential milestone cards.

Currently, the macro timeline calculates percentage positions through a single linear function:
```ts
toPercent = (ms: number) => ((ms - paddedStartMs) / totalSpanMs) * 100
```
For users with multi-year journeys (e.g. 2020 H-1B start to 2028 Green Card horizon), the 90-day focus zone occupies less than 4% of the bar width, causing critical upcoming deadlines (such as a 60-day grace period, 3-day I-94 cap, or agency RFE) to collide into indistinguishable dots. Furthermore, clicking a dot only triggers a CSS `:hover` scale effect with no popup or card correlation.

## Goals / Non-Goals

**Goals:**
- **Focus-Expanded Timeline Projection**: Design a monotonic, piecewise focus transfer function that allocates 40% to 45% of macro timeline width to the active focus window around today (e.g. -90 days to +180 days), while smoothly compressing distant past history (25% to 30%) and distant future backlogs (25% to 30%).
- **Interactive Pin Inspection Popovers**: Provide instant, accessible popovers on all timeline pins across both the macro swimlanes and tactical ruler, surfacing complete date, countdown, and legal status details.
- **Bi-Directional Highlighting**: Link timeline pins with the sequential milestone grid cards and stage nodes, so clicking either element highlights its counterpart with smooth scrolling.
- **Preserve Monotonic Ordering & Backward Compatibility**: Ensure that chronological order is strictly preserved, existing timeline tests and milestone structures remain compatible, and no dates invert.

**Non-Goals:**
- Arbitrary manual drag-and-drop zooming controls (the focus window is intelligently derived from profile signals, today, and active deadlines).
- External charting libraries (maintaining Haven's lightweight, dependency-free Tailwind/React rendering).

## Decisions

### 1. Piecewise Linear Focus Transfer Function
- **Choice**: Implement a 3-zone continuous piecewise linear projection in `apps/haven/src/lib/immigration-journey.ts`:
  1. **Past Era** `[minStartMs, focusStartMs]`: Mapped to `[4%, 28%]`.
  2. **Active Focus Window** `[focusStartMs, focusEndMs]`: Mapped to `[28%, 72%]`.
  3. **Future Era** `[focusEndMs, maxEndMs]`: Mapped to `[72%, 96%]`.
  Where `focusStartMs = Math.max(minStartMs, todayMs - 90 * DAY_MS)` and `focusEndMs = Math.min(maxEndMs, todayMs + 180 * DAY_MS)`.
  If the total span is under 270 days, fall back to standard linear mapping.
- **Rationale**: A piecewise linear transfer function guarantees strict monotonicity ($dP/dt > 0$) with zero date inversions, avoids transcendental math overhead, and provides predictable visual budgeting: exactly 44% of the bar is dedicated to the critical present.
- **Alternatives Considered**:
  - *Sigmoid / Logarithmic compression*: Produces varying non-linear distortion where interval widths change continuously across days, making tick marks difficult to interpret.
  - *Fish-eye lens on mouse hover*: Disorienting for mobile users and does not solve the static screenshot or baseline readability issue.

### 2. Synchronized Macro Axis Ticks
- **Choice**: Generate 5 ticks corresponding to the piecewise boundaries and anchors:
  - Tick 0 (4%): Timeline start (e.g., `Nov 2020`).
  - Tick 1 (28%): Focus window start / ~3 months ago (e.g., `Jul 2026`).
  - Tick 2 (50%): Today anchor (e.g., `Oct 2026 (Today)`).
  - Tick 3 (72%): Focus window end / ~6 months ahead (e.g., `Apr 2027`).
  - Tick 4 (96%): Timeline horizon (e.g., `Oct 2028`).
- **Rationale**: Aligns the visual ruler labels directly with the non-linear scale partitions so the user immediately understands that the center zone is expanded for operational clarity.

### 3. Accessible Click-to-Inspect Popover with Card Synchronization
- **Choice**: In `apps/haven/src/components/app/immigration-journey-dashboard.tsx`, manage a top-level `activeInspectedPinId: string | null` state.
  - Render each timeline dot as an interactive `<button>` with `aria-haspopup="dialog"` and `aria-expanded`.
  - When active, render an anchored popover card containing milestone title, date, countdown pill, status tone, and legal guidance.
  - Apply an active highlight ring to the corresponding milestone card in `TacticalTimelineWindow` and scroll it into view.
  - Clicking any milestone card in the sequence grid sets `activeInspectedPinId` and highlights the corresponding timeline pin.
- **Rationale**: Directly solves user confusion regarding unlabelled dots and ensures instant discoverability without relying on delayed hover tooltips.

## Risks / Trade-offs

- **[Risk] Visual interval distortion across zone boundaries**: A 30-day segment inside the focus window will look visually wider than a 30-day segment in the past era.
  - *Mitigation*: The macro axis ticks and shaded focus bracket explicitly delineate the focus zone, clearly communicating that the center represents the active operational window.
- **[Risk] Popover clipping on screen edges**: Pins near 4% or 96% could overflow the viewport.
  - *Mitigation*: Use CSS `clamp(140px, percent, calc(100% - 140px))` with transform centering so popovers always remain within the swimlane boundaries.

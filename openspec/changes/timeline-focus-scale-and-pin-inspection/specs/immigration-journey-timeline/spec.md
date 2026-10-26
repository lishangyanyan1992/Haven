# Spec Delta

## Purpose

Provides focus-weighted timeline scaling and interactive pin inspection to make immediate immigration milestones legible, non-colliding, and navigable.

## ADDED Requirements

### Requirement: Focus-Expanded Macro Timeline Scale
The system SHALL project timeline dates onto a focus-expanded visual percentage scale where the immediate focus window around today receives an expanded proportion of timeline width while strictly preserving chronological monotonic order.

#### Scenario: Immediate focus zone expanded
- **WHEN** timeline milestones span five or more years across historical and future statuses
- **THEN** the operational focus window around today (spanning active grace periods, urgent deadlines, and next filing milestones) occupies at least 35% of the visual bar width

#### Scenario: Monotonic timeline ordering preserved
- **WHEN** any two timeline events with timestamps T1 and T2 (where T1 < T2) are projected onto the axis
- **THEN** the visual percentage P(T1) is less than or equal to P(T2) across all timeline segments and pins

### Requirement: Interactive Timeline Pin Inspection Popovers
The system SHALL render timeline pin dots as interactive controls that immediately display an inspection popover upon click or keyboard activation.

#### Scenario: Clicking pin displays inspection popover
- **WHEN** the user clicks any timeline pin dot on the macro swimlane or tactical ruler
- **THEN** an anchored inspection popover immediately appears displaying the milestone title, calendar date, relative days countdown, status badge, and legal significance

#### Scenario: Active pin visual indicator
- **WHEN** a timeline pin dot is currently inspected
- **THEN** the pin displays an active contrast ring and enlarged scale to distinguish it from uninspected pins

#### Scenario: Dismissing inspection popover
- **WHEN** the user clicks outside the popover, clicks the close trigger, or presses the Escape key
- **THEN** the popover closes and the pin returns to its resting state

### Requirement: Bi-Directional Milestone Card Highlighting
The system SHALL synchronize timeline pin selection with the corresponding sequential milestone cards and track stage nodes.

#### Scenario: Pin selection highlights milestone card
- **WHEN** the user activates a timeline pin that corresponds to a milestone card in the immediate sequence grid
- **THEN** the matching card receives an active focus ring and accent outline

#### Scenario: Milestone card click highlights timeline pin
- **WHEN** the user clicks a milestone card in the immediate sequence grid
- **THEN** the matching pin on the timeline ruler displays its active state and opens its inspection popover

# Spec Delta

## Purpose

Provides a reconciled, synchronized timeline overlay that harmonizes H-1B status and grace period dates under 8 CFR 214.1(l)(2), pairs a macro horizon with a tactical 90-day countdown, and renders structured journey track cards.

## ADDED Requirements

### Requirement: Automatic H-1B Grace Period and Expiration Date Reconciliation
The system SHALL compute the effective authorized stay deadline for an H-1B holder experiencing a layoff as the minimum of their 60-day grace period end date and their petition expiration date. When the petition expiration date is earlier than the 60th day, the system SHALL cap the authorized stay at the petition expiration date and explicitly notify the user that their I-94 caps their grace period.

#### Scenario: Petition expiration is earlier than 60-day grace period
- **WHEN** user is on H-1B with last work day Oct 8, 2026 and petition expires Oct 29, 2026
- **THEN** system computes effective deadline as Oct 29, 2026 (21 days), marks both Visa and Job tracks with effective deadline Oct 29, 2026 (3 days remaining from Oct 26), and surfaces an explanation that the I-94 expiration caps the grace window

#### Scenario: Petition expiration is later than 60-day grace period
- **WHEN** user is on H-1B with last work day Oct 8, 2026 and petition expires Oct 1, 2027
- **THEN** system computes effective deadline as Dec 7, 2026 (60 days), switches Visa track status to in grace period valid through Dec 7, 2026, and does not show active visa validity through 2027

### Requirement: Dual-Resolution Timeline Presentation
The system SHALL render a dual-resolution timeline comprising a high-level Macro Horizon showing the multi-year trajectory (2018–2028) with a highlighted 90-day focus bracket, and an expanded Tactical 90-Day Window visible directly beneath the macro view that plots immediate milestones with dedicated spacing and no dot collisions.

#### Scenario: Viewing dual-resolution timeline on desktop
- **WHEN** user views the immigration journey timeline
- **THEN** system displays the Macro Horizon spanning start to projected green card horizon, followed immediately by the Tactical 90-Day Window spanning from 45 days before today to 45 days after today with distinct milestone pins

#### Scenario: Urgent milestones within tactical window
- **WHEN** milestones occur within the 90-day tactical window (e.g., last day of work, today, visa expiration, interviews, grace period end)
- **THEN** system renders each event on the tactical window axis with explicit date labels and days-remaining counters without overlapping or text collision

### Requirement: Structured Reconciled Journey Track Cards
The system SHALL replace loose wrapped milestone pills with three structured cards representing the Visa, Job & Sponsor, and Green Card tracks. Each card SHALL feature a header with track name and status badge, key milestone dates, reconciled stay deadlines, and actionable next steps.

#### Scenario: Displaying reconciled track cards
- **WHEN** user views the journey track cards
- **THEN** system renders three equal-width cards in view: Visa track showing reconciled stay deadline, Job track showing employment status and grace countdown, and Green Card track showing priority date and queue progress

#### Scenario: Actionable CTA on track cards
- **WHEN** a track requires external verification or filing action (e.g., checking Visa Bulletin or uploading documents)
- **THEN** system renders a dedicated action link at the bottom of the card with appropriate external or internal navigation target

### Requirement: Cross-Track Green Card and Portability Protection Intelligence
The system SHALL correlate approved immigrant petition (I-140) status with the employment grace period to inform the user of AC21 portability protections and post-6-year H-1B extension eligibility.

#### Scenario: Worker in grace period with approved I-140
- **WHEN** an H-1B worker is in a grace period and holds an approved I-140
- **THEN** system displays a protection callout stating that AC21 portability is unlocked and a new sponsor can file a 3-year extension beyond the 6-year cap

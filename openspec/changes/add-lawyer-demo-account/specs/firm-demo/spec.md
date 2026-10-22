# Spec Delta

## Purpose

Provides realistic simulated client records, sample clickable documents, and live reset capability for demoing the Haven firm dashboard to lawyers.

## ADDED Requirements

### Requirement: Demo firm designation
The system SHALL support designating a firm as a demo firm. Demo firms SHALL retain full normal firm functionality while enabling demo data generation and in-app data resets.

#### Scenario: Demo firm flag check
- **WHEN** a lawyer belonging to a demo firm accesses the firm dashboard
- **THEN** the dashboard recognizes the firm as a demo firm and enables demo controls

#### Scenario: Non-demo firm
- **WHEN** a lawyer belonging to a normal non-demo firm accesses the firm dashboard
- **THEN** no demo controls or reset actions are available or visible

### Requirement: Realistic 50-lead simulated dataset
The system SHALL provide a generator that seeds exactly 50 simulated client records across diverse immigration situations, urgency tiers, and intake statuses for a demo firm.

#### Scenario: Urgency tier coverage
- **WHEN** demo data is seeded for a firm
- **THEN** the client list contains ~10 Urgent leads, ~15 Soon leads, ~12 Later leads, and ~7 Unknown leads sorted by urgency

#### Scenario: Status coverage
- **WHEN** demo data is seeded for a firm
- **THEN** the client list contains a mix of Finished leads (with unreviewed New badges), In progress leads, Signed up leads, and Email sent leads

#### Scenario: Floating dates relative to execution time
- **WHEN** demo data is seeded or reset on any given day
- **THEN** deadline and event dates are calculated relative to that day so days-remaining countdowns remain active and accurate

### Requirement: Clickable sample documents for showcase leads
The system SHALL attach sample documents to 6-8 showcase leads in the demo firm, enabling lawyers to preview 5-minute signed links to realistic immigration documents.

#### Scenario: Opening a sample document from a showcase lead
- **WHEN** a lawyer opens a showcase demo client and clicks Open on a sample document
- **THEN** the system generates a valid signed URL and opens the specimen PDF in a new tab

### Requirement: In-app demo reset action
The system SHALL provide an authorized action allowing lawyers in a demo firm to reset demo leads and dates back to their initial showcase state.

#### Scenario: Resetting demo data
- **WHEN** an authorized demo firm lawyer clicks the Reset demo data button
- **THEN** all 50 lead dates are re-anchored to the current date, unreviewed New badges are restored, and the dashboard reloads with fresh urgency calculations

#### Scenario: Non-demo firm reset attempt
- **WHEN** a user or client not belonging to a demo firm attempts to trigger a demo reset
- **THEN** the system refuses the request and makes no changes to database records

### Requirement: CLI demo seeding command
The system SHALL provide an administrative CLI command to bootstrap a demo firm, assign a lawyer account, upload specimen documents, and seed the 50 simulated leads.

#### Scenario: Running seed-demo CLI command
- **WHEN** an administrator runs the seed-demo command with a lawyer email address
- **THEN** the demo firm is created or updated, the lawyer is added as a firm member, and the 50 simulated leads are populated

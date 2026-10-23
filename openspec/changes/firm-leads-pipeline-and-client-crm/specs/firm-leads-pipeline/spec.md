# Spec Delta

## Purpose

Provides immigration law firms with a dedicated lead management dashboard, high-visibility contact quick actions, pipeline status tracking, filtering, and CRM export capabilities.

## ADDED Requirements

### Requirement: Prominent contact details and 1-click actions
The lawyer dashboard and lead detail views SHALL display the lead's email and phone number prominently with 1-click actions for emailing, calling, and clipboard copying.

#### Scenario: Quick email trigger
- **WHEN** a lawyer clicks the email action button for a lead
- **THEN** the system triggers the default mail client (`mailto:`) addressed to the lead with an immigration inquiry subject line.

#### Scenario: Copy email to clipboard
- **WHEN** a lawyer clicks the copy email button
- **THEN** the email address is copied to the system clipboard and temporary visual feedback is displayed.

#### Scenario: Quick phone call trigger
- **WHEN** a lawyer clicks the call action button for a lead
- **THEN** the system triggers the device telephony or VoIP dialer (`tel:`) with the lead's phone number.

#### Scenario: Copy phone number to clipboard
- **WHEN** a lawyer clicks the copy phone button
- **THEN** the phone number is copied to the system clipboard and temporary visual feedback is displayed.

### Requirement: Manual pipeline status overrides
Lawyers SHALL have the ability to manually update each lead's pipeline stage directly from the dashboard and detail views.

#### Scenario: Update pipeline stage
- **WHEN** a lawyer selects a new status from the pipeline status dropdown (e.g., from `New Lead` to `Consultation Completed`)
- **THEN** the system updates the lead's pipeline stage immediately and persists the change to the database.

#### Scenario: Contract signed graduates lead to client
- **WHEN** a lead's pipeline status is changed to `Contract Signed`
- **THEN** the lead is automatically removed from the active leads pipeline and moved to the retained clients view.

### Requirement: Filterable leads table
The leads dashboard SHALL provide interactive filters allowing lawyers to narrow down leads by urgency tier, pipeline stage, date range, and visa category.

#### Scenario: Filtering by urgency and pipeline stage
- **WHEN** a lawyer filters by `Urgent` priority and `Consultation Scheduled` stage
- **THEN** only leads matching both criteria are displayed in the table.

### Requirement: CRM export to spreadsheet
The system SHALL enable lawyers to export filtered leads to a CSV spreadsheet formatted for import into CRM platforms.

#### Scenario: Export filtered leads to CSV
- **WHEN** a lawyer clicks the "Export Leads (CSV)" button with active filters applied
- **THEN** a CSV file is generated and downloaded containing standard CRM fields: First Name, Last Name, Email, Phone, Urgency Tier, Urgency Reason, Visa Type, Pipeline Status, Intake Status, and Date Added.

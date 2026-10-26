# firm-consultation-booking Specification

## Purpose
Enables sponsoring law firms to provide consultation booking links and contact emails, and displays actionable scheduling channels for clients on their Case dashboard during initial consultation.

## Requirements

### Requirement: Law firm consultation booking channels configuration
The system SHALL allow authenticated law firm members to configure a consultation booking URL, a consultation scheduling contact email, or both for their firm.

#### Scenario: Sponsoring firm configures booking URL and email
- **WHEN** a verified law firm member updates their firm consultation settings with a valid booking URL and email address
- **THEN** the system stores the booking URL and email on the firm profile and confirms successful configuration

#### Scenario: Sponsoring firm provides booking URL only
- **WHEN** a law firm member saves a valid booking URL and leaves the scheduling email empty
- **THEN** the system stores the booking URL and marks the scheduling email as unset

#### Scenario: Sponsoring firm provides scheduling email only
- **WHEN** a law firm member saves a valid scheduling email and leaves the booking URL empty
- **THEN** the system stores the scheduling email and marks the booking URL as unset

#### Scenario: Rejection of malformed booking URL
- **WHEN** a law firm member submits an invalid booking link that does not use http or https protocol
- **THEN** the system rejects the update with a descriptive validation error and leaves the previous configuration unchanged

### Requirement: Initial consultation call to action rendering
The system SHALL render a consultation scheduling call to action on the client Case dashboard when the client engagement is at the initial consultation stage.

#### Scenario: Client views dashboard with firm booking URL
- **WHEN** an authenticated client at the initial consultation stage views their Case dashboard and the sponsoring firm configured a booking URL
- **THEN** the system displays a prominent "Book consultation call" action button linking directly to the configured booking URL

#### Scenario: Client views dashboard with firm scheduling email only
- **WHEN** an authenticated client at the initial consultation stage views their Case dashboard and the sponsoring firm configured only a scheduling email
- **THEN** the system displays an "Email to schedule call" action that opens a mailto link addressed to the firm consultation email

#### Scenario: Client views dashboard with both booking URL and scheduling email
- **WHEN** an authenticated client at the initial consultation stage views their Case dashboard and the firm configured both booking channels
- **THEN** the system displays the "Book consultation call" button as the primary action and offers an email link to schedule directly

#### Scenario: Client views dashboard with neither booking channel configured
- **WHEN** an authenticated client at the initial consultation stage views their Case dashboard and the firm has configured neither a URL nor an email
- **THEN** the system displays an advisory notice indicating that the legal team will reach out to schedule once intake review is complete

### Requirement: Per-client engagement scheduling override
The system SHALL allow law firm attorneys to override or set specific consultation scheduling details on individual client engagement records.

#### Scenario: Attorney overrides booking details for specific client
- **WHEN** an attorney sets custom consultation booking details on an individual client's engagement controls
- **THEN** the system saves the client-specific scheduling details and uses them instead of the firm-wide default when displaying that client's Case dashboard

# Spec Delta

## ADDED Requirements

### Requirement: Display client full names on dashboard
The firm dashboard SHALL display a client's full name in the client list and client detail pages when provided in intake answers, falling back to email when no name was entered.

#### Scenario: Client provided name
- **WHEN** a client has entered their full name during onboarding or setup
- **THEN** the dashboard client list displays their full name prominently with their email secondary, and the client detail view displays their full name as the primary title

#### Scenario: Client has not provided name
- **WHEN** a client is in email-sent status or has not entered a name
- **THEN** the dashboard displays their email address as the primary identifier

### Requirement: Demo controls on firm dashboard
The firm dashboard SHALL render demo reset controls when accessed by a lawyer belonging to a designated demo firm.

#### Scenario: Lawyer views demo dashboard
- **WHEN** a lawyer belonging to a demo firm opens the firm dashboard
- **THEN** a Reset demo data action is available in the dashboard interface

#### Scenario: Lawyer views standard dashboard
- **WHEN** a lawyer belonging to a regular firm opens the firm dashboard
- **THEN** no demo reset action is rendered

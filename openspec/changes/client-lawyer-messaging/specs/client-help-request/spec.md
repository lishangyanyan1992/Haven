# Spec Delta

## Purpose

Asks a firm's client, during onboarding, what kinds of help they want from their lawyer, and shows the answer to that lawyer so the first conversation starts from the client's actual need.

## ADDED Requirements

### Requirement: Onboarding asks what help the client needs
Onboarding SHALL ask "What help do you need from your lawyer?" in place of the old "Main concerns" question. The client SHALL be able to pick one or more choices from a fixed list, each with a short plain-language description. The question SHALL be optional unless the firm marks it required.

#### Scenario: Client picks two choices
- **WHEN** a client picks "First consultation" and "Plan if I lose my job" and continues
- **THEN** both choices are saved to their profile

#### Scenario: Old question is gone
- **WHEN** a client reaches the situation step of onboarding
- **THEN** they see the help question and do not see "Main concerns"

### Requirement: Fixed list of help choices
The help question SHALL offer exactly these choices, in this order: First consultation; Review my current case; Plan if I lose my job; Changing employers; Other ways to stay in the US; Next green card step; Extend or renew my status; Help for my spouse or children; Something else.

#### Scenario: Each choice explains itself
- **WHEN** the client views the help question
- **THEN** every choice shows a one-line description in plain language (for example, "Other ways to stay in the US" reads "Explore other visa or green card paths, like O-1, EB-1A, NIW, or through a spouse")

### Requirement: Firm setting carries over
A firm that had switched the old "Main concerns" question off or on SHALL see the help question in the same state, and SHALL be able to switch it with the same control.

#### Scenario: Firm had concerns switched off
- **WHEN** a firm had "Main concerns" switched off before this change
- **THEN** its clients are not asked the help question until the firm switches it on

### Requirement: Older concern areas stay filled
Each help choice SHALL map to zero or more of the old concern areas (Layoff risk, Visa expiry, Green card timeline, Job change), and the profile's concern areas SHALL be set from the client's help choices so community matching and personalization keep working.

#### Scenario: Job-loss plan maps to layoff risk
- **WHEN** a client picks "Plan if I lose my job"
- **THEN** their concern areas include Layoff risk

#### Scenario: Existing clients keep their concerns
- **WHEN** a client who finished onboarding before this change opens their dashboard
- **THEN** their saved concern areas are unchanged and their help choices are empty until they edit them

### Requirement: Client can change help choices later
The client SHALL be able to change their help choices from settings. A change SHALL reach every firm the client is connected to.

#### Scenario: Client edits in settings
- **WHEN** a client adds "Changing employers" in settings
- **THEN** each connected firm sees the updated choices on the client's page

### Requirement: Lawyer sees help choices
The firm dashboard SHALL show a client's help choices on the client's page and on the client's row in the leads list.

#### Scenario: Lawyer opens a new lead
- **WHEN** a lawyer opens a client who picked "First consultation"
- **THEN** "First consultation" appears in the client's situation section and on their row in the leads list

#### Scenario: Client picked nothing
- **WHEN** a client skipped the help question
- **THEN** the client's page shows "Not answered" for help needed

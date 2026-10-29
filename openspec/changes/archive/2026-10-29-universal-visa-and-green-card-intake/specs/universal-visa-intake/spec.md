# Spec Delta

## Purpose

Enables all users and immigrants, regardless of their visa status or visitor situation, to select or enter their exact status during intake without being forced into mismatched categories or blocked by work requirements.

## ADDED Requirements

### Requirement: Categorized Visa Selection
The system SHALL present a categorized, searchable selection containing visitor visas (B-1, B-2, ESTA), student and exchange visas (F-1, J-1, M-1, OPT, STEM OPT), employment and specialty visas (H-1B, H-1B1, H-4, H-4 EAD, L-1A, L-1B, L-2, O-1A, O-1B, TN, E-1, E-2, E-3, P, R), family visas (K-1, K-3), humanitarian statuses (TPS, DACA, Pending Asylum, Humanitarian Parole, U/T Visa), Lawful Permanent Resident, and U.S. Citizen.

#### Scenario: Selecting a visitor visa
- **WHEN** a user selects "B-2 (Tourism / Visitor)" in the intake profile step
- **THEN** the system records the visa status as "B-2" and marks it valid for progression

#### Scenario: Selecting an extraordinary ability visa
- **WHEN** a user selects "O-1A" in the intake profile step
- **THEN** the system records the visa status as "O-1A" and marks it valid for progression

### Requirement: Custom Unlisted Status Write-in
The system SHALL provide an "Other / Not Listed" selection option that reveals a free-text input field allowing the user to specify any custom visa, parole, or class of admission.

#### Scenario: Submitting an unlisted status
- **WHEN** a user selects "Other" and enters "G-4 International Organization"
- **THEN** the system saves "G-4 International Organization" as the user's visa status without validation error

#### Scenario: Blank custom status rejection
- **WHEN** a user selects "Other" but leaves the custom status text field blank
- **THEN** the system requires the user to enter their status before proceeding

### Requirement: Adaptive Employment Step Branching
The system SHALL evaluate the user's selected visa status and conditionally adjust the employment intake step so non-work, visitor, student, or unpermitted statuses are not blocked by mandatory employment fields.

#### Scenario: Visitor or non-work status user enters intake
- **WHEN** a user with a B-2 or F-1 (pre-OPT) status reaches the employment intake step
- **THEN** the system displays an optional prompt asking if they are currently employed in the US, allowing them to skip employer details if unemployed

#### Scenario: Employment-tied visa user enters intake
- **WHEN** a user with an H-1B, L-1, or TN status reaches the employment intake step
- **THEN** the system presents standard employer and role fields required for status maintenance planning

### Requirement: Unrestricted Visa Data Storage
The system SHALL store the user's visa status as unrestricted text in user profiles, ensuring that custom inputs and all standard categories persist without database constraint failure.

#### Scenario: Storing standard and custom statuses
- **WHEN** a user saves an unlisted or newly added visa status to their profile
- **THEN** the profile database record stores the exact string value without rejection

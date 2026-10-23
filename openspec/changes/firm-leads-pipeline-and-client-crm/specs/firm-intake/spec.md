# Spec Delta

## Purpose

Enables law firms to capture prospective client leads via intake links with mandatory contact details (full name, email, and phone number) before account creation.

## ADDED Requirements

### Requirement: Mandatory contact information collection on intake
The firm intake submission form SHALL require a prospect to provide their full name, valid email address, and valid phone number before sending an intake invite.

#### Scenario: All required fields supplied
- **WHEN** a visitor submits the intake link form with a valid name, email, and phone number
- **THEN** the system stores the pending record including phone number and name in `firm_clients` and sends the verification email.

#### Scenario: Missing phone number
- **WHEN** a visitor attempts to submit the intake form with an empty phone number
- **THEN** the form prevents submission and displays a clear error requiring a phone number.

#### Scenario: Missing full name
- **WHEN** a visitor attempts to submit the intake form with an empty name
- **THEN** the form prevents submission and displays a clear error requiring their name.

### Requirement: Storing contact details for uncompleted onboarding
The system SHALL persist the submitted phone number, name, and email to the firm client record upon link submission so lawyers can view and contact the lead even if the prospect does not complete onboarding.

#### Scenario: Drop-off after link submission
- **WHEN** a visitor successfully submits the intake link form but does not complete password setup or onboarding steps
- **THEN** the law firm dashboard displays the lead with their name, email, and phone number in the leads pipeline.

# Spec Delta

## Purpose

Separates a client's immigration and case profile workspace ("Your Info") from system preferences ("Settings"), and consolidates green card tracking into a single unified multi-petition list alongside current visa and employment details.

## ADDED Requirements

### Requirement: Separate Navigation for Your Info and Settings
The system SHALL provide two distinct navigation destinations for signed-in clients: "Your Info" (`/profile`) for all immigration, employment, green card, document-extracted, and case memory information, and "Settings" (`/settings`) strictly for system and notification preferences.

#### Scenario: Navigating to Your Info
- **WHEN** a signed-in client selects "Your Info" in the main navigation
- **THEN** the system displays the client's current visa and employment details, green cards filed, document-extracted facts summary, and unified case memory

#### Scenario: Navigating to Settings
- **WHEN** a signed-in client selects "Settings" in the main navigation
- **THEN** the system displays only system and email notification preferences (such as community reply and status update notification toggles) without case or immigration intake fields

#### Scenario: Following deep links to case fields or green cards
- **WHEN** a user follows an action link from a dashboard conflict warning, intake completeness prompt, or document fact attribution
- **THEN** the link navigates directly to the corresponding section on "Your Info" (`/profile#case-details` or `/profile#green-cards`)

### Requirement: Current Visa and Employment Section
The "Your Info" workspace SHALL present a unified "Current Visa & Employment" section capturing the client's current visa status, status end date, employer name, job title, H-1B start date, employer size, country of birth, primary goal, spouse or partner visa status, and legal help needed, along with field source attributions when values were extracted from uploaded documents.

#### Scenario: Updating current visa and employment details
- **WHEN** a client edits their visa status, employer details, spouse status, or help needed in "Your Info" and saves
- **THEN** the system persists the updated values to the client's profile, updates connected law firms' shared answers, and preserves any document-source comparison labels

### Requirement: Unified Green Cards Editor Replacing Duplicate Journey Form
The "Your Info" workspace SHALL provide a single "Green Cards Filed" section that lists every green card petition filed for or by the client and SHALL NOT display a separate single-card "Green card journey" form.

#### Scenario: Client with multiple green card petitions
- **WHEN** a client views "Your Info" with two green card petitions on file (for example, an approved I-140 from a prior sponsor and a PERM in progress at a current employer)
- **THEN** both petitions appear in the single "Green Cards Filed" section with their respective sponsor/petitioner, pathway type, preference category, furthest stage reached, filing/approval dates, receipt number, and active/ended status

#### Scenario: Client with legacy flat green card fields and no petition list
- **WHEN** a client whose profile has legacy single-field green card data (such as a priority date, stage, or sponsor stored on flat profile fields) but an empty petition list opens "Your Info"
- **THEN** the system pre-populates the "Green Cards Filed" editor with synthesized petition entries representing their existing flat green card data so no previously entered information is hidden or lost

#### Scenario: Saving green card petitions synchronizes downstream views
- **WHEN** a client adds, edits, ends, or removes a petition in the "Green Cards Filed" section and saves
- **THEN** the system updates the stored petition list, derives and synchronizes the effective priority date, I-140 approval status, and current PERM stage for dashboard and timeline calculations, and updates connected law firms' shared green card records

#### Scenario: Removing all green card petitions clears derived flat green card flags
- **WHEN** a client removes all petitions from the "Green Cards Filed" section and saves an empty list
- **THEN** the system clears the derived flat green card stage, I-140 filed/approved flags, and derived priority date so the profile reflects that no green card is currently on file

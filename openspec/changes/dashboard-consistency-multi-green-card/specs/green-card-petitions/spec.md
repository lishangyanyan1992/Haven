# Spec Delta

## Purpose

Defines how a user's green card petitions, possibly from several employers, are stored, entered, normalized, ended and shown, so each one has its own milestone progression and the shared priority date is handled correctly.

## ADDED Requirements

### Requirement: Petition Records
The system SHALL store each green card petition as its own record with: sponsor name, petition type (employer-sponsored, NIW self-petition, EB-1A self-petition), preference category, stage, optional priority date with whether it was carried over from an earlier petition, key dates (PERM filing, PERM certification, I-140 filing, I-140 approval), and an ended state with a reason and date.

#### Scenario: Two employers on one account
- **WHEN** a user has an approved EB-2 I-140 from Northwind Mutual Insurance and a petition with Harbor Ventures (Lakeside Insurance) that ended at a layoff
- **THEN** both are stored as separate records and neither overwrites the other

### Requirement: Reading Older Petition Records
The system SHALL read petition records saved in earlier formats, including records that use different field names for petition type and category, without losing data, and SHALL save them back in the current format on the next save.

#### Scenario: Legacy field names
- **WHEN** a saved petition uses the older names for type and category
- **THEN** its type and category are shown correctly on the dashboard

### Requirement: Matching Petitions To Employers
The system SHALL match a petition to the user's current or former employer by name while ignoring case, punctuation and text in parentheses, so a sponsor recorded as "Harbor Ventures (Lakeside Insurance)" matches an employer recorded as "Harbor Ventures".

#### Scenario: Sponsor name with parent company
- **WHEN** the employer is "Harbor Ventures" and the petition sponsor is "Harbor Ventures (Lakeside Insurance)"
- **THEN** the petition is treated as that employer's petition

### Requirement: Ending A Petition
The system SHALL let a petition be marked ended with a reason (layoff, job change, withdrawn by employer, denied, other) and a date. An ended petition SHALL NOT drive the user's current green card stage, but an ended petition with an approved I-140 SHALL keep providing its priority date and protections as the law allows.

#### Scenario: Ended early-stage petition
- **WHEN** the Harbor Ventures petition is marked ended at an October 2026 layoff while still in prevailing wage
- **THEN** the dashboard's current stage comes from the Northwind Mutual approved I-140, not from the ended petition

#### Scenario: Approved I-140 from a former employer
- **WHEN** an employer whose I-140 was approved more than 180 days ago is no longer the user's employer
- **THEN** that petition still provides the priority date and job-change protection

### Requirement: One Milestone Track Per Petition
The green card section of the dashboard SHALL show a separate milestone track for every petition. Active petitions are shown in full; approved petitions that no longer move are shown as protected; ended petitions are shown faded with their reason and date. The effective priority date SHALL be shown once, above the tracks, naming the petition it comes from.

#### Scenario: Two employers, one ended
- **WHEN** a user with the two green cards above views the dashboard
- **THEN** it shows an Northwind Mutual track marked protected at I-140 approved, a faded Harbor Ventures track marked "Ended at layoff, Oct 2026", and the Jun 14, 2021 priority date above both, credited to Northwind Mutual

#### Scenario: Single petition
- **WHEN** a user has exactly one petition
- **THEN** one track is shown, with no extra sponsor list or toggle

### Requirement: Adding And Editing Petitions
Settings SHALL include a "Green cards" section where a user can add a petition, edit any field, mark it ended, and remove one entered by mistake. Saving SHALL update every dashboard surface on the next load.

#### Scenario: Add a second employer's petition
- **WHEN** a user with one petition adds a new employer's petition at the PERM stage
- **THEN** the dashboard shows two tracks and the priority date shown stays the earliest approved one

#### Scenario: Remove a mistaken entry
- **WHEN** a user removes a petition they entered by mistake
- **THEN** it no longer appears anywhere, and no ended track is left behind

### Requirement: Sharing Green Cards With The Client's Law Firm
When a client belongs to a law firm, the system SHALL share the client's full green card list with that firm, one plain line per petition naming the sponsor, category, furthest step with its date, priority date, and how and when it ended. The firm's copy SHALL be updated whenever the client saves green cards and when the client joins the firm, SHALL be written only from settings and joining (never from chat), and the firm SHALL still never read the client's profile directly.

#### Scenario: Firm sees both green cards
- **WHEN** a client with an approved Northwind Mutual I-140 and a Harbor Ventures petition that ended at a layoff saves their green cards
- **THEN** their law firm's client page lists both, with the Harbor Ventures line saying it ended at layoff and on what date

#### Scenario: Removing every green card
- **WHEN** a client removes all their green cards
- **THEN** the firm's client page no longer shows a green card list

### Requirement: Petition Input Checks
The system SHALL reject or flag petition input that cannot be true, including an I-140 approval date before its I-140 filing date, a PERM certification date before its PERM filing date, an approved stage with no approval date, and a priority date on a petition before PERM is filed unless it is marked carried over.

#### Scenario: Approval before filing
- **WHEN** a user enters an I-140 approval date earlier than the I-140 filing date
- **THEN** the form shows an error on those fields and does not save

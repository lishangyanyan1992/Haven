# Spec Delta

## Purpose

Provides comprehensive intake and tracking for all green card pathways (family, marriage, self-sponsored, employer, investment, humanitarian, diversity lottery, and custom) with explicit petitioner attribution and multi-petition support.

## ADDED Requirements

### Requirement: Universal Green Card Pathway Selection
The system SHALL provide green card pathway options including Marriage to U.S. Citizen, Marriage to Green Card Holder, Family Preference (F-1, F-2B, F-3, F-4, Immediate Relative), Employer-Sponsored (EB-1, EB-2, EB-3), Self-Petitioned (EB-2 NIW, EB-1A), Investment (EB-5), Humanitarian (Asylum, VAWA, U/T, SIJS), Diversity Immigrant Visa (DV Lottery), and Other.

#### Scenario: Selecting marriage-based green card
- **WHEN** a user indicates they are pursuing a green card and selects "Marriage to U.S. Citizen"
- **THEN** the system sets the pathway to marriage-based and presents family-specific filing stages

#### Scenario: Selecting self-sponsored green card
- **WHEN** a user indicates they are pursuing a green card and selects "EB-2 NIW (National Interest Waiver)"
- **THEN** the system sets the pathway to self-petitioned and bypasses PERM labor certification requirements

#### Scenario: Selecting custom unlisted pathway
- **WHEN** a user selects "Other" pathway and types "Registry / Cancellation of Removal"
- **THEN** the system saves the custom pathway description and allows the user to record their filing status

### Requirement: Pathway-Adapted Filing Stages
The system SHALL present stage options corresponding to the chosen pathway rather than forcing PERM labor certification steps on non-employer petitions.

#### Scenario: Family and marriage stage options
- **WHEN** the user selects a family or marriage green card pathway
- **THEN** the available stages include Form I-130 filed, Form I-130 approved, Form I-485 filed (adjustment of status), Consular/NVC processing, and 2-Year Conditional Resident

#### Scenario: Employer-sponsored stage options
- **WHEN** the user selects an employer-sponsored pathway
- **THEN** the available stages include PWD/Recruitment, PERM filed, PERM certified, Form I-140 filed, Form I-140 approved, and Form I-485 filed

### Requirement: Explicit Sponsor and Petitioner Attribution
The system SHALL prompt for and record the specific petitioning or sponsoring entity for every green card petition, explicitly distinguishing between current employers, prior employers, spouses, family members, self-petitions, and third parties.

#### Scenario: Capturing a spouse petitioner
- **WHEN** a user fills in the sponsor details for a marriage green card
- **THEN** the system records the petitioner as "Spouse" rather than attributing the petition to an employer

#### Scenario: Capturing a prior employer petition
- **WHEN** a user records a petition sponsored by a previous employer
- **THEN** the system attributes the petition to the prior entity and evaluates priority date retention independently of current employment

### Requirement: Multi-Petition and Retained Priority Date Capture
The system SHALL allow intake users to record both an earlier approved petition (such as a prior Form I-140 locking in a priority date) and any active or concurrent green card petition.

#### Scenario: User with prior approved I-140 and new pending petition
- **WHEN** a user enters an active petition and also specifies an approved I-140 from a prior sponsor with an earlier filing date
- **THEN** the system preserves both petition records and sets the effective priority date to the earlier approved date

### Requirement: Unrestricted Green Card Category Storage
The system SHALL persist preference categories and green card pathways without enum constraints in the database, allowing any valid statutory category or custom write-in.

#### Scenario: Persisting non-EB category
- **WHEN** a profile is saved with a family category such as "Immediate Relative (Spouse)" or "F-2A"
- **THEN** the database stores the preference category string cleanly without validation rejection

# Spec Delta

## Purpose

Provides immigration law firms with a dedicated workspace for retained clients (post-contract signed), including comprehensive case profile exports and document archive downloads for case management systems.

## ADDED Requirements

### Requirement: Dedicated retained clients workspace
The system SHALL provide a dedicated `/firm/clients` view that only displays clients whose contract has been signed, isolated from uncommitted leads.

#### Scenario: Viewing signed clients
- **WHEN** a lawyer visits the retained clients section
- **THEN** only clients with `Contract Signed` status are listed, displaying their case details, document counts, and deadline milestones.

#### Scenario: Unsigned leads excluded
- **WHEN** a lead is in any pipeline stage other than `Contract Signed`
- **THEN** they do NOT appear on the retained clients page.

### Requirement: Case management system (CMS) export
The system SHALL allow lawyers to export a client's complete case dossier and uploaded documents in a structured archive ready for upload into legal case management systems.

#### Scenario: Exporting full client dossier
- **WHEN** a lawyer clicks "Export for Case Management" on a retained client record
- **THEN** the system generates a downloadable package containing a structured summary file (client profile, questionnaire responses, deadline facts) and their uploaded vault documents.

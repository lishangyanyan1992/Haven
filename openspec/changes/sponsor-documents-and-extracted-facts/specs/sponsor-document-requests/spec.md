# Spec Delta

## Purpose

Makes the document checklist ask for sponsor-specific documents once for each sponsor, only when that sponsor's case has produced the document, and ties every such upload to its sponsor.

## ADDED Requirements

### Requirement: Sponsor-Tied Document Types
The system SHALL treat the I-140 notice and the PERM certification as tied to a green card sponsor, and the H-1B petition packet as tied to the current H-1B employer. A lawyer SHALL be able to mark a custom required document as tied to a green card sponsor. All other document types are requested once per client.

#### Scenario: Preset sponsor-tied types
- **WHEN** a firm's required list includes the I-140 notice, PERM certification and passport page
- **THEN** the I-140 notice and PERM certification are requested per sponsor and the passport page is requested once

#### Scenario: Custom sponsor-tied document
- **WHEN** a lawyer adds "Employment verification letter" and marks it as tied to a sponsor
- **THEN** it is requested once for each of the client's green card sponsors

### Requirement: One Checklist Item Per Sponsor
For each sponsor-tied required document, the client's checklist and the lawyer's client page SHALL show one item per green card record (including ended ones), named with the sponsor, such as "I-140 approval notice — Acme Insurance". With no green card record, the item SHALL appear once with no sponsor name.

#### Scenario: Two sponsors
- **WHEN** a client has green card records for Acme Insurance (I-140 approved) and IBM (I-140 approved)
- **THEN** the checklist shows two I-140 notice items, one per sponsor, each with its own status and upload button

#### Scenario: No green card yet
- **WHEN** a client has no green card record
- **THEN** the I-140 notice appears once, without a sponsor name

### Requirement: Request Only What The Case Has Produced
A sponsor's PERM certification SHALL be requested only once that sponsor's case is at PERM certified or later, and its I-140 notice only once it is at I-140 filed or later. When the stage is unknown, the item SHALL be requested. Items not yet requested SHALL be listed as "Not needed yet" with the reason.

#### Scenario: Petition ended before PERM
- **WHEN** the Harbor Ventures record ended at layoff while in prevailing wage
- **THEN** neither its PERM certification nor its I-140 notice is requested, and both show "Not needed yet: this case ended before PERM"

#### Scenario: Stage moves forward
- **WHEN** a client changes a sponsor's stage from PERM in progress to I-140 filed
- **THEN** that sponsor's PERM certification and I-140 notice become requested items

### Requirement: Uploads Are Linked To One Sponsor
Every upload of a sponsor-tied document SHALL be linked to exactly one green card record. Uploading from a sponsor's checklist item SHALL link it to that sponsor. Uploading elsewhere SHALL ask which sponsor it belongs to, pre-selecting the sponsor named on the document once it is read. The client SHALL be able to change the link later.

#### Scenario: Upload from a sponsor's item
- **WHEN** a client uploads a file from "I-140 approval notice — IBM"
- **THEN** the document is linked to the IBM record and that item shows Uploaded

#### Scenario: Wrong sponsor fixed
- **WHEN** a client moves an I-140 notice from the IBM record to the Acme Insurance record
- **THEN** the IBM item returns to Needed and the Acme Insurance item shows Uploaded

### Requirement: Completion Counts Per Sponsor
The required-document count on the lawyer's client list SHALL count each requested sponsor item separately and SHALL leave out items marked "Not needed yet".

#### Scenario: Count with two sponsors
- **WHEN** a firm requires a passport page and the I-140 notice, and the client has two sponsors with filed I-140s, with the passport and one I-140 notice uploaded
- **THEN** the client list shows "2/3 required"

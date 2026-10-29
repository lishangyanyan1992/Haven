# Spec Delta

## Purpose

Defines which details Haven reads from each kind of immigration document, how those details are written into the client's profile and green card records without a confirm step, and how clients and lawyers are told what was taken.

## ADDED Requirements

### Requirement: Fixed List Of Details Per Document Type
The system SHALL read only these details: I-140 notice (sponsor, receipt number, priority date, category, filing date, approval date); PERM certification (employer, filing date, certification date); H-1B approval notice (employer, receipt number, valid from, valid to); I-94 (class of admission, admit-until date); passport page (country of birth). Other document types SHALL have no details read.

#### Scenario: Paystub uploaded
- **WHEN** a client uploads a paystub
- **THEN** no details are read from it and its card says "Haven keeps this document but doesn't take any details from it"

#### Scenario: Detail outside the list
- **WHEN** an I-140 notice also shows the beneficiary's date of birth
- **THEN** the date of birth is not stored as a detail

### Requirement: Telling People What Will Be Read
Before upload, every checklist item and the general upload screen SHALL list, in plain words, the details Haven will take from that document type and where they will appear.

#### Scenario: I-140 checklist item
- **WHEN** a client views "I-140 approval notice — Acme Insurance"
- **THEN** it says Haven will take the sponsor, receipt number, priority date, category, and filing and approval dates, and fill them into the Acme Insurance green card

### Requirement: Details Are Applied Automatically
After a document's text is read, the system SHALL pull its details and write each one into its profile or green card field with no confirm step, unless that field already holds a different value a person entered, or Haven is not confident in the detail. Dashboard values SHALL update on the next load.

#### Scenario: Empty field filled
- **WHEN** a client with no priority date uploads an I-140 notice showing priority date Jun 14, 2021
- **THEN** the matching green card's priority date becomes Jun 14, 2021 without the client confirming anything

#### Scenario: Unclear scan
- **WHEN** a detail cannot be read with confidence
- **THEN** it is not written, and the document card lists it as "Haven wasn't sure — please check" with what it read

### Requirement: Details Go To The Right Sponsor
Green card details SHALL go to the record the document is linked to. With no link, they SHALL go to the record whose sponsor matches the name on the document. If no record matches, the system SHALL create a new green card record from the document and say so on the document card.

#### Scenario: New sponsor found
- **WHEN** a client uploads an I-140 notice from IBM and has no IBM green card record
- **THEN** a new IBM green card record is created with the notice's details, and the card says "Added a new green card for IBM"

### Requirement: One Status Date From Several Documents
When both an I-94 admit-until date and an H-1B valid-to date are available, the status end date SHALL come from the I-94. The H-1B date SHALL be kept as a detail of that document and shown if it differs.

#### Scenario: I-94 and H-1B approval differ
- **WHEN** the I-94 says admit until Sep 30, 2027 and the H-1B approval says valid to Oct 15, 2027
- **THEN** the status end date is Sep 30, 2027, credited to the I-94, and the H-1B card notes the different date

### Requirement: What Haven Took From This Document
Every read document SHALL show the client and the lawyer a "What Haven took" list: each detail, the page it came from, where it was filled, and whether it was filled, left for review, or not used because a person's value differs. Each filled item SHALL link to its field in Settings.

#### Scenario: Lawyer opens a client's I-140 notice
- **WHEN** a lawyer views the I-140 notice on the client's page
- **THEN** they see each detail with its page, where it went, and its state

### Requirement: Reading Older Uploads
Documents uploaded before this change SHALL NOT be read for details automatically. Each such document SHALL offer a "Read details" action that runs the same process.

#### Scenario: Old I-140 notice
- **WHEN** a client clicks "Read details" on an I-140 notice uploaded last month
- **THEN** its details are read and applied as if it had just been uploaded

### Requirement: Rereading Replaces Earlier Details
Reading a document again SHALL replace that document's earlier details. Fields it filled before SHALL take the new values, unless a person changed them since.

#### Scenario: Reread after a bad scan
- **WHEN** a client re-reads a document whose priority date was misread, and the new read is correct
- **THEN** the field the document filled shows the corrected date

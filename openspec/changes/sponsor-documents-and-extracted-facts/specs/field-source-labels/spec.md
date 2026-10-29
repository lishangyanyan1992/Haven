# Spec Delta

## Purpose

Records and shows where every profile and green card value came from, lets people overwrite any value Haven filled, and makes disagreements between a person's value and a document visible and resolvable for both client and lawyer.

## ADDED Requirements

### Requirement: Every Value Shows Its Source
Each profile and green card field in Settings, and each value on the lawyer's client page, SHALL show one label: "From your <document>, page N" (filled from a document), "You entered this" (typed by a person), "You changed this" (a person overwrote a document value), "Haven wasn't sure — please check" (read with low confidence), or "From a document you deleted — please confirm".

#### Scenario: Value filled from a document
- **WHEN** a client opens Settings after their I-140 notice filled the Acme Insurance priority date
- **THEN** the field shows Jun 14, 2021 with "From your I-140 notice, page 1", linking to the document

#### Scenario: Value typed before documents existed
- **WHEN** a field was filled during onboarding
- **THEN** it shows "You entered this"

### Requirement: Any Filled Value Can Be Overwritten
A client SHALL be able to change any value Haven filled from a document, in Settings, the same way as any other field. Saving SHALL keep the person's value and the document's value side by side.

#### Scenario: Client corrects a date
- **WHEN** a client changes a document-filled I-140 approval date from Mar 3, 2023 to Mar 13, 2023 and saves
- **THEN** the dashboard uses Mar 13, 2023 and the field reads "You changed this. Your I-140 notice says Mar 3, 2023"

### Requirement: Documents Never Overwrite A Person's Value
When a document's detail differs from a value a person entered or changed, the system SHALL keep the person's value and mark the field as a disagreement showing both values and the document. A detail matching the person's value SHALL relabel the field as confirmed by that document.

#### Scenario: Document disagrees with onboarding answer
- **WHEN** a client entered priority date Jan 15, 2022 during onboarding and then uploads an I-140 notice showing Jun 14, 2021
- **THEN** the field keeps Jan 15, 2022 and shows "Your I-140 notice says Jun 14, 2021" with the two resolve actions

#### Scenario: Document agrees
- **WHEN** the uploaded notice shows the same date the client entered
- **THEN** the field shows "From your I-140 notice, page 1" and no disagreement

### Requirement: Resolving A Disagreement
Each disagreement SHALL offer "Use the document's value" (switches the field to the document's value and source) and "Keep mine" (keeps the person's value, hides the warning, and keeps the "You changed this" label naming the document's value). Either choice SHALL be reversible.

#### Scenario: Use the document's value
- **WHEN** a client clicks "Use the document's value" on the priority date disagreement
- **THEN** the field becomes Jun 14, 2021, labeled "From your I-140 notice, page 1", and the warning is gone

#### Scenario: Keep mine
- **WHEN** a client clicks "Keep mine"
- **THEN** the field keeps Jan 15, 2022, the warning is gone, and the label still names the document's value

### Requirement: Disagreements Are Visible To The Lawyer
The lawyer's client page SHALL list every open disagreement and every "Keep mine" choice, each with the field, the client's value, the document's value and a link to the document. The client list SHALL show a count of open disagreements per client.

#### Scenario: Lawyer reviews a client
- **WHEN** a client has one open disagreement on priority date and chose "Keep mine" on an approval date
- **THEN** the lawyer's client page lists both, and the client list shows "1 to check" for that client

### Requirement: Deleting A Source Document
When a document is deleted, values it filled SHALL keep their current value and change to "From a document you deleted — please confirm" until a person saves them or another document confirms them. Disagreements involving only that document SHALL be removed.

#### Scenario: Delete the I-140 notice
- **WHEN** a client deletes the I-140 notice that filled the priority date
- **THEN** the priority date keeps Jun 14, 2021 with the deleted-document label, and saving it changes the label to "You entered this"

### Requirement: Sources Follow Green Card Edits
Labels on green card fields SHALL stay with their green card record when it is edited or ended, and SHALL be removed when the record is removed.

#### Scenario: Remove a mistaken record
- **WHEN** a client removes a green card record whose fields were filled from a document
- **THEN** the record and its labels are gone, and the document's "What Haven took" list marks those details "Not used: green card removed"

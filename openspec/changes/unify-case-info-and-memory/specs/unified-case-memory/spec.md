# Spec Delta

## Purpose

Provides a single transparent place in "Your Info" where clients can view everything Haven remembers about their case (facts remembered from chat, facts extracted from uploaded documents, and manually added case notes), add or remove case memories, and automatically share active memories with both the Advisor chat and connected law firms.

## ADDED Requirements

### Requirement: Unified Case Memory View in Your Info
The "Your Info" workspace SHALL display a unified "Case Memory" section showing all active facts remembered from Advisor conversations, all manually entered case notes, and a summary of facts extracted from uploaded documents with links to their source documents or fields.

#### Scenario: Viewing chat-remembered facts and manual notes together
- **WHEN** a client who previously stated "I was laid off 10 days ago" in Advisor chat and also added a manual case note opens "Your Info"
- **THEN** both the chat-remembered statement and the manual case note appear in the "Case Memory" section with timestamps and source labels ("From chat" vs. "Added by you")

#### Scenario: Viewing document-extracted facts in Your Info
- **WHEN** a client has uploaded documents from which Haven extracted case details (such as an I-140 receipt number, priority date, or I-94 status end date)
- **THEN** "Your Info" lists the extracted document details alongside their source document name, page number, and whether each detail is currently applied to the profile or flagged for check

### Requirement: Manual Case Note Addition and Memory Removal
The system SHALL allow clients to manually add freeform case facts or notes to their permanent memory from "Your Info" and to remove (dismiss) any chat-remembered fact or manual case note from either "Your Info" or the Advisor page.

#### Scenario: Manually adding a case note
- **WHEN** a client types a statement about their case (up to 240 characters, such as "My H-1B transfer receipt notice arrived on Oct 18, 2026") in the "Case Memory" input and submits it
- **THEN** the system stores the statement in permanent memory as a user-added note and immediately displays it in the memory list

#### Scenario: Rejecting empty or oversized manual case notes
- **WHEN** a client attempts to submit a blank manual note or a note exceeding 240 characters
- **THEN** the system rejects the submission and displays a validation message

#### Scenario: Removing a remembered fact or manual note
- **WHEN** a client clicks the remove action on any item in "Case Memory"
- **THEN** the system marks the item as dismissed so it is immediately removed from "Your Info", removed from the Advisor page, excluded from future Advisor prompts, and hidden from the lawyer dashboard

### Requirement: Feeding Unified Case Memory into Advisor Chat
The Advisor SHALL include both active chat-remembered facts and active manually added case notes in its prompt context when answering the client's questions.

#### Scenario: Advisor uses a manually added case note
- **WHEN** a client adds a manual case note in "Your Info" and then asks a question in the Advisor
- **THEN** the Advisor receives the manual note in its remembered-facts prompt context attributed with the date it was added

### Requirement: Sharing Active Case Memory with the Lawyer Dashboard
The lawyer's client detail page (`/firm/clients/[id]`) SHALL display all active (non-dismissed) case memories — including chat-remembered facts and manually added case notes — for a connected client in a dedicated "Case Memory & Client Notes" section.

#### Scenario: Lawyer views client's active memories
- **WHEN** a lawyer opens the client detail page for a connected client who has active chat-remembered facts (such as "I was laid off 10 days ago") or manual case notes
- **THEN** the lawyer dashboard displays each active memory with its text, origin label ("From chat" or "Client note"), and the date it was recorded

#### Scenario: Removed memory is hidden from the lawyer dashboard
- **WHEN** a client removes a remembered fact or manual note from their memory
- **THEN** the removed item is no longer shown on the lawyer's client detail page

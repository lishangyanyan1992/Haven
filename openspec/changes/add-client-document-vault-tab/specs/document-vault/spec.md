# Spec Delta

## Purpose

Gives every signed-in client a dedicated Documents tab in the workspace navigation and an organized vault where they can upload, open/download, categorize or relabel, delete, and fulfill requested immigration documents.

## ADDED Requirements

### Requirement: All signed-in clients have a Documents tab in workspace navigation
The client workspace navigation SHALL include a `Documents` tab (`/documents`) alongside `Ask` (`/advisor`) and `Settings` (`/settings`), accessible to every signed-in invited client without requiring a separate allowlist entry.

#### Scenario: Signed-in client views sidebar navigation
- **WHEN** a signed-in invited client opens any client workspace page (`/advisor`, `/documents`, `/settings`)
- **THEN** the navigation displays `Ask`, `Documents`, and `Settings`, and clicking `Documents` opens `/documents`

#### Scenario: Signed-in client not on legacy test allowlist visits `/documents`
- **WHEN** a signed-in invited client who is not on `DOCUMENT_READING_ALLOWLIST` and is not attached to a firm visits `/documents`
- **THEN** the vault page renders normally and background AI reading is queued for their uploaded documents

### Requirement: Clients can open and download their uploaded documents
The vault SHALL allow a signed-in client to open or download any document they have uploaded through a short-lived signed URL scoped to their own account.

#### Scenario: Client opens an uploaded document
- **WHEN** a signed-in client clicks Open/Download on a document in their vault
- **THEN** the system verifies ownership and redirects to a short-lived signed URL for that file

#### Scenario: Client attempts to open another user's document
- **WHEN** a signed-in client requests `/api/files/sign?documentId=<other-user-doc-id>`
- **THEN** the system returns 404 Not Found and does not generate a signed URL

### Requirement: Clients can organize documents by category and label
The vault SHALL display each document's category/label and allow the client to select a document category during upload or change an existing document's category and display label after upload.

#### Scenario: Upload with selected category
- **WHEN** a client uploads a file into a specific requested document slot or selects a document category
- **THEN** the document is saved with that category (`document_kind`) and label (`display_label`)

#### Scenario: Relabel or recategorize an existing document
- **WHEN** a client changes the category or label of an already uploaded document in their vault
- **THEN** the updated category and label are persisted and reflected in both the client's vault and their law firm's client view

### Requirement: Vault displays requested document checklist for firm clients and standard categories for non-firm clients
When a client belongs to a law firm that has configured required documents, the vault SHALL display a checklist of those required documents showing which items are uploaded and which are still needed, with a direct upload control on each needed item. When a client does not belong to a firm (or their firm has not configured a list), the vault SHALL display Haven's standard immigration document categories.

#### Scenario: Firm client views vault with required documents
- **WHEN** a client attached to a firm with 3 required documents (1 uploaded, 2 missing) opens `/documents`
- **THEN** the vault shows the firm's required documents section with the 1 matching document marked uploaded and the 2 missing items offering direct upload

#### Scenario: Independent client views vault
- **WHEN** a signed-in client who did not join through a law firm opens `/documents`
- **THEN** the vault shows Haven's standard immigration document categories without a firm-request banner, and allows uploading, opening, categorizing, and deleting files

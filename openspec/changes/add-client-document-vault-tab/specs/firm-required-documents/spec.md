# Spec Delta

## Purpose

Lets immigration lawyers configure and update a firm-wide list of required documents (from common immigration document types plus custom items) and track each client's progress against that checklist on the firm dashboard.

## ADDED Requirements

### Requirement: Lawyers are prompted to set up required documents on their firm dashboard
When a signed-in lawyer opens `/firm` and their firm has not yet saved a required documents list, the dashboard SHALL display a required-documents setup card pre-populated with common immigration document types and an option to add custom document items.

#### Scenario: First-time lawyer setup on `/firm`
- **WHEN** a lawyer signs in to `/firm` for a firm whose required documents list has not been configured yet
- **THEN** the dashboard shows a setup card where the lawyer can check/uncheck preset immigration documents, add custom document names, and save the firm's required documents list

#### Scenario: Lawyer adds a custom required document
- **WHEN** a lawyer enters a custom document name (e.g., "Updated Resume / CV") and saves the firm's required documents list
- **THEN** the custom item is saved as part of the firm's required documents and appears in the checklist for all of the firm's clients

### Requirement: Lawyers can edit their firm's required documents list at any time
After initial setup, `/firm` SHALL provide an action allowing any lawyer at the firm to modify the checked preset documents or add/remove custom required documents.

#### Scenario: Lawyer updates required documents after initial setup
- **WHEN** a lawyer clicks Edit required documents on `/firm`, toggles an item or adds a new custom document, and saves
- **THEN** the updated list is saved for the firm and reflected on `/firm`, `/firm/clients/[id]`, and the `/documents` vault of clients belonging to that firm

### Requirement: Firm dashboard and client detail page show required document completion
The firm client list on `/firm` and each client's detail page at `/firm/clients/[id]` SHALL show how many of the firm's required documents the client has uploaded, and `/firm/clients/[id]` SHALL list which required documents are uploaded (with an Open action) and which are still missing, alongside any additional uploaded documents.

#### Scenario: Lawyer views client detail page with partial required documents
- **WHEN** a lawyer opens `/firm/clients/[id]` for a client who has uploaded 2 of the firm's 4 required documents plus 1 extra document
- **THEN** the Documents section shows the 4 required documents (2 with their uploaded files and Open buttons, 2 marked as not uploaded yet) and lists the 1 extra document under additional uploads

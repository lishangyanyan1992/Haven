# Spec Delta

## Purpose

Defines how clients join one or more law firms via firm intake links, grant access to their shared immigration profile and document vault, and keep their shared information synchronized across all invited law firms while isolating firm-specific engagement state.

## ADDED Requirements

### Requirement: Client can join multiple law firms via intake links
The system SHALL allow a client to open intake links (`/i/[token]`) from multiple distinct law firms and establish an independent client relationship with each firm, while preventing duplicate client records within the same firm.

#### Scenario: Client already connected to Firm A opens Firm B intake link
- **WHEN** a client who has already joined Firm A submits or accepts an intake invite for Firm B at `/i/[token]`
- **THEN** the system creates a new client relationship for `(Firm B, client)` without rejecting the client as belonging to another firm, and preserves the client's existing relationship with Firm A

#### Scenario: Client re-submits intake link for the same firm they already joined
- **WHEN** a client who has already joined Firm A submits the intake form for Firm A again with the same email
- **THEN** the system recognizes the existing `(Firm A, client)` relationship and prompts the client to sign in rather than creating a duplicate record in Firm A

### Requirement: Signed-in client can grant access directly on an intake link
When an authenticated client visits an active firm intake link (`/i/[token]`) for a law firm they have not yet joined, the system SHALL allow the client to grant that firm access directly without requiring a separate email confirmation round-trip.

#### Scenario: Authenticated client grants access to a new firm from `/i/[token]`
- **WHEN** a signed-in client opens `/i/[token]` for Firm B and confirms granting access to Firm B
- **THEN** the system links the client's account to Firm B, marks the firm connection as joined, populates Firm B's shared intake answers from the client's existing profile if available, and redirects the client to their dashboard or onboarding flow

#### Scenario: Authenticated client opens `/i/[token]` for a firm they already joined
- **WHEN** a signed-in client opens `/i/[token]` for a firm where their account is already joined
- **THEN** the system indicates that access is already granted to that firm and provides a direct link to the client dashboard

### Requirement: Invite claim matches the specific law firm token
When a client claims a firm invitation token via email confirmation, the system SHALL match the claim token against the specific firm invitation being claimed, even when the client has pending or joined records across multiple law firms.

#### Scenario: Client with multiple firm records claims a specific firm invite
- **WHEN** a client with an existing Firm A relationship clicks the confirmation link containing Firm B's claim token
- **THEN** the system verifies Firm B's claim token, marks the `(Firm B, client)` record as joined, and leaves the Firm A record unchanged

### Requirement: Shared client data synchronizes to all invited law firms
Once a client has granted access to one or more law firms, the system SHALL make the client's shared intake answers and uploaded vault documents visible to every joined law firm, while keeping each firm's engagement timeline state, lawyer notes, and pipeline status isolated from other firms.

#### Scenario: Client updates onboarding setup or deadlines while connected to multiple firms
- **WHEN** a client connected to both Firm A and Firm B saves their onboarding setup or key immigration dates
- **THEN** the system updates the shared answers for both Firm A and Firm B so lawyers at both firms see the latest client information

#### Scenario: Client uploads a document in the document vault
- **WHEN** a client connected to both Firm A and Firm B uploads a document in `/documents`
- **THEN** both Firm A and Firm B can view and download the uploaded document in their respective firm portals

#### Scenario: Firm-specific engagement state remains isolated between firms
- **WHEN** a lawyer at Firm A updates milestones, adds client-visible notes, or changes pipeline status for a shared client
- **THEN** Firm B cannot see Firm A's milestones, notes, or pipeline status, and only sees its own firm-specific engagement state for that client

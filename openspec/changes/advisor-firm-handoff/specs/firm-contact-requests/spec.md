# Spec Delta

## Purpose

Lets a firm's client or lead ask their own firm, from inside Haven, to contact them, and shows the firm who has asked without changing how leads are ranked or staged.

## ADDED Requirements

### Requirement: Client creates a contact request only by explicit action
A contact request SHALL be created only when the client chooses the contact action. The advisor, the system, or the firm SHALL NOT create one on the client's behalf.

#### Scenario: Handoff shown, no click
- **WHEN** a firm client receives a handoff and does not choose the contact action
- **THEN** no contact request exists and the firm sees nothing new

#### Scenario: Client chooses the action
- **WHEN** the client chooses "Let [firm] know"
- **THEN** one contact request is created for that client and that firm, and the client sees that it was sent

### Requirement: Request contents are limited to the handoff summary
A contact request SHALL contain only the practice area, the dates listed in the handoff's "take with you" section, the handoff's suggested questions, and the time it was sent. It SHALL NOT contain the client's messages, the advisor's answers, or any other conversation content.

#### Scenario: Firm reads a request
- **WHEN** a lawyer opens a contact request
- **THEN** they see the practice area, the listed dates, the suggested questions and the time, and no text from the conversation

#### Scenario: Sensitive question in the conversation
- **WHEN** the client's question mentioned fees charged by their firm before the handoff
- **THEN** that question does not appear anywhere in the contact request

### Requirement: Client sees what will be shared before sending
Before a request is sent, the client SHALL be able to see exactly what the firm will receive.

#### Scenario: Preview before sending
- **WHEN** the client is about to send a contact request
- **THEN** the items the firm will receive are visible to them before they confirm

### Requirement: Requests are visible only to the client's own firm
A contact request SHALL be readable only by members of the firm it was sent to, and SHALL be creatable only by the client it belongs to, for the firm they are linked to.

#### Scenario: Another firm's lawyer
- **WHEN** a lawyer at a different firm loads their dashboard
- **THEN** the request does not appear and cannot be fetched

#### Scenario: Request for a firm the client is not linked to
- **WHEN** a client attempts to create a request addressed to a firm they are not linked to
- **THEN** the request is rejected

### Requirement: One open request at a time
A client SHALL have at most one unhandled contact request with their firm. A further attempt while one is open SHALL NOT create a duplicate.

#### Scenario: Repeat click
- **WHEN** a client with an open request chooses the contact action again
- **THEN** no new request is created and the client is told when the open one was sent

### Requirement: Dashboard marks people who asked to be contacted
On the firm's leads and clients views, any person with an unhandled contact request SHALL show an "Asked to be contacted" marker with how long ago it was sent and a way to read the request. The firm SHALL be able to filter to only those people.

#### Scenario: Lead with an open request
- **WHEN** a lawyer views the leads list and one lead has an open request from two hours ago
- **THEN** that lead shows "Asked to be contacted, 2h ago" with a way to read the note

#### Scenario: Filter
- **WHEN** the lawyer selects the "asked to be contacted" filter
- **THEN** only people with an open request are listed

#### Scenario: Signed client
- **WHEN** a contract-signed client sends a request
- **THEN** the marker appears on the clients view as well

### Requirement: Contact requests do not change urgency or pipeline stage
Creating, reading, or handling a contact request SHALL NOT change the person's urgency tier, urgency reason, position in the urgency ranking, or pipeline stage.

#### Scenario: Urgency unchanged
- **WHEN** a lead whose dates rank them "Unknown" sends a contact request
- **THEN** their urgency tier and ranking position are unchanged

#### Scenario: Stage unchanged
- **WHEN** a lead at the new-lead stage sends a request and the firm marks it handled
- **THEN** their pipeline stage is still new lead

### Requirement: Firm marks a request handled
A firm member SHALL be able to mark a contact request handled. A handled request SHALL no longer show the marker, and the client SHALL then be able to send a new request.

#### Scenario: Handling a request
- **WHEN** a lawyer marks a request handled
- **THEN** the marker disappears from the dashboard and the client's next handoff offers "Let [firm] know" again

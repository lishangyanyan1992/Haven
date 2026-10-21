# Spec Delta

## Purpose

Lets an immigration law firm exist inside Haven with its own lawyer logins, and guarantees that each firm only ever sees its own clients.

## ADDED Requirements

### Requirement: Owner sets up firms and lawyers
The system SHALL let the owner create a firm with a name and add one or more lawyers to it by email. There SHALL be no public way to create a firm or become a lawyer.

#### Scenario: New firm with one lawyer
- **WHEN** the owner creates the firm "Acme Immigration Law" with lawyer jane@acme.com
- **THEN** the firm exists with its own intake link, and jane@acme.com is emailed a link to set her password

#### Scenario: Second lawyer at the same firm
- **WHEN** the owner adds sam@acme.com to Acme Immigration Law
- **THEN** Sam is emailed a link to set his password, and once signed in he sees the same clients as Jane

#### Scenario: No self-serve firm sign-up
- **WHEN** a visitor looks for a way to create a firm or lawyer account on the website
- **THEN** none exists, and the invite chat's lawyer path only records a request for the owner

### Requirement: A lawyer belongs to exactly one firm
Each lawyer login SHALL belong to exactly one firm. A lawyer login SHALL NOT also be a client of any firm.

#### Scenario: Adding a lawyer who is already at another firm
- **WHEN** the owner tries to add jane@acme.com to a second firm
- **THEN** the system refuses and says she already belongs to Acme Immigration Law

#### Scenario: Adding a client as a lawyer
- **WHEN** the owner tries to add an email that is already a firm client
- **THEN** the system refuses and says that email belongs to a client

### Requirement: Lawyers land on the firm dashboard
After signing in, a lawyer SHALL be taken to their firm dashboard, not to client setup or the chat. A lawyer SHALL be able to sign out and reset their password the same way clients do.

#### Scenario: Lawyer signs in
- **WHEN** jane@acme.com signs in
- **THEN** she lands on the Acme Immigration Law dashboard

#### Scenario: First password from the invite email
- **WHEN** a new lawyer sets their password from the invite email and then signs in
- **THEN** they land on the firm dashboard

### Requirement: Only lawyers can open the firm area
The firm dashboard and client pages SHALL be open only to signed-in lawyers. Anyone else SHALL be turned away.

#### Scenario: Signed out
- **WHEN** a signed-out visitor opens the dashboard address
- **THEN** they are sent to sign in

#### Scenario: Signed-in client
- **WHEN** a firm client opens the dashboard address
- **THEN** they are turned away and sent back to their own Haven home

### Requirement: A firm only ever sees its own clients
A lawyer SHALL only see clients, setup answers and documents of clients who belong to their own firm. This SHALL hold for every page, every download, and any direct database access made with the lawyer's login.

#### Scenario: Guessing another firm's client
- **WHEN** a lawyer at Acme opens a client page using the identifier of a client of another firm
- **THEN** they see "not found", and nothing about that client is revealed

#### Scenario: Another firm's document
- **WHEN** a lawyer at Acme requests a document that belongs to another firm's client
- **THEN** the request is refused and no file or file link is returned

#### Scenario: Direct database access
- **WHEN** a lawyer uses their own login to query client records directly, outside the app
- **THEN** only their own firm's client records are returned

#### Scenario: Lawyer removed from firm
- **WHEN** the owner removes a lawyer from a firm
- **THEN** that lawyer immediately loses access to the firm's dashboard and clients

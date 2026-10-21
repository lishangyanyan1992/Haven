# Spec Delta

## Purpose

Gives each law firm one shareable link that brings its clients into Haven, ties each client to that firm, and tells them what the firm will see.

## ADDED Requirements

### Requirement: Each firm has one intake link
Each firm SHALL have exactly one working intake link at a time. The link SHALL be hard to guess and SHALL identify only the firm, not any client.

#### Scenario: Copying the link
- **WHEN** a lawyer clicks "Copy intake link" on the dashboard
- **THEN** the firm's link is copied, ready to paste into an email, text or chat

#### Scenario: Guessing a link
- **WHEN** someone opens an intake address made up of random characters
- **THEN** they see a page saying the link isn't valid, and it doesn't reveal any firm name

### Requirement: Lawyers can turn the link off and on
A lawyer SHALL be able to turn the firm's link off and turn it back on. While the link is off, opening it SHALL NOT let anyone join.

#### Scenario: Link turned off
- **WHEN** a lawyer turns the link off and a client then opens it
- **THEN** the client sees that the link isn't active and is told to contact their lawyer

#### Scenario: Link turned back on
- **WHEN** the lawyer turns the same link back on
- **THEN** the same address works again

### Requirement: Lawyers can replace the link
A lawyer SHALL be able to replace the firm's link with a new one. The old link SHALL stop working immediately and permanently. Clients who already joined SHALL keep their access.

#### Scenario: Replacing a leaked link
- **WHEN** a lawyer replaces the link
- **THEN** the old address shows "this link isn't valid", and the dashboard shows the new link

#### Scenario: Existing clients after replacement
- **WHEN** a client who joined through the old link signs in after the replacement
- **THEN** they still have access and still belong to the firm

### Requirement: The link page names the firm and the sharing
A working link SHALL open a page that names the inviting firm and says, before the client enters anything, that their setup answers and documents will be shared with that firm and that their chats with Haven stay private.

#### Scenario: Opening a working link
- **WHEN** a client opens Acme's working link
- **THEN** they see "Invited by Acme Immigration Law" and the sharing notice above the email box

### Requirement: Joining requires confirming the email
On a working link, the client SHALL enter their email, and Haven SHALL email that address a sign-up link. The client SHALL join the firm only after opening that emailed link. Haven SHALL show the same reply whatever email was entered.

#### Scenario: New client
- **WHEN** a client enters a new email on Acme's link
- **THEN** Haven emails a sign-up link to that address, and the dashboard lists them as "email sent"

#### Scenario: Confirming the email
- **WHEN** the client opens the emailed link and sets a password
- **THEN** they are on the invite list, belong to Acme, and are taken to setup

#### Scenario: Someone else's email
- **WHEN** a visitor enters an email they don't own
- **THEN** no access is granted unless the owner of that mailbox opens the emailed link

### Requirement: A client belongs to one firm
A client SHALL belong to at most one firm. Entering an email that already belongs to another firm, or that belongs to a lawyer, SHALL NOT move it or reveal anything, and SHALL get the same reply as any other email.

#### Scenario: Client of another firm
- **WHEN** a client of Beta Law enters their email on Acme's link
- **THEN** they stay with Beta Law, Acme sees nothing, and the page shows the usual reply

#### Scenario: Returning client of the same firm
- **WHEN** a client who already finished joining Acme enters their email on Acme's link again
- **THEN** they are emailed a way to sign in, and nothing about their firm changes

### Requirement: The link can't be used to flood inboxes
The system SHALL limit how many sign-up emails a single link, a single visitor and a single email address can trigger in a period of time. Requests over a limit SHALL get the usual reply but send no email.

#### Scenario: Same email entered many times
- **WHEN** the same email is entered on a link many times in a few minutes
- **THEN** only the first few send an email, and the rest send nothing

#### Scenario: Link used for a flood
- **WHEN** a single link triggers far more sign-up emails in a day than a firm would normally send
- **THEN** further sends from that link pause for the rest of the day

### Requirement: Setup repeats the sharing notice
During setup and on the document page, a firm client SHALL see a short reminder that their answers and documents are shared with their firm.

#### Scenario: Setup step
- **WHEN** an Acme client is on any setup step
- **THEN** a line says their answers are shared with Acme Immigration Law

### Requirement: Firm clients can upload documents
Clients who belong to a firm SHALL be able to use the document page to upload documents, even while document upload is otherwise limited to a test list.

#### Scenario: Firm client opens documents
- **WHEN** an Acme client who isn't on the test list opens the document page
- **THEN** they can upload documents and see their list

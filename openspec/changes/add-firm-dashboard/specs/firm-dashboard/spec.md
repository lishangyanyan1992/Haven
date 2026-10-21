# Spec Delta

## Purpose

Gives lawyers one place to see every client who joined through their firm's link, how far along each one is, and what each one shared.

## ADDED Requirements

### Requirement: Dashboard lists the firm's clients
The dashboard SHALL list every client of the lawyer's firm with name, visa type, status, number of documents and the date they joined, newest first. Before a client has entered a name, their email SHALL be shown instead.

#### Scenario: Several clients
- **WHEN** a lawyer at Acme opens the dashboard
- **THEN** they see every Acme client with those five details, newest first

#### Scenario: No clients yet
- **WHEN** a firm has no clients
- **THEN** the dashboard says so and shows the intake link with a short explanation of how to share it

### Requirement: Each client shows where they are
Each client SHALL show exactly one status. "Email sent" means they entered their email but haven't confirmed it. "Signed up" means they have an account but haven't saved any setup step. "In progress" means some but not all setup steps are saved. "Finished" means every setup step is saved.

#### Scenario: Client who only entered an email
- **WHEN** a client entered their email on the link but never opened the emailed link
- **THEN** they show as "Email sent"

#### Scenario: Client partway through setup
- **WHEN** a client has saved two of the four setup steps
- **THEN** they show as "In progress"

#### Scenario: Client who finished
- **WHEN** a client saves the last setup step
- **THEN** they show as "Finished"

### Requirement: Finished clients are marked New until opened
A client SHALL be marked "New" from the moment they finish setup until any lawyer at the firm opens their page. The dashboard SHALL show how many clients are New. No email SHALL be sent to lawyers.

#### Scenario: Client just finished
- **WHEN** a client finishes setup
- **THEN** they show a "New" badge on the dashboard, and the New count goes up by one

#### Scenario: A lawyer opens the client
- **WHEN** any lawyer at the firm opens that client's page
- **THEN** the badge disappears for every lawyer at the firm, and the New count goes down by one

### Requirement: Client page shows setup answers
Opening a client SHALL show their setup answers in plain labels: visa, country of birth, employer, key dates, green card stage and priority date, and the situation they described. Answers they skipped SHALL show as not provided.

#### Scenario: Finished client
- **WHEN** a lawyer opens a finished client
- **THEN** every setup answer is shown, grouped the way the setup steps group them

#### Scenario: Client still in progress
- **WHEN** a lawyer opens a client who saved only the first step
- **THEN** that step's answers are shown, and the rest show as not provided

### Requirement: Client page shows documents
The client page SHALL list the client's uploaded documents with name, type and upload date. A lawyer SHALL be able to open each one through a link that expires shortly after it's created.

#### Scenario: Opening a document
- **WHEN** a lawyer clicks a client's document
- **THEN** it opens in a new tab, and the same link stops working a few minutes later

#### Scenario: Client deletes a document
- **WHEN** a client deletes a document they uploaded
- **THEN** it no longer appears on their page in the firm dashboard

### Requirement: Client chats stay private
The firm dashboard SHALL NOT show, count, summarise or link to a client's chats with Haven, or anything Haven remembered from those chats.

#### Scenario: Client page
- **WHEN** a lawyer opens a client who has asked Haven many questions
- **THEN** nothing from those chats appears anywhere in the dashboard

### Requirement: Dashboard shows the link controls
The dashboard SHALL show the firm's intake link with buttons to copy it, turn it off or on, and replace it. Replacing it SHALL ask for confirmation, saying the old link will stop working.

#### Scenario: Replacing from the dashboard
- **WHEN** a lawyer clicks "Replace link"
- **THEN** they're asked to confirm, and after confirming the new link is shown in place of the old one

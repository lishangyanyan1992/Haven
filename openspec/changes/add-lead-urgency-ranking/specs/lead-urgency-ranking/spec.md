# Spec Delta

## Purpose

Orders a firm's clients by how soon something runs out for them, using fixed rules on the client's own deadline answers, and tells the lawyer why each client sits where it does.

## ADDED Requirements

### Requirement: Each client gets one urgency tier
Each client SHALL get exactly one tier from their soonest date: URGENT, SOON, LATER or UNKNOWN. The dates considered are the status end date, the grace-period end (60 days after the last day of work), the agency deadline and the travel date. The tier SHALL be computed by fixed rules, never by an AI model.

#### Scenario: Agency deadline in 12 days
- **WHEN** a client's request-for-evidence deadline is 12 days away
- **THEN** they are URGENT

#### Scenario: Status ends in 85 days
- **WHEN** a client's only date is a status end 85 days away
- **THEN** they are SOON

#### Scenario: No dates
- **WHEN** a client gave no deadline dates or answered "not sure"
- **THEN** they are UNKNOWN

### Requirement: Tier cutoffs
A client SHALL be URGENT when an agency deadline or travel date is 14 days away or less, the grace period ends in 15 days or less, the status ends in 30 days or less, or a status end, grace-period end or agency deadline has already passed. A travel date that has passed SHALL be ignored, since the trip is over. Otherwise they SHALL be SOON when any date is 90 days away or less, and LATER when they have only dates further out.

#### Scenario: Grace period boundary
- **WHEN** a client's last day of work was 45 days ago, so the grace period ends in 15 days
- **THEN** they are URGENT, and at 16 days they are SOON

#### Scenario: Status end boundary
- **WHEN** a client's status ends in exactly 30 days
- **THEN** they are URGENT, and at 31 days they are SOON

#### Scenario: Date already passed
- **WHEN** a client's status end date was 5 days ago
- **THEN** they are URGENT, and the reason says it ended 5 days ago

#### Scenario: Past travel
- **WHEN** a client's only date is travel that was 3 days ago
- **THEN** they are UNKNOWN, since the trip is over

#### Scenario: Only a far date
- **WHEN** a client's only date is travel 200 days away
- **THEN** they are LATER

### Requirement: Dashboard is sorted by urgency
The client list SHALL be sorted by tier (URGENT, SOON, LATER, UNKNOWN), then by fewest days left, then newest first. Clients still at "email sent" SHALL sort after everyone else.

#### Scenario: Mixed list
- **WHEN** a firm has an URGENT client with 12 days left, an URGENT client with 3 days left, a SOON client and an UNKNOWN client
- **THEN** the list shows the 3-day client, then the 12-day client, then SOON, then UNKNOWN

### Requirement: Every client shows a one-line reason
Each client on the dashboard SHALL show their tier and a one-line reason naming the soonest date and what it is, with the days left or days past. UNKNOWN clients SHALL show "No dates given, ask about deadlines".

#### Scenario: Laid-off client
- **WHEN** a client's last day of work was Sep 10 and today is Oct 22
- **THEN** the reason reads "Laid off Sep 10, grace period ends Nov 9 (18 days)"

#### Scenario: Several dates
- **WHEN** a client has a status end in 80 days and travel in 10 days
- **THEN** the reason names the travel date, since it is soonest

### Requirement: The ranking is labelled as a heads-up
The dashboard SHALL say, once and near the list, that tiers come from the dates the client entered and are a heads-up, not a legal calculation. The client page SHALL show every deadline answer the client gave.

#### Scenario: Lawyer opens the dashboard
- **WHEN** a lawyer opens the firm dashboard
- **THEN** the note is visible near the client list

#### Scenario: Lawyer opens a client
- **WHEN** a lawyer opens a client who gave a status end date and a travel date
- **THEN** both dates appear in a Deadlines section on the client page

### Requirement: Ranking uses only the firm's shared answers
Tiers and reasons SHALL be computed only from the firm's shared copy of the client's answers, so they never reveal anything from the client's chats.

#### Scenario: Deadline said only in chat
- **WHEN** a client mentions an interview date only in the chat
- **THEN** their tier and reason do not change

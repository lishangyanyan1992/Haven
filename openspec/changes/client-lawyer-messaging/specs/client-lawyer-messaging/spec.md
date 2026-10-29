# Spec Delta

## Purpose

Gives a firm's client and that firm's lawyers one private conversation inside Haven, started from onboarding and continued from either dashboard, with email alerts that never carry the message itself.

## ADDED Requirements

### Requirement: One conversation per client per firm
Each client SHALL have at most one conversation with each firm they are connected to. Direct messages in it SHALL be visible only to the client and to members of that firm.

#### Scenario: Client connected to two firms
- **WHEN** a client connected to Firm A and Firm B writes to Firm A
- **THEN** Firm A's members see the message and Firm B's members do not

#### Scenario: Another firm's lawyer tries to read
- **WHEN** a lawyer from a firm the client is not connected to requests that conversation
- **THEN** nothing is returned

### Requirement: Onboarding open box starts the conversation
Onboarding SHALL show an optional box, "What would you like your lawyer to know or answer?", after the help question. If the client writes in it, the text SHALL become the first message from the client to each firm they are onboarding with.

#### Scenario: Client writes a question
- **WHEN** a client types "Can I start a new job before my H-1B transfer is approved?" and finishes onboarding
- **THEN** that firm's conversation with the client starts with this message, marked as sent during onboarding

#### Scenario: Client leaves it blank
- **WHEN** the client leaves the box empty
- **THEN** no conversation message is created

#### Scenario: Client goes back and edits before finishing
- **WHEN** the client edits the box and then finishes onboarding
- **THEN** only the final text is sent, once

### Requirement: Client dashboard shows a Messages call to action directing to Ask
The client dashboard SHALL show a "Messages with your lawyer" call-to-action card for connected firms, displaying unread indicators or the latest message preview and a call-to-action button that directs the client to Ask (`/advisor`) to read and send messages.

#### Scenario: Client clicks dashboard CTA
- **WHEN** a firm client clicks the "Messages with your lawyer" call to action on their dashboard
- **THEN** they are directed to `/advisor` where their ongoing conversation with their lawyer is shown

#### Scenario: Client sends a follow-up in Ask
- **WHEN** the client sends "I uploaded my I-797 now" in `/advisor`
- **THEN** the message appears at the end of the lawyer conversation with the client as sender

### Requirement: Lawyer reads and replies from the client's page
The client's page on the firm dashboard SHALL show the conversation and let any member of the firm reply. Each lawyer message SHALL show the sending lawyer's name.

#### Scenario: Lawyer replies
- **WHEN** a lawyer replies "Yes, once the petition is filed you can start"
- **THEN** the client sees the reply with the lawyer's name and time

### Requirement: Message limits
A message SHALL be between 1 and 5,000 characters after trimming. Messages SHALL be plain text. Sent messages SHALL NOT be editable or deletable by either side in this change.

#### Scenario: Empty message
- **WHEN** someone tries to send only spaces
- **THEN** nothing is sent and the send button stays disabled

#### Scenario: Too long
- **WHEN** someone pastes 6,000 characters
- **THEN** they are told the limit and nothing is sent

### Requirement: Unread markers
Each side SHALL see which messages they have not read. The firm's leads list SHALL mark clients with unread client messages and SHALL offer a filter for them. Opening the conversation SHALL mark its messages read for that side.

#### Scenario: New client message
- **WHEN** a client sends a message
- **THEN** the client's row on the firm's leads list shows an unread marker until a lawyer from that firm opens the conversation

#### Scenario: One lawyer reads, marker clears for the firm
- **WHEN** one lawyer at the firm opens the conversation
- **THEN** the unread marker clears for the whole firm

### Requirement: Email alerts without message content
When a client sends a message, each member of that firm SHALL be emailed. When a lawyer sends a message, the client SHALL be emailed. The email SHALL say there is a new message, name the firm or client, and link to the conversation. It SHALL NOT contain any message text.

#### Scenario: Lawyer replies
- **WHEN** a lawyer replies to a client
- **THEN** the client gets an email "You have a new message from [firm]" with a link, and no part of the reply

### Requirement: Alerts are batched
At most one alert email SHALL be sent per recipient per conversation within 15 minutes. If the recipient has opened the conversation since the last alert, the window SHALL reset so the next new message alerts them again.

#### Scenario: Burst of messages
- **WHEN** a client sends four messages within five minutes
- **THEN** each lawyer at the firm receives one email

#### Scenario: Lawyer read, then a new message
- **WHEN** a lawyer is alerted, opens the conversation, and the client writes again three minutes later
- **THEN** the lawyer receives a new alert

### Requirement: Contact requests and engagement are unchanged
Sending a message SHALL NOT change the client's urgency tier, pipeline stage, or contact request state.

#### Scenario: Client sends a message
- **WHEN** a client at any pipeline stage sends a message
- **THEN** their stage and urgency stay the same

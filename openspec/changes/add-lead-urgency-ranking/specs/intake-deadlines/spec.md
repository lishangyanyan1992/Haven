# Spec Delta

## Purpose

Collects the dates that decide how urgent a client's case is, during setup and once for clients who already finished, and shares them with the client's firm.

## ADDED Requirements

### Requirement: Setup asks about deadlines
Setup SHALL include a fifth step, "Your deadlines", after the current four. It SHALL ask when the client's status ends, whether their job has ended or is about to and the last day of work, any deadline from USCIS or a consulate with its type and date, and any upcoming travel outside the US with its date.

#### Scenario: Reaching the new step
- **WHEN** a client saves the fourth setup step
- **THEN** they see "Your deadlines" as step 5 of 5

#### Scenario: Agency deadline types
- **WHEN** a client says they have a deadline from USCIS or a consulate
- **THEN** they can choose request for evidence, interview, biometrics or other, and enter its date

### Requirement: Every deadline answer is optional
Each deadline question SHALL be optional. The status-end question SHALL offer "not sure". A date SHALL be asked for only after the client says the matching event applies.

#### Scenario: Client skips everything
- **WHEN** a client leaves every deadline question blank and finishes setup
- **THEN** setup completes and nothing is recorded as a deadline

#### Scenario: Job hasn't ended
- **WHEN** a client answers that their job hasn't ended
- **THEN** no last-day-of-work date is asked for or stored

### Requirement: Finishing setup happens on the deadline step
Setup SHALL count as finished when the client completes the deadline step. Their firm SHALL see them as Finished, and as New, from that moment.

#### Scenario: Completing step 5
- **WHEN** a firm client completes the deadline step
- **THEN** they land on the chat, and their firm's dashboard shows them as Finished and New

### Requirement: Deadline answers are shared with the firm and not with the chat
Deadline answers SHALL be shared with the client's firm in the same way as the other setup answers, and SHALL change only when the client answers or edits them through setup or the deadline prompt. Nothing said in the chat SHALL change them.

#### Scenario: Client mentions a layoff in the chat
- **WHEN** a client who said their job hasn't ended later tells the chat they were laid off
- **THEN** the firm still sees "job hasn't ended" until the client updates the deadline answers themselves

#### Scenario: Client clears a date
- **WHEN** a client removes their travel date and saves
- **THEN** the firm no longer sees a travel date

### Requirement: Clients who finished earlier are asked once
A client who finished setup before the deadline step existed SHALL be shown the deadline questions once, at their next sign-in, with a way to skip. After they answer or skip, they SHALL NOT be shown the prompt again.

#### Scenario: Next sign-in
- **WHEN** a client who finished setup last month signs in
- **THEN** they see the deadline questions before reaching the chat

#### Scenario: Skipping
- **WHEN** that client chooses to skip
- **THEN** they go to the chat, and later sign-ins go straight to the chat

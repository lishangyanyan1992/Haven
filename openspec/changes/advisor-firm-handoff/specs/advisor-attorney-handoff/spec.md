# Spec Delta

## Purpose

Defines what the advisor offers when an answer recommends counsel: where it points the person, what it tells them to bring and ask, and how a firm relationship changes the destination and the wording.

## ADDED Requirements

### Requirement: Handoff appears when an answer recommends counsel
When a delivered answer recommends that the person speak to, consult, or hire an attorney, the advisor SHALL append a handoff block containing a destination, the person's own relevant dates to bring, and questions worth asking. An answer that does not recommend counsel SHALL NOT carry a handoff.

#### Scenario: Answer recommends counsel
- **WHEN** the answer says the person should consult an immigration attorney about a layoff
- **THEN** a handoff block follows the answer with a destination, a "take with you" list built from the person's dates, and layoff-specific questions

#### Scenario: Answer does not recommend counsel
- **WHEN** the answer explains how the grace period works without recommending counsel
- **THEN** no handoff block is shown

### Requirement: Handoff is shown once per conversation
The advisor SHALL NOT repeat the handoff block in a conversation where it has already been delivered.

#### Scenario: Second recommendation in the same conversation
- **WHEN** a later answer in the same conversation also recommends counsel
- **THEN** no second handoff block is appended

### Requirement: Firm clients are pointed to their own firm
When the person is linked to a firm, the handoff SHALL name that firm as the destination. It SHALL NOT include a link to the firm directory, a suggestion to look for or compare other firms, or the directory's not-a-referral note.

#### Scenario: Firm client receives a handoff
- **WHEN** a client of a firm named "Rivera Immigration Law" gets an answer recommending counsel
- **THEN** the handoff names Rivera Immigration Law and contains no directory link and no suggestion to find another firm

#### Scenario: Directory is live
- **WHEN** the firm directory is publicly available and the person is a firm client
- **THEN** the handoff still contains no directory link

### Requirement: Wording reflects whether the firm represents the person
For a firm client whose pipeline stage is contract signed, the handoff SHALL refer to the firm as their lawyer, as in "your lawyer at [firm]". At every other stage, the handoff SHALL refer to "the firm that invited you, [firm]" and SHALL NOT describe the firm as the person's lawyer or attorney.

#### Scenario: New lead
- **WHEN** a firm client at the new-lead stage receives a handoff
- **THEN** it says "the firm that invited you, [firm]" and does not say "your lawyer" or "your attorney"

#### Scenario: Contract signed
- **WHEN** a firm client at the contract-signed stage receives a handoff
- **THEN** it says "your lawyer at [firm]"

#### Scenario: Stage changes between answers
- **WHEN** the firm moves a person to contract signed and the person then receives a handoff in a new conversation
- **THEN** the handoff uses "your lawyer at [firm]"

### Requirement: Firm clients are offered a contact request
For a firm client, the handoff SHALL offer an action to ask the firm to contact them. If an unhandled request from that person to that firm already exists, the action SHALL show that it was already sent, with when, instead of offering to send another.

#### Scenario: No open request
- **WHEN** a firm client with no open contact request receives a handoff
- **THEN** the handoff offers "Let [firm] know"

#### Scenario: Request already open
- **WHEN** a firm client who sent a request yesterday, not yet handled, receives a handoff
- **THEN** the handoff shows the request was sent yesterday and offers no second send

### Requirement: People without a firm keep the directory handoff
When the person is not linked to any firm, the handoff SHALL point to the firm directory filtered to the practice area when the directory is available, or describe what kind of firm to look for when it is not, and SHALL NOT offer a contact request.

#### Scenario: Owner-invited user
- **WHEN** a person invited directly by the owner, with no firm, receives a handoff
- **THEN** it links to the directory filtered to the practice area and offers no contact request

### Requirement: Unknown firm membership never shows the directory
If the advisor cannot determine whether the person belongs to a firm, the handoff SHALL omit both the directory link and the contact request, and keep the dates to bring and the questions to ask.

#### Scenario: Membership lookup fails
- **WHEN** the firm lookup errors while answering
- **THEN** the handoff contains no directory link and no contact request, and still lists dates and questions

### Requirement: Advisor wording for firm clients
For a firm client, the answer itself SHALL NOT tell the person to find, hire, retain, or shop for an attorney. Where it recommends counsel, it SHALL refer to their firm using the same stage-based wording as the handoff.

#### Scenario: Firm client asks whether they need a lawyer
- **WHEN** a firm client at the consultation-scheduled stage asks "Should I get a lawyer for this?"
- **THEN** the answer refers them to the firm that invited them and does not suggest finding another attorney

### Requirement: Advisor defers to the firm on case-specific conflicts
When a firm client reports that their firm told them something that differs from the general rule, the advisor SHALL explain the general rule, state that their own situation may differ, and refer the specific decision back to the firm. It SHALL NOT say the firm is wrong.

#### Scenario: Conflicting travel advice
- **WHEN** a firm client says "My lawyer said I can't travel, but I read I can with advance parole"
- **THEN** the answer explains when advance parole applies, says their firm knows their case, and does not say the lawyer is mistaken

# Spec Delta

## Purpose

Defines how every fact on the user dashboard is resolved from the user's current input, which source wins when sources disagree, and how contradictions are surfaced to the user instead of hidden.

## ADDED Requirements

### Requirement: Single Resolved Value Per Dashboard Fact
The system SHALL resolve each dashboard fact (green card stage, effective priority date, job-change protection, layoff readiness, green card wait estimate, status end date) exactly once per dashboard load, and every dashboard card, the timeline, the planner and the advisor context SHALL display that same resolved value.

#### Scenario: Protection shown the same everywhere
- **WHEN** a user's approved I-140 passed its 180-day mark
- **THEN** the overview card, the green card track and the planner all describe job-change protection as unlocked, with the same sponsor and date

#### Scenario: Wait estimate uses the effective priority date
- **WHEN** a user has a retained priority date from a prior employer's approved I-140 and no priority date on the current profile field
- **THEN** the wait estimate and the green card track both use the retained priority date

### Requirement: Current Input Overrides Stored Results
The system SHALL compute dashboard facts from the user's current saved input. Previously stored results SHALL NOT override a value that can be computed from current input, and stored results SHALL be refreshed whenever the user's profile, deadlines or petitions are saved.

#### Scenario: Stale stored protection is ignored
- **WHEN** the stored result says job-change protection is "available after Sep 21, 2026", today is after that date, and the approved I-140 is still on file
- **THEN** the dashboard shows protection as unlocked

#### Scenario: Stored results refresh on save
- **WHEN** a user saves a change to any green card petition or profile field
- **THEN** the stored results are recalculated from the saved input before the next dashboard load

### Requirement: Priority Date Section Visibility
The system SHALL show the priority date and wait estimate section whenever the user has an effective priority date from any petition or retained priority date, regardless of the current employer's I-140 status.

#### Scenario: Retained date with no current I-140
- **WHEN** the user's current employer has no approved I-140 but an earlier employer's I-140 is approved
- **THEN** the priority date section is shown using the retained priority date and names the earlier sponsor

### Requirement: Contradiction Detection
The system SHALL check user input for contradictions each time the dashboard is built. For each one it SHALL show a plain "Check this" note naming the two conflicting answers, with a link to fix them, and SHALL NOT silently pick one answer.

#### Scenario: PERM stage disagreement
- **WHEN** the profile says PERM has not started and the current employer's petition says prevailing wage or recruitment is in progress
- **THEN** the dashboard shows a "Check this" note naming both answers and does not show a conflicting stage on the green card track

#### Scenario: Petition still active after layoff
- **WHEN** the user is marked laid off from an employer whose petition is still marked in progress
- **THEN** the dashboard asks whether that green card ended, with a one-click option to mark it ended at the layoff date

#### Scenario: No contradictions
- **WHEN** all inputs agree
- **THEN** no "Check this" notes are shown

### Requirement: Contradictions Checked
The contradiction check SHALL cover at least: the I-140 approved answer versus petition records; the PERM stage versus the current employer's petition; a petition priority date before PERM is filed and not marked carried over; a petition still in progress for an employer the user was laid off from; an I-140 approval date before the PERM filing date; and a status end date before the layoff date.

#### Scenario: I-140 answer disagrees with petitions
- **WHEN** the profile says I-140 approved but no petition record is approved
- **THEN** a "Check this" note is shown for that pair

#### Scenario: Status end before layoff
- **WHEN** the status end date is earlier than the layoff date
- **THEN** a "Check this" note is shown for those two dates

### Requirement: Contradiction Checks Covered By Tests
The system SHALL include automated checks that build the dashboard from fixed sample profiles, including a two-employer case with one approved and one ended petition, and fail if any two dashboard surfaces show different values for the same fact.

#### Scenario: Two-employer sample stays consistent
- **WHEN** the tests build the dashboard for a sample user with an approved Northwind Mutual I-140 and an ended Harbor Ventures petition
- **THEN** every surface reports the same stage, priority date, sponsor and protection status

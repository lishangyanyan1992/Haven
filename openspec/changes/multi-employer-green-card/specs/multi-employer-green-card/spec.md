# Spec Delta

## Purpose

Enables accurate tracking and visualization of multiple employment-based immigrant petitions across different sponsoring employers, enforcing priority date retention under 8 CFR § 204.5(e) and AC21 extension protections.

## ADDED Requirements

### Requirement: Retained Priority Date Preservation Across Employers
The system SHALL preserve an unrevoked approved Form I-140 priority date as the beneficiary's retained priority date under 8 CFR § 204.5(e), independent of whether the beneficiary changes sponsoring employers or starts a new green card application.

#### Scenario: Beneficiary changes employers after I-140 approval
- **WHEN** an immigrant profile contains an approved Form I-140 from a prior sponsor and an in-progress PERM or I-140 with a current employer
- **THEN** the system retains the prior approved priority date as the legal queue anchor and uses it for Visa Bulletin position calculations.

### Requirement: AC21 Extension Eligibility Decoupling
The system SHALL evaluate AC21 § 104(c) 3-year H-1B extension eligibility using any qualified prior approved Form I-140, even when the current employer has not yet certified a PERM or filed a new Form I-140.

#### Scenario: H-1B extension unlocked despite pending PERM
- **WHEN** an H-1B beneficiary approaches the 6-year statutory cap with a pending PERM at their current employer but holds an approved Form I-140 from a previous employer
- **THEN** the system marks AC21 3-year extension eligibility as unlocked and reflects the protection in the journey status.

### Requirement: Priority Date Recapturing Tracking
The system SHALL track priority date recapturing when a new sponsoring employer prepares, files, or receives approval for a subsequent Form I-140.

#### Scenario: Subsequent Form I-140 filed with priority date recapture request
- **WHEN** a new employer files Form I-140 referencing an earlier approved Form I-140 receipt notice
- **THEN** the system links the retained priority date to the new petition and marks the recapture status as active.

### Requirement: Concurrent Immigrant Petition Evaluation
The system SHALL evaluate multiple active immigrant petitions simultaneously, including concurrent employer petitions and self-petitions (such as EB-2 NIW or EB-1A), maintaining independent lifecycle stages for each.

#### Scenario: Active employer PERM with concurrent approved EB-2 NIW
- **WHEN** a profile contains both an active employer-sponsored PERM petition and an approved EB-2 NIW self-petition
- **THEN** the system tracks both petition lifecycles independently and highlights the fastest path to Form I-485 adjustment of status.

### Requirement: Green Card Track Multi-Petition Presentation
The system SHALL present both the retained priority date queue standing and active sponsor petition progress within the Green Card journey track.

#### Scenario: Dashboard displays retained priority date with current petition progress
- **WHEN** the dashboard renders Track 2 for a profile with a prior approved I-140 and a current employer PERM
- **THEN** the track displays a retained priority date callout identifying the prior sponsor, alongside the active employer's PERM stage progress node.

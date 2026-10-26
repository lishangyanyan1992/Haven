# Proposal

## Why

In employment-based immigration (EB-2 and EB-3), green card petitions are legally tied to a specific sponsoring employer, but an immigrant worker's queue place (Priority Date) belongs to the individual once Form I-140 is approved under 8 CFR § 204.5(e). Most experienced foreign workers in the United States navigate a multi-employer green card lifecycle: they possess an approved I-140 and locked-in Priority Date from a prior employer (unlocking indefinite 3-year H-1B extensions under AC21 § 104(c)), while simultaneously pursuing a new Prevailing Wage, PERM, and I-140 petition with their current employer to recapture that priority date and eventually adjust status (Form I-485).

Currently, Haven collapses green card data into a single linear sequence (`permStage -> i140Approved -> priorityDate -> bulletin_queue -> i485Filed`) assumed to belong to one employer. This creates a data contradiction: if a user marks `i140Approved: false` because their current employer is still running PERM recruitment, Haven drops their locked-in 2021 priority date, marks them ineligible for AC21 H-1B extensions, and distorts their Visa Bulletin wait estimate. Conversely, if they mark `i140Approved: true`, Haven assumes their current employer's petition is approved and ready for I-485 filing.

Haven needs first-class modeling for multi-employer green card petitions. This separates legal queue standing (retained priority dates) from active employer-sponsored petition workflows, supports concurrent petitions (such as EB-2 NIW self-petitions), and provides accurate risk and readiness calculations across job transitions.

## What Changes

- **Separation of Retained Priority Date from Active Petition**:
  - Add explicit modeling for a `retainedPriorityDate` anchored by a previously approved I-140 (including prior sponsor name, original category, and approval date).
  - Preserve the user's permanent queue position on the Visa Bulletin independent of active PERM/I-140 stages at their current employer.
- **Multi-Petition Lifecycle Modeling**:
  - Model individual immigrant petitions as discrete records (`prior_approved`, `active_employer_sponsored`, `concurrent_self_petition`).
  - Track current employer PERM/I-140 stages without overwriting prior approved I-140 protections.
  - Automatically flag priority date recapture eligibility under 8 CFR § 204.5(e) when the current employer files Form I-140.
- **Concurrent Petition Support**:
  - Support dual-track green card paths (e.g., employer-sponsored EB-2 PERM running concurrently with an EB-2 NIW self-petition or an EB-1A extraordinary ability petition).
  - Show which petition is currently closest to filing Form I-485.
- **Accurate AC21 Protection & Portability Calculation**:
  - Decouple H-1B extension eligibility (AC21 § 104(c) 3-year extensions) from the current employer's PERM progress, recognizing that any unrevoked approved I-140 held for 180+ days provides continuous extension validity.
  - Clarify I-485 Supplement J portability rules when an adjustment application has been pending for 180+ days versus when a full PERM restart is required.
- **Journey Timeline & Dashboard Integration**:
  - Update Track 2 (`Track 2 · Green Card & Immigrant Petition`) to display both the locked-in priority date banner and the active sponsoring employer's step progression.
  - Provide an expandable "Petitions & Sponsors" breakdown detailing each petition's status, sponsor, receipt numbers, and regulatory protections.

## Capabilities

### New Capabilities
- `multi-employer-green-card`: Defines data schemas, regulatory logic, and timeline presentation for tracking multiple immigrant petitions, priority date retention under 8 CFR § 204.5(e), concurrent filings, and AC21 portability across employers.

### Modified Capabilities
None.

## Impact

- `apps/haven/src/types/domain.ts`: Extend `ImmigrationProfile` to support `retainedPriorityDate`, `priorI140Approvals`, and structured `immigrantPetitions`.
- `apps/haven/src/lib/immigration-journey.ts`: Update `inferProfileGreenCardStage()` and `buildImmigrationJourney()` to evaluate multi-employer petitions, compute priority date recapturing, and maintain AC21 extension protections.
- `apps/haven/src/components/app/immigration-journey-dashboard.tsx`: Render dual-sponsor metadata, recaptured priority date callouts, and petition cards within Track 2.
- `apps/haven/evals/firms/case-dashboard.check.ts`: Add test cases validating multi-employer priority date retention, AC21 extension eligibility with pending PERM, and concurrent petition handling.

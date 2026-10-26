# Design

## Context

Haven currently tracks an immigrant user's permanent residency pathway using scalar fields on `ImmigrationProfile`: `permStage`, `permFilingDate`, `i140Approved`, `i140ApprovalDate`, `priorityDate`, and `preferenceCategory`. See [proposal.md](./proposal.md) for background and motivation.

When an employee changes employers, their permanent residency journey splits into two distinct legal threads:
1. **The Retained Immigrant Queue Standing**: Under 8 CFR § 204.5(e), an approved Form I-140 grants the beneficiary a permanent, portable Priority Date that can be recaptured by any future employer. Under AC21 § 104(c), this approved petition also entitles the worker to indefinite 3-year H-1B extensions beyond the statutory 6-year limit, regardless of whether their current employer has started PERM.
2. **The Active Sponsoring Employer Petition**: The current employer must still file a PERM labor certification and a new Form I-140 to establish a qualifying future job offer. The beneficiary cannot file Form I-485 (Adjustment of Status) based on the prior employer's petition unless an I-485 was already pending for 180+ days (AC21 § 204(j)).

## Goals / Non-Goals

**Goals:**
- **First-Class Multi-Petition Model**: Support an array of `immigrantPetitions` on `ImmigrationProfile` while maintaining backward compatibility with legacy scalar fields.
- **Accurate Legal Protection Computation**: Evaluate AC21 3-year extension eligibility based on the existence of any unrevoked approved I-140 held for 180+ days, even if the active employer is only in Prevailing Wage or PERM recruitment.
- **Priority Date Recapture Resolution**: Compute the `effectivePriorityDate` by taking the earliest approved priority date across all petitions, and indicate whether the current active petition has successfully recaptured it.
- **Concurrent Petition Handling**: Support multiple active petitions (e.g., an employer PERM running alongside an EB-2 NIW self-petition), displaying independent progress milestones.
- **Visual Clarity on Track 2**: Present both the locked-in queue anchor (with prior sponsor name) and the active employer's stage nodes without cluttering the dashboard.

**Non-Goals:**
- Direct integration with USCIS or Department of Labor APIs (data is populated from user profile inputs and document vault uploads).
- Family-based petitions (Form I-130) or asylum applications.
- Automatic filing generation for Form I-485 Supplement J.

## Decisions

### 1. Additive Domain Model with Graceful Fallback
- **Choice**: Introduce a structured `ImmigrantPetition` interface and optional `immigrantPetitions?: ImmigrantPetition[]` and `retainedPriorityDate?: string` on `ImmigrationProfile`. If `immigrantPetitions` is omitted or empty, helper functions synthesize a default petition from legacy flat fields (`permStage`, `i140Approved`, `priorityDate`).
- **Rationale**: Preserves zero-migration backward compatibility for all existing tests, fixtures, and onboarding forms, while enabling multi-employer profiles immediately.
- **Alternatives Considered**: Deprecating scalar fields immediately was rejected because it would break existing test suites and form handlers across the app.

### 2. Priority Date Resolution Hierarchy
- **Choice**: The timeline calculation resolves `effectivePriorityDate` in the following order:
  1. `profile.retainedPriorityDate` (if explicitly provided as a locked-in date from a prior sponsor).
  2. Earliest priority date from any approved petition in `profile.immigrantPetitions`.
  3. Legacy `profile.priorityDate`.
  4. Active petition `permFilingDate`.
- **Rationale**: Ensures the Visa Bulletin comparison always evaluates the earliest legally valid priority date the user is entitled to under 8 CFR § 204.5(e).
- **Alternatives Considered**: Using only the active employer's priority date was rejected because it fails to capture the true bulletin queue position of experienced foreign workers.

### 3. AC21 3-Year Extension Protection Rule
- **Choice**: AC21 extension eligibility is resolved as:
  ```ts
  hasQualifyingI140 = profile.i140Approved || 
    (profile.immigrantPetitions?.some(p => (p.stage === "i140_approved" || p.stage === "i485_filed" || p.stage === "i485_approved") && !isPetitionWithdrawn(p)) ?? false);
  ```
  If `hasQualifyingI140` is true and the priority date is not current, the user is marked eligible for 3-year H-1B extensions beyond 6 years under AC21 § 104(c), regardless of their current employer's PERM progress.
- **Rationale**: Reflects USCIS policy memo and binding regulations where I-140 approval benefits are personal to the beneficiary for extension purposes.
- **Alternatives Considered**: Tying H-1B extension eligibility to the current employer's petition was rejected because it causes false warnings for workers transferring jobs during PERM.

### 4. 180-Day Revocation Defense Window Tracking
- **Choice**: Model `isRevocationProtected: boolean` on petitions. Under 8 CFR § 205.1(a)(3)(iii)(C)-(D), if an I-140 has been approved for 180 days or more, employer withdrawal does not revoke the priority date or H-1B extension validity. The engine checks `daysSinceApproval >= 180` and surfaces a protective notice.
- **Rationale**: One of the primary anxieties during a layoff or job transition is whether a former employer can cancel the green card queue. Visualizing this defense provides immense peace of mind.

### 5. UI Presentation on Track 2
- **Choice**: 
  - Track 2 headline and badge reflect both the locked-in queue date and the active petition status.
  - Stage nodes track the *active* employer's petition (`PERM -> I-140 -> I-485`), but the `Priority Date` node highlights the retained date with a `Retained from [Prior Sponsor]` tag.
  - A collapsible "Petitions & Sponsors" sub-card details all registered petitions (e.g. Prior Employer I-140, Current Employer PERM, Self-Petition NIW).
- **Rationale**: Keeps the primary 2-track dashboard clean while making the multi-employer context accessible on demand.

## Risks / Trade-offs

- **Risk: User enters conflicting categories between prior and current petition (e.g. EB-2 vs EB-3)**:
  - *Mitigation*: Track category on each petition. Default Visa Bulletin matching to the category of the petition closest to I-485 eligibility, and display a note explaining category porting rules.
- **Risk: Former employer withdrew petition before 180 days**:
  - *Mitigation*: Provide an explicit `withdrawalStatus` flag ("active", "withdrawn_after_180_days", "withdrawn_before_180_days") so users can accurately model edge cases.
- **Risk: Increased visual complexity on mobile screens**:
  - *Mitigation*: The collapsible "Petitions & Sponsors" section remains closed by default on small viewports, showing only the concise summary badge in the main track.

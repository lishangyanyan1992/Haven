# Proposal

## Why

Haven's intake and profile data structures currently assume an employment-based tech worker on an H-1B or OPT visa seeking an employer-sponsored green card through the PERM and Form I-140 process. Users holding visitor visas (B-1/B-2), student or exchange visas (F-1/J-1/M-1), intra-company or specialty work visas (L-1, TN, E-2, E-3, O-1), humanitarian statuses (TPS, DACA, Pending Asylum), or family/fiancé visas (K-1) are forced into mismatched options or blocked by mandatory employment and H-1B fields. Furthermore, green card intake excludes marriage-based and family-sponsored petitions, self-petitions (EB-2 NIW, EB-1A), EB-5, humanitarian pathways, and custom situations, and fails to capture sponsor attribution (such as prior employers, spouses, or self-sponsorship) during intake.

Expanding intake to universal visa and green card support allows any client or immigrant to accurately represent their status, avoids forcing irrelevant employment details on non-work statuses, and ensures that legal evaluations, timelines, and firm intake represent the complete factual picture.

## What Changes

- **Universal Visa Selection**: Replace the restricted 7-option visa dropdown with a categorized, searchable combobox covering visitor (B-1, B-2, B-1/B-2, ESTA), student & exchange (F-1, J-1, M-1, OPT, STEM OPT), employment & specialty (H-1B, H-1B1, H-4, H-4 EAD, L-1A/B, L-2, O-1A/B, O-2, TN, E-1/E-2/E-3, P, R), family (K-1, K-3), humanitarian (TPS, DACA, Humanitarian Parole, Pending Asylum, U/T Visa), permanent resident, and citizen.
- **Custom / Unlisted Status Write-in**: Provide an `"Other"` option that allows the user to write in any unlisted status, custom category, or I-94 class of admission without validation errors.
- **Adaptive Employment Flow**: Dynamically adapt Step 2 ("Employment"). For work-authorized employment visas (H-1B, L-1, TN, O-1, E-3), employment fields remain standard. For non-work, student, visitor, or family statuses, employment questions become conditional and optional ("Are you currently employed in the US?"), allowing users without US employment to proceed smoothly.
- **Universal Green Card Pathways**: Support all green card paths: Family & Marriage (Marriage to USC, Marriage to LPR, Parent/Child, Family Preference F1–F4), Employer-Sponsored (EB-1B/C, EB-2, EB-3), Self-Sponsored (EB-2 NIW, EB-1A), Investment (EB-5), Humanitarian (Asylum adjustment, VAWA, U/T, SIJS), Diversity Immigrant Visa (DV Lottery), and custom paths with free-form descriptions.
- **Dynamic Green Card Stages**: Adapt filing stages to the selected pathway (e.g. Form I-130 filed/approved, I-485 filed, Consular/NVC processing, 2-Year Conditional Green Card, I-751 removal of conditions) instead of forcing PERM / ETA-9089 on non-employer petitions.
- **Sponsor & Petitioner Attribution**: Explicitly collect the sponsoring or petitioning entity (current employer, prior employer, spouse, family member, self-petition, or other) for each green card record, enforcing Haven's core rule that green card petitions are never assumed to belong to the current employer.
- **Multi-Petition Support during Intake**: Allow users to enter prior approved petitions (such as a prior employer's I-140 locking in a priority date) alongside an active or concurrent petition.
- **Database & Schema Flexibility**: Alter Postgres columns `visa_type` and `preference_category` in `user_profiles` from rigid enum types to `text` (preserving all existing records and defaults) to cleanly support any standard or custom status string without runtime DB exceptions.
- **Firm Intake Compatibility**: Update preset question definitions and schemas in `intake-question-catalog.ts` and `firm_intake_questions` to support universal statuses and adaptive branching for law firm client intakes.

## Capabilities

### New Capabilities
- `universal-visa-intake`: Taxonomy, typeahead selection, custom status write-in, and adaptive/conditional employment branching for all visa categories.
- `universal-green-card-intake`: Pathway selection, dynamic stage mapping, explicit sponsor attribution, and multi-petition capture across family/marriage, employment, self-sponsored, investor, and humanitarian green cards.

### Modified Capabilities
None. Existing capability `firm-consultation-booking` does not have requirement changes; firm intake inherits the new universal catalog items.

## Impact

- **Database Migrations**: Add a migration altering `public.user_profiles.visa_type` and `public.user_profiles.preference_category` from enum types to `text`, and adding optional fields `custom_visa_detail` and `green_card_pathway`.
- **Domain Types (`apps/haven/src/types/domain.ts`)**: Expand `VisaType`, `ImmigrantPetitionType`, `PreferenceCategory`, and `GreenCardStage` to support the full taxonomy while accepting open strings (`string & {}`).
- **Onboarding Flow (`apps/haven/src/app/onboarding/OnboardingFlow.tsx`)**: Refactor Step 1 (Visa combobox + write-in), Step 2 (conditional employment), and Step 3 (pathway selector, dynamic stages, sponsor attribution, and multi-petition entry).
- **Settings & Profile (`apps/haven/src/app/settings/page.tsx`, `apps/haven/src/lib/profile-mapper.ts`)**: Enable viewing and editing all visa types, custom status names, and multi-pathway green cards in user settings.
- **Firm Intake Catalog (`apps/haven/src/lib/firms/intake-question-catalog.ts`)**: Update question presets and options to encompass all visa and green card pathways.
- **Testing & Evals**: Add evals verifying that non-work visas, marriage green cards, self-petitions, and custom write-ins save, read, and display correctly without validation errors.

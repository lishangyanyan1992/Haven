# Tasks

## 1. Database Schema & Data Models

- [x] 1.1 Create Supabase migration converting `user_profiles.visa_type` and `user_profiles.preference_category` from Postgres ENUMs to `text`, and verify migration applies cleanly without data loss.
- [x] 1.2 Expand TypeScript domain definitions in `apps/haven/src/types/domain.ts` for `VisaType`, `ImmigrantPetitionType`, `PreferenceCategory`, and `GreenCardStage` to support the universal taxonomy with open string extensibility, and verify `npm run build` type-checks.
- [x] 1.3 Add helper utilities in `apps/haven/src/lib/visas.ts` for categorized grouping, typeahead search, and checking work authorization (`isWorkAuthorizedVisa`), and verify unit tests cover standard and custom statuses.

## 2. Universal Visa Selection & Adaptive Employment Intake

- [x] 2.1 Build a categorized typeahead combobox in `apps/haven/src/app/onboarding/` supporting standard categories (Visitor, Student, Work, Family, Humanitarian, Citizen) and an "Other" option with a free-text write-in field.
- [x] 2.2 Update Step 1 of `OnboardingFlow.tsx` to use the universal visa selector and verify that selecting standard or entering custom statuses updates `formData` and persists across step navigation.
- [x] 2.3 Refactor Step 2 ("Employment") in `OnboardingFlow.tsx` so non-work, student, and visitor visas present an optional "Are you currently working in the US?" prompt, allowing users without US employment to proceed smoothly without validation errors.
- [x] 2.4 Verify through component tests that B-2 and F-1 users can proceed past Step 2 without entering an employer or H-1B start date, while H-1B users retain required employer fields.

## 3. Universal Green Card & Sponsor Attribution Intake

- [x] 3.1 Define green card pathway options (Marriage to USC, Marriage to LPR, Family Preference, EB-1, EB-2, EB-3, EB-2 NIW, EB-1A, EB-5, Humanitarian, DV Lottery, Other) and pathway-adapted stage lists.
- [x] 3.2 Update Step 3 in `OnboardingFlow.tsx` to render pathway selection, dynamic stages (e.g. I-130 filed/approved, I-485 filed, conditional resident for marriage), and mandatory sponsor attribution (Current Employer, Prior Employer, Spouse, Self-Petition, Other).
- [x] 3.3 Add support for entering prior approved petitions (retained priority date and prior sponsor) in Step 3 so users with multi-employer or concurrent filings can capture both during onboarding.
- [x] 3.4 Verify through tests that marriage green card applicants can complete Step 3 with spouse attribution and no PERM requirement, while employment-based applicants retain PERM/I-140 options.

## 4. Profile Mapper, Settings & Firm Intake Consistency

- [x] 4.1 Update `apps/haven/src/lib/profile-mapper.ts` and `profile-sync.ts` to ensure custom visa strings, marriage pathways, and multi-petition records are mapped without loss.
- [x] 4.2 Update user settings in `apps/haven/src/app/settings/page.tsx` to display and edit all universal visa types and green card pathways.
- [x] 4.3 Update `apps/haven/src/lib/firms/intake-question-catalog.ts` and firm intake view so law firm consultation questionnaires reflect universal visa options and adaptive questions.

## 5. Verification & End-to-End Evals

- [x] 5.1 Add eval test cases in `apps/haven/evals/` covering a B-2 visitor intake, an F-1 student intake, a marriage green card intake, and a self-petitioned EB-2 NIW intake.
- [x] 5.2 Verify complete onboarding submission flow end-to-end to ensure `user_profiles` and `deadline_answers` correctly persist the new data shapes and load onto the dashboard without runtime exceptions.

# Tasks

## 1. Domain Types and Regulatory Engine

- [x] 1.1 Add `ImmigrantPetition` interface, `retainedPriorityDate`, and `immigrantPetitions` collection to `apps/haven/src/types/domain.ts`, preserving backward compatibility with legacy profile scalar fields, and verify with `npm run typecheck:haven`.
- [x] 1.2 Update priority date resolution in `apps/haven/src/lib/immigration-journey.ts` to compute `effectivePriorityDate` honoring 8 CFR § 204.5(e) retention rules, and verify with domain unit tests.
- [x] 1.3 Update AC21 § 104(c) evaluation in `apps/haven/src/lib/immigration-journey.ts` so any qualifying unrevoked approved Form I-140 held for 180+ days unlocks 3-year H-1B extensions even during current employer PERM stages, and verify calculation outputs.

## 2. Dashboard Presentation and Multi-Sponsor Visualization

- [x] 2.1 Update Track 2 (`Green Card & Immigrant Petition`) in `apps/haven/src/components/app/immigration-journey-dashboard.tsx` to surface retained priority date indicators and prior sponsor attribution, and verify with component rendering tests.
- [x] 2.2 Implement expandable "Petitions & Sponsors" sub-card in `apps/haven/src/components/app/immigration-journey-dashboard.tsx` showing discrete petition lifecycles (prior approved I-140, current employer PERM, concurrent self-petitions), and verify responsive presentation.

## 3. Evaluation Checks and End-to-End Verification

- [x] 3.1 Add evaluation cases in `apps/haven/evals/firms/case-dashboard.check.ts` verifying multi-employer priority date retention, AC21 extension eligibility during PERM restart, and concurrent NIW handling.
- [x] 3.2 Run `npm run typecheck:haven` and `npm run check:firms` and verify that all type checks and dashboard eval assertions pass cleanly.

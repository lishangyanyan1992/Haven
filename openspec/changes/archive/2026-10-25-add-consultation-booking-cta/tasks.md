# Tasks

## 1. Schema and Domain Types

- [x] 1.1 Create migration `supabase/migrations/0042_firm_consultation_booking.sql` adding `consultation_booking_url` and `consultation_email` to `public.firms` with `not valid` constraints, and verify migration file syntax.
- [x] 1.2 Update firm and engagement domain types in `apps/haven/src/lib/firms/types.ts` and `apps/haven/src/types/database.ts` to include `consultation_booking_url`, `consultation_email`, `bookingUrl`, and `bookingEmail`, and verify with `npm run typecheck:haven`.

## 2. Firm Consultation Configuration & Actions

- [x] 2.1 Implement `saveFirmConsultationBookingAction` in `apps/haven/src/server/firm-actions.ts` and scoped query helpers in `apps/haven/src/lib/firms/clients.ts`, ensuring strict `requireFirmMember()` scoping and input validation. Verify with `npm run check:firm-isolation`.
- [x] 2.2 Create `apps/haven/src/app/firm/ConsultationBookingControls.tsx` and integrate into `apps/haven/src/app/firm/page.tsx` for law firms to view and edit their booking URL and contact email.
- [x] 2.3 Update `apps/haven/src/app/firm/clients/[id]/EngagementStageControls.tsx` to support optional per-client consultation booking URL and email overrides.

## 3. Client Case Dashboard Call to Action

- [x] 3.1 Update `getClientFirmEngagementRecord` in `apps/haven/src/lib/firms/intake.ts` and `buildFirmEngagementOverview` in `apps/haven/src/lib/firms/engagement.ts` to merge firm-level defaults with client-level overrides, generating booking actions for the `initial_consultation` milestone.
- [x] 3.2 Update `apps/haven/src/components/app/firm-engagement-dashboard.tsx` to render the primary "Book consultation call" button, the direct "Email to schedule" link, or dual action links during Step 3, with fallback advisory messaging when unconfigured.

## 4. Verification and Regression Testing

- [x] 4.1 Add test cases to `apps/haven/evals/firms/case-dashboard.check.ts` verifying booking URL, email, dual channel, and fallback CTA behaviors for `initial_consultation`.
- [x] 4.2 Run complete evaluation suite (`npm run typecheck:haven && npm run check:firms`) and verify all isolation, intake, demo, urgency, and case dashboard tests pass with 100% success.

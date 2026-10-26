# Proposal

## Why

When a client completes intake and uploads their required documents, their case timeline advances to "Next step: Initial consultation call" (Step 3). Currently, this spotlight milestone displays explanatory text and upcoming steps, but lacks an actionable call to action (CTA) for the client to actually schedule that call.

Allowing law firms to configure a booking link (e.g. Calendly, Cal.com) and a fallback consultation scheduling email, and exposing direct "Book consultation call" or "Email to schedule" actions on the client Case dashboard, closes the loop between intake completion and attorney consultation without manual back-and-forth email tagging.

## What Changes

- Add consultation booking settings to the sponsoring law firm profile, allowing attorneys to specify a direct booking URL and/or a consultation scheduling email address.
- Provide firm-level controls on `/firm` (and optional per-client overrides in client engagement controls) for managing consultation booking details.
- Update client firm engagement records to include the firm's consultation scheduling channels (`bookingUrl` and `bookingEmail`).
- Enhance the client Case spotlight and timeline milestone for "Initial consultation call" on `/dashboard` to render a prominent booking call to action:
  - If a booking link is provided: render a primary "Book consultation call" action button linking directly to the scheduling portal.
  - If a contact email is provided (with or without a booking link): render an email action (e.g. `mailto:` link or direct contact action) so clients without online booking can easily schedule via email.
  - If both are provided: offer the booking link as primary action with the scheduling email available alongside it.
  - If neither is configured: display a clear placeholder instructing the client that their firm will reach out or provide scheduling details once intake review completes.

## Capabilities

### New Capabilities

- `firm-consultation-booking`: Configuration of consultation scheduling channels (booking URL, scheduling email) by law firms, and display of interactive booking and email scheduling actions on the client Case dashboard during the initial consultation engagement stage.

### Modified Capabilities

None.

## Impact

- Database: Add consultation booking fields (`consultation_booking_url`, `consultation_email`) to `public.firms`, with optional per-client override support in `firm_clients.engagement_state`.
- Firm Management: Add consultation booking configuration controls to `/firm` and update `EngagementStageControls`.
- Client Dashboard: Update `apps/haven/src/components/app/firm-engagement-dashboard.tsx` and `apps/haven/src/lib/firms/engagement.ts` to surface booking actions when at the `initial_consultation` stage.
- Tests & Evals: Add test coverage in `apps/haven/evals/firms/case-dashboard.check.ts` and firm isolation checks.

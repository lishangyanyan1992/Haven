# Design

## Context

See `proposal.md` for motivation.

The client Case dashboard (`/dashboard`) renders the 6-stage firm engagement pipeline using `buildFirmEngagementOverview` in `apps/haven/src/lib/firms/engagement.ts` and `FirmEngagementDashboard` in `apps/haven/src/components/app/firm-engagement-dashboard.tsx`. When a client completes their intake questionnaire and required document uploads, the pipeline automatically highlights Step 3: "Initial consultation call".

Currently, this spotlight card displays stage text, attorney notes, and upcoming milestones, but does not provide an actionable call to action. Law firms also lack a mechanism on `/firm` to publish their scheduling calendar links or designated consultation inboxes.

## Goals / Non-Goals

**Goals:**
- Provide sponsoring law firms with firm-level configuration of a consultation booking URL and/or scheduling email on `/firm`.
- Enable optional per-client scheduling overrides in `EngagementStageControls` on `/firm/clients/[id]`.
- Provide clients at the `initial_consultation` milestone with an intuitive, one-click booking call to action or direct email scheduling action.
- Ensure firm isolation checks (`isolation.check.ts`) and database constraints are strictly maintained.

**Non-Goals:**
- Building an internal calendar or appointment slot booking engine inside Haven (external tools like Calendly, Cal.com, Google Calendar, or direct email are used).
- Sending automated booking reminder emails (email ingestion and notifications already exist independently).

## Decisions

### 1. Store firm-level defaults on `public.firms` with optional overrides in `firm_clients.engagement_state`
- **Decision**: Add `consultation_booking_url` and `consultation_email` columns to `public.firms`. Allow `engagement_state` in `firm_clients` to optionally carry `bookingUrl` and `bookingEmail` for client-specific calendar links.
- **Rationale**: Most law firms have a single intake calendar link or general consultation desk email that applies to all incoming leads. Storing it on `firms` means the firm configures it once on `/firm`, and all their clients immediately see the CTA. When an attorney wants to assign a specific partner or associate's calendar to a high-priority client, they can override it in `EngagementStageControls`.
- **Alternatives considered**:
  - *Store exclusively in `engagement_state` per client*: Requires attorneys to re-type or copy-paste booking links for every single client lead, creating friction.
  - *Store exclusively in `firms`*: Prevents attorneys from routing specific clients to specialized attorneys or custom calendar links.

### 2. Dual action handling on client dashboard
- **Decision**: When both a booking URL and an email are present, render the booking URL as the primary button ("Book consultation call" with an external link indicator) and render the email as an adjacent direct action ("or email firm to schedule"). When only one is configured, render that channel as the primary action. When neither is configured, render an advisory note that the legal team will reach out once review completes.
- **Rationale**: Some clients prefer self-service instant calendar booking, while others prefer or require email coordination. Displaying the booking link prominently while preserving email access ensures no client is blocked.
- **Alternatives considered**:
  - *Only allow URL or email, not both*: Restricts firms that use booking links for standard consultations but want email displayed as an alternative for clients who have special accommodation needs.

### 3. Server actions and isolation
- **Decision**: Add `saveFirmConsultationBookingAction(formData)` in `apps/haven/src/server/firm-actions.ts`. Ensure it calls `requireFirmMember()` and operates strictly on `membership.firmId`.
- **Rationale**: Complies with the Haven security model verified by `evals/firms/isolation.check.ts`.

## Risks / Trade-offs

- **[Risk]** User enters an invalid or malicious URL scheme (e.g. `javascript:`).
  → **Mitigation**: Strictly validate that `consultation_booking_url` starts with `https://` or `http://` in both client-side form validation, server action validation, and database check constraints.
- **[Risk]** External booking link opens within the same tab, causing user to lose dashboard context.
  → **Mitigation**: External booking URLs open in a new tab with `target="_blank"` and `rel="noopener noreferrer"`.
- **[Risk]** Firm has not yet set up booking details when a lead completes intake.
  → **Mitigation**: Graceful fallback UI displaying a clear notice that the legal team is reviewing the intake and will provide scheduling instructions.

## Migration Plan

1. Database migration: `0042_firm_consultation_booking.sql` adding `consultation_booking_url` and `consultation_email` to `public.firms`.
2. Safe deployment: Check constraints added with `not valid` to avoid table scan locks during deployment.

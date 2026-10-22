# Proposal

## Why

To sell Haven to immigration law firms, the team needs a live demo account that showcases the full value of the firm dashboard and urgency triage. Without demo data, a new firm starts empty, and manually running 50 dummy clients through onboarding is impractical. The demo account needs 50 realistic leads across all statuses and urgency tiers, sample clickable documents for showcase leads, client names instead of raw emails, and an easy in-app way to reset dates and "NEW" badges before every live pitch.

## What Changes

- **Demo firm capability (`firms.is_demo`).** Support designating a firm as a demo firm. Demo firms behave like standard firms but are eligible for demo data seeding and in-app resets.
- **Client name display on the dashboard.** Support displaying full client names (e.g. "Arjun Menon") alongside or in place of normalized emails on the firm client list and client detail views, fulfilling the dashboard design intent.
- **50 realistic simulated leads.** Seed a comprehensive book of 50 clients spanning:
  - Urgency tiers: Urgent (~10), Soon (~15), Later (~12), and Unknown (~7).
  - Statuses: Finished (with unreviewed "NEW" badges), In progress, Signed up, and Email sent (~6).
  - Visa types & scenarios: H-1B layoffs/grace periods, F-1 OPT/STEM extensions, RFE deadlines, travel planning, PERM/I-140 priority date tracking, L-1, O-1, and TN cases.
- **Clickable sample documents for 6-8 showcase leads.** Provision realistic sample PDFs (I-797 approval notices, I-94 arrival records, USCIS RFE notices, I-140 notices, paystubs) for key showcase leads at the top of the table, backed by storage so lawyers can test opening 5-minute signed links live.
- **One-click "Reset demo data" button.** A dedicated action on the firm dashboard (visible only when logged in as a demo firm lawyer) that re-anchors all deadline and event dates relative to today and restores "NEW" status on unreviewed finished leads.
- **CLI seeding command.** Extend `scripts/firm-admin.ts` with a `seed-demo` command to bootstrap or re-seed the demo firm, lawyer account, showcase documents, and simulated client records.

## Capabilities

### New Capabilities

- `firm-demo`: Demo firm flag, 50-lead realistic dataset generation with floating dates relative to current time, sample document attachments for showcase leads, CLI bootstrap, and in-app one-click reset action.

### Modified Capabilities

- `firm-dashboard`: Updated client listing to display client full names when present (falling back to email), and support the demo reset control for authorized demo firm members.

## Impact

- **Database:** New migration adding `is_demo` boolean to `firms`.
- **Firm Library (`src/lib/firms/`):**
  - Add `fullName` to `SHARED_ANSWER_KEYS` in `answers.ts`.
  - Update `listFirmClients` and client detail page to render `fullName`.
  - Add `src/lib/firms/demo.ts` with dataset generators and reset routine.
- **Dashboard UI (`src/app/firm/`):**
  - Header or toolbar component displaying "Reset demo data" button when `membership.isDemo` is true.
  - Server action `resetDemoFirmAction` checking isolation and demo permissions.
- **Admin Tooling (`scripts/firm-admin.ts`):**
  - Add `seed-demo` command supporting automated setup of lawyer and leads.

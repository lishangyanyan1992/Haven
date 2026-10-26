# Proposal: Haven Admin Operations Dashboard

## Why

Haven relies on time-sensitive background feeds (such as the State Department Visa Bulletin scraper) and asynchronous moderation queues (outside community stories) that currently lack a central administrative overview. If a scraper fails or falls behind due to upstream changes or network challenges, the issue can remain unnoticed while users receive stale data with advisory disclaimers. 

An administrative overview at `/admin` solves this by giving the admin immediate awareness of outdated data feeds, actionable manual overrides (such as on-demand Visa Bulletin sync), and direct visibility into pending review queues, inbound firm inquiries, and negative user feedback.

## What Changes

- **Admin Root Page (`/admin`)**: Create an admin dashboard in `apps/haven/src/app/admin/page.tsx` featuring an "Action Required" triage banner and key health cards.
- **Admin Navigation**: Add sub-navigation between `/admin` (Overview) and `/admin/community-imports` (Community Stories).
- **Unified Access Control**: Introduce `ADMIN_EMAILS` configuration in environment settings for admin gating, falling back to existing `COMMUNITY_IMPORT_REVIEWER_EMAILS` for backward compatibility.
- **Visa Bulletin Freshness Monitoring**:
  - Display the latest held bulletin month, age in days, last sync timestamp, and freshness status (`CURRENT` vs `STALE`).
  - Flag the bulletin as stale when held month lags the current calendar month or exceeds 35 days without a new release.
- **Manual Visa Bulletin Sync Action**: Provide a one-click "Run Manual Sync" action in the dashboard that triggers the scraper and upsert pipeline, returning immediate success/error feedback.
- **Operational Review & Inbound Cards**:
  - **Community Story Review**: Metric card displaying pending and auto-approved draft counts with direct link to the review queue.
  - **Lawyer Pilot Inquiries**: Summary list of recent inbound firm inquiries from `firm_pilot_requests`.
  - **Advisor Feedback & Complaints**: Summary list of recent negative feedback ratings and user comments from `advisor_feedback`.

## Capabilities

### New Capabilities
- `admin-operations`: Core administrative dashboard providing operational health signals, data feed staleness detection, manual sync operations, and administrative oversight across moderation queues and user feedback.

### Modified Capabilities
None.

## Impact

- **Affected Routes**:
  - `apps/haven/src/app/admin/page.tsx` (new root admin page)
  - `apps/haven/src/app/admin/layout.tsx` (admin layout and header navigation)
  - `apps/haven/src/app/admin/community-imports/page.tsx` (shared admin authorization logic)
- **Server Actions & Utilities**:
  - Admin server actions for triggering bulletin synchronization on demand and querying operational metrics.
  - Auth helper checking `ADMIN_EMAILS` / `COMMUNITY_IMPORT_REVIEWER_EMAILS`.
- **Environment & Configuration**:
  - `ADMIN_EMAILS` added to `env.ts` schema and `.env.example`.

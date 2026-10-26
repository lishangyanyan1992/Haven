# Spec Delta

## Purpose

Provides a central administrative dashboard and operational controls for Haven administrators to monitor feed freshness, execute on-demand synchronizations, and oversee moderation and intake queues.

## ADDED Requirements

### Requirement: Admin Access Control
The system SHALL restrict access to `/admin` routes to authenticated users whose email address appears in the configured `ADMIN_EMAILS` list or the fallback `COMMUNITY_IMPORT_REVIEWER_EMAILS` list.

#### Scenario: Authorized admin access
- **WHEN** an authenticated user whose email is in `ADMIN_EMAILS` visits `/admin`
- **THEN** the system grants access and renders the admin dashboard

#### Scenario: Unauthorized authenticated user
- **WHEN** an authenticated user whose email is not in the authorized admin list visits `/admin`
- **THEN** the system denies access and redirects to an unauthorized notice or home page

#### Scenario: Unauthenticated visitor
- **WHEN** an unauthenticated visitor navigates to `/admin`
- **THEN** the system redirects the visitor to `/login?redirectTo=/admin`

### Requirement: System Operational Health Overview
The system SHALL present an operational health summary at `/admin` displaying actionable alerts when background feeds are stale or moderation items require attention.

#### Scenario: Action required banner with stale items
- **WHEN** the Visa Bulletin feed is stale or community drafts are pending review
- **THEN** the dashboard displays an alert banner listing each item requiring administrative attention

#### Scenario: All systems healthy
- **WHEN** all data feeds are current and no drafts or inquiries are pending
- **THEN** the dashboard displays a clear status indicating all systems are operating normally

### Requirement: Visa Bulletin Staleness Detection
The system SHALL evaluate the newest held Visa Bulletin in `visa_bulletin_entries` and indicate whether the data is current or stale.

#### Scenario: Held bulletin is current
- **WHEN** the latest held bulletin month corresponds to the active or upcoming calendar cycle and is not older than 35 days
- **THEN** the dashboard displays a "Current" status badge with the bulletin label and last sync timestamp

#### Scenario: Held bulletin is stale
- **WHEN** the latest held bulletin is older than 35 days or lags the expected monthly publication
- **THEN** the dashboard displays a "Stale" status warning indicating that an update is due

### Requirement: On-Demand Visa Bulletin Synchronization
The system SHALL provide an authorized administrative trigger to fetch, parse, and upsert the latest State Department Visa Bulletin immediately without waiting for scheduled crons.

#### Scenario: Successful manual sync
- **WHEN** an administrator clicks "Run Manual Sync" and the State Department feed parses valid entries
- **THEN** the system upserts the bulletin entries, invalidates relevant cache paths, and displays a success notification with the count of updated records

#### Scenario: Failed manual sync reports error
- **WHEN** an administrator clicks "Run Manual Sync" and the upstream fetch fails or quality validation fails
- **THEN** the system leaves existing records intact and displays the specific failure reason on the dashboard

### Requirement: Community Story Moderation Queue Summary
The system SHALL display the count of community import items in `pending` and `needs_revision` statuses and provide navigation to the review interface.

#### Scenario: Pending drafts available for review
- **WHEN** one or more outside community stories are staged with `moderation_status = 'pending'`
- **THEN** the dashboard displays the count of pending drafts and a link navigating to `/admin/community-imports?filter=needs-review`

#### Scenario: No drafts awaiting review
- **WHEN** all staged community stories have been reviewed or published
- **THEN** the dashboard displays zero pending items and confirms the review queue is clear

### Requirement: Inbound Inquiries and Advisor Feedback Oversight
The system SHALL display recent inbound attorney pilot requests and recent negative advisor responses to surface partnership leads and answer quality issues.

#### Scenario: Inbound pilot requests displayed
- **WHEN** law firms submit inquiries stored in `firm_pilot_requests`
- **THEN** the dashboard displays the latest inquiries including firm name, contact email, and submission date

#### Scenario: Recent advisor complaints displayed
- **WHEN** users submit negative advisor ratings (`rating <= 0`) with text feedback
- **THEN** the dashboard displays the recent feedback comments alongside submission timestamps

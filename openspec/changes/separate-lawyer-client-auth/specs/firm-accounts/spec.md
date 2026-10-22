# Spec Delta

## Purpose

Separates law firm accounts and pilot inquiries from invite-only client accounts across the sign-in flow, intake flow, and database tables so lawyer emails and client emails can never overlap.

## ADDED Requirements

### Requirement: Distinct lawyer and invite-only client sign-in modes
The `/login` page SHALL provide two explicit sign-in modes: `Client Sign In (Invite-Only)` and `Law Firm Sign In`. Visiting `/login` without a role parameter SHALL default to the client invite-only mode, while visiting `/login?role=lawyer` or redirecting from an unauthenticated `/firm` route SHALL open the law firm mode directly.

#### Scenario: Visitor opens default sign-in page
- **WHEN** a visitor opens `/login`
- **THEN** the page displays the `Client Sign In (Invite-Only)` mode with invite-only client copy and a link to claim an invite or join the client waitlist, alongside a clear toggle to switch to `Law Firm Sign In`

#### Scenario: Signed-out lawyer opens the firm dashboard URL
- **WHEN** a signed-out visitor opens `/firm` or `/login?role=lawyer`
- **THEN** the page displays `Law Firm Sign In` with law-firm-specific copy and a link to contact the founder for a free pilot

### Requirement: Sign-in enforces the selected role
Signing in through `Client Sign In (Invite-Only)` SHALL succeed only for invited client accounts and SHALL reject lawyer accounts. Signing in through `Law Firm Sign In` SHALL succeed only for firm lawyer accounts and SHALL reject client accounts.

#### Scenario: Lawyer email submitted on Client Sign In
- **WHEN** a lawyer submits their firm email and password on the `Client Sign In (Invite-Only)` tab
- **THEN** the system signs them out, refuses client sign-in, and instructs them to use `Law Firm Sign In`

#### Scenario: Client email submitted on Law Firm Sign In
- **WHEN** a client submits their email and password on the `Law Firm Sign In` tab
- **THEN** the system signs them out, refuses law firm sign-in, and instructs them to use `Client Sign In (Invite-Only)` or contact the founder for a free firm pilot

#### Scenario: Uninvited email submitted on Client Sign In
- **WHEN** a user whose email is neither a firm lawyer nor on the client invite list signs in on `Client Sign In (Invite-Only)`
- **THEN** the system signs them out and redirects them to `/register?message=not_invited`

### Requirement: Lawyers contact the founder for a free pilot
The `/register` flow SHALL provide a dedicated "Contact the founder for a free pilot" path for immigration lawyers (reachable directly via `/register?role=lawyer`), storing requests in a lawyer-only `firm_pilot_requests` table separate from client `waitlist_signups`.

#### Scenario: Lawyer requests a free pilot
- **WHEN** a lawyer submits their name, firm name, and work email on the founder pilot form
- **THEN** the system records the inquiry in `firm_pilot_requests` and does not write a row to `waitlist_signups`

#### Scenario: Client email used on the founder pilot form
- **WHEN** someone submits an email on the founder pilot form that already belongs to a client account or client waitlist entry
- **THEN** the system refuses the request and explains that the email is already tied to a client account

### Requirement: Mutual exclusion between lawyer and client emails in the database
The database and server actions SHALL prevent any email address or user account from existing in both lawyer tables (`firm_members`, `firm_pilot_requests`) and client tables (`access_invites`, `firm_clients`, `user_profiles`, `waitlist_signups`).

#### Scenario: Adding a client email as a firm lawyer
- **WHEN** the owner or a database write attempts to insert an email into `firm_members` that already exists in `access_invites`, `firm_clients`, or `user_profiles`
- **THEN** the database rejects the write with a role-conflict error

#### Scenario: Inviting or onboarding a lawyer email as a client
- **WHEN** a database write or server action attempts to insert a `firm_members` email or `user_id` into `access_invites`, `firm_clients`, `user_profiles`, or `waitlist_signups`
- **THEN** the database or action rejects the write so the lawyer account never becomes a client

#### Scenario: Lawyer login queries client-protected tables
- **WHEN** a signed-in lawyer account evaluates `haven_has_access()`
- **THEN** `haven_has_access()` returns `false` even if their email were ever present in `access_invites`

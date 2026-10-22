# Proposal

## Why

Haven currently puts both immigration lawyers and invited clients on the same `/login` screen with client-only copy, and the database does not prevent the same email from appearing in both lawyer (`firm_members`) and client (`access_invites`, `firm_clients`, `user_profiles`, `waitlist_signups`) tables. Lawyers and invite-only clients need clearly separated sign-in and pilot-request paths, backed by database rules that keep lawyer emails and client emails strictly mutually exclusive.

## What Changes

- **Two-mode sign-in on `/login` (`Client Sign In (Invite-Only)` vs. `Law Firm Sign In`).** A clear role switcher on `/login` (with direct URL support via `/login?role=lawyer` and `/firm` redirects) shows client invite-only copy on the Client tab and firm dashboard copy on the Law Firm tab.
- **Role-enforced `signInAction`.** Signing in on the Client tab requires the account to be an invited client (`access_invites`) and rejects lawyer accounts (`firm_members`) with a prompt to switch to Law Firm Sign In. Signing in on the Law Firm tab requires the account to be in `firm_members` and rejects client accounts with a prompt to switch to Client Sign In or contact the founder for a free pilot.
- **"Contact the founder for a free pilot" flow for lawyers.** On `/register` (and via `/register?role=lawyer` from the Law Firm login tab), the lawyer option is framed as contacting the founder for a free firm pilot and writes to a dedicated `firm_pilot_requests` table instead of the client `waitlist_signups` table.
- **Database-level separation of lawyer and client emails.** Add a migration (`0038_separate_lawyer_client_emails.sql`) that normalizes and makes `firm_members.email` unique, creates `firm_pilot_requests`, adds triggers that reject any email or `user_id` overlap between lawyer tables (`firm_members`, `firm_pilot_requests`) and client tables (`access_invites`, `firm_clients`, `user_profiles`, `waitlist_signups`), and updates `haven_has_access()` so lawyer accounts never pass the client access gate.
- **Server and CLI cross-role checks.** Update `scripts/firm-admin.ts`, `sendInviteLinkAction`, `submitWaitlistAction`, and `claimFirmInvite` so lawyer emails cannot be invited, waitlisted, or claimed as clients, and client emails cannot be added as lawyers or submit lawyer pilot requests.

## Capabilities

### New Capabilities

- `firm-accounts`: Distinct lawyer vs. invite-only client sign-in, founder pilot inquiry intake for law firms, and strict database and server separation between lawyer emails and client emails.

### Modified Capabilities

None. The project has no archived specs in `openspec/specs/` yet.

## Impact

- **Database:** New migration `0038_separate_lawyer_client_emails.sql` adding `firm_pilot_requests`, unique normalized email constraint on `firm_members`, cross-table role-exclusivity triggers, and hardened `haven_has_access()`.
- **Auth & Sign-in UI (`src/app/login/page.tsx`, `src/proxy.ts`, `src/lib/firms/access.ts`):** Role switcher on `/login`, role-specific copy and error banners, and `/login?role=lawyer` redirects when signed-out users visit `/firm`.
- **Register / Pilot Intake (`src/app/register/page.tsx`, `src/components/app/invite-chat.tsx`, `src/server/actions.ts`):** "Contact the founder for a free pilot" form for lawyers writing to `firm_pilot_requests`, and role checks on client invite/waitlist actions.
- **Firm Tooling (`scripts/firm-admin.ts`, `src/lib/firms/intake.ts`):** Full cross-table checks against `access_invites`, `user_profiles`, `firm_clients`, and `firm_members`.

# Tasks

## 1. Database separation and pilot requests table

- [x] 1.1 Add migration `0038_separate_lawyer_client_emails.sql` creating `public.firm_pilot_requests`, adding lowercase and uniqueness constraints on `firm_members.email`, adding `assert_not_client_email_or_user` and `assert_not_lawyer_email_or_user` triggers across `firm_members`, `firm_pilot_requests`, `access_invites`, `firm_clients`, `user_profiles`, and `waitlist_signups`, and hardening `haven_has_access()` to exclude `firm_members`. Verify by applying the migration and confirming cross-role inserts fail in Postgres while valid lawyer and client rows succeed.
- [x] 1.2 Add `firm_pilot_requests` to `src/types/database.ts` and verify `npm run typecheck` passes.

## 2. Server and CLI role guards

- [x] 2.1 Update `src/lib/firms/access.ts`, `src/lib/firms/intake.ts`, and `scripts/firm-admin.ts` so `addLawyer` refuses emails present in `access_invites` or `user_profiles` as well as `firm_clients`, and `claimFirmInvite` refuses accounts present in `firm_members`. Add unit checks in `evals/firms/intake.check.ts` verifying cross-role rejection and run `npx tsx evals/firms/intake.check.ts` to confirm it passes.
- [x] 2.2 Add `submitFirmPilotRequestAction` in `src/server/actions.ts` (writing to `firm_pilot_requests` and rejecting client emails) and update `sendInviteLinkAction` and `submitWaitlistAction` to reject lawyer emails (`firm_members`, `firm_pilot_requests`). Verify with a test script that lawyer pilot requests land in `firm_pilot_requests` and cross-role emails return clear errors.

## 3. Separate Lawyer and Invite-Only Client sign-in UI

- [x] 3.1 Update `src/app/login/page.tsx` with a two-mode switcher (`Client Sign In (Invite-Only)` vs. `Law Firm Sign In`, controlled by `?role=client|lawyer` or `redirectTo=/firm`), tailored copy for each mode, role-mismatch error banners (`use_lawyer_login`, `not_lawyer_account`), and a hidden `role` input on the sign-in form. Update `src/proxy.ts` and `requireFirmMember()` in `src/lib/firms/access.ts` so unauthenticated `/firm` visits redirect to `/login?role=lawyer&redirectTo=/firm`. Verify in the browser that `/login` renders Client Invite-Only mode, `/login?role=lawyer` and `/firm` render Law Firm mode, and `npm run typecheck` passes.
- [x] 3.2 Update `signInAction` in `src/server/actions.ts` to enforce the submitted `role`: reject lawyer accounts on the Client tab (`message=use_lawyer_login`) and reject non-lawyer accounts on the Law Firm tab (`message=not_lawyer_account`). Verify end-to-end that a lawyer email cannot sign in on the Client tab and a client email cannot sign in on the Law Firm tab.

## 4. "Contact the founder for a free pilot" intake UI

- [x] 4.1 Update `src/app/register/page.tsx` and `src/components/app/invite-chat.tsx` to accept `?role=lawyer` (opening the lawyer path directly when linked from Law Firm Sign In), reframe the lawyer option as "Contact the founder for a free pilot", and submit lawyer inquiries via `submitFirmPilotRequestAction`. Verify in the browser that clicking "Contact the founder for a free pilot" from `/login?role=lawyer` opens the pilot form and saves to `firm_pilot_requests`.

## 5. End-to-end verification

- [x] 5.1 Run `npm run typecheck`, `npm run check:firm-isolation`, and `npx tsx evals/firms/intake.check.ts`, and verify all checks pass.

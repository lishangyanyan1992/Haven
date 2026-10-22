# Design

## Context

See `proposal.md` for motivation. What exists in the codebase today:
- `/login` (`src/app/login/page.tsx`) renders a single sign-in screen with client-only copy ("A calmer place for your immigration journey", 60-day layoff plan bullets) and posts to `signInAction`.
- `signInAction` (`src/server/actions.ts`) authenticates with Supabase and silently branches: if `getFirmMembership(userId)` is truthy, it redirects to `/firm`; otherwise it checks `isInvitedEmail(email)` (`access_invites`) and boots client onboarding (`user_profiles`, `derived_signals`).
- `/register` (`src/components/app/invite-chat.tsx`) uses `submitWaitlistAction` to write both `"lawyer_access"` and `"individual_access"` rows into the same `public.waitlist_signups` table.
- In Postgres (`0032_access_invites.sql`, `0033_firms.sql`), `firm_members` stores `(firm_id, user_id, email)` without a unique lowercased constraint on `email`, and no database trigger prevents an email or `user_id` from sitting in both `firm_members` and `access_invites` / `firm_clients` / `user_profiles`.

## Goals / Non-Goals

**Goals:**
- Give lawyers and invite-only clients distinct, unmistakable sign-in views and role-checked authentication.
- Replace the generic lawyer waitlist option with a "Contact the founder for a free pilot" intake stored in its own `firm_pilot_requests` table.
- Enforce strict separation between lawyer emails (`firm_members`, `firm_pilot_requests`) and client emails (`access_invites`, `firm_clients`, `user_profiles`, `waitlist_signups`) in Postgres triggers, RLS helpers, server actions, and `scripts/firm-admin.ts`.

**Non-Goals:**
- Self-serve firm creation on the website (firms are still provisioned by the founder via `scripts/firm-admin.ts`).
- Allowing a single email address to act as both a lawyer and a client.

## Decisions

### Decision 1: Role switcher on `/login` with URL-addressable modes (`/login` vs `/login?role=lawyer`)

`/login` reads `role` from `searchParams` (`"lawyer"` when `role === "lawyer"` or when `redirectTo` starts with `"/firm"`, otherwise `"client"`).
- **Client mode (`role = "client"`):**
  - Shows an `Invite-Only Client Access` badge, client-focused copy explaining that access requires an invite from their immigration lawyer, and a footer prompt linking to `/register` to claim an invite or join the waitlist.
- **Law Firm mode (`role = "lawyer"`):**
  - Shows a `Law Firm Portal` badge, attorney-focused copy ("Review client intakes, urgency countdowns, and shared documents"), and a footer prompt: *"Want to try Haven with your firm? Contact the founder for a free pilot ->"* linking to `/register?role=lawyer`.
- `proxy.ts` and `requireFirmMember()` redirect unauthenticated `/firm` requests to `/login?role=lawyer&redirectTo=/firm` so lawyers never land on client copy.

*Alternative considered:* Separate `/login` and `/firm/login` pages with no switcher on `/login`. Rejected because visitors clicking `Sign in` in the public navbar need an obvious way to reach Law Firm Sign In without guessing a second URL. We can also redirect `/firm/login` to `/login?role=lawyer` for convenience.

### Decision 2: Role-enforced `signInAction`

`signInAction` reads `loginRole = formData.get("role") === "lawyer" ? "lawyer" : "client"`:
1. After `supabase.auth.signInWithPassword`, it looks up `membership = await getFirmMembership(userId)` and `invitedClient = await isInvitedEmail(email)`.
2. **If `loginRole === "lawyer"`:**
   - If `!membership`, sign out immediately and redirect to `/login?role=lawyer&email=...&message=not_lawyer_account` (which tells them this email is not registered to a law firm, with links to switch to Client Sign In or contact the founder for a free pilot).
   - If `membership`, redirect to `/firm`.
3. **If `loginRole === "client"`:**
   - If `membership` (or `await isFirmLawyerEmail(email)`), sign out immediately and redirect to `/login?role=client&email=...&message=use_lawyer_login` (which tells them this email belongs to a law firm account and links to `/login?role=lawyer`).
   - If `!invitedClient`, sign out and redirect to `/register?message=not_invited`.
   - Otherwise proceed to `resolvePostAuthRedirect`.

*Rationale:* Prevents silent cross-routing where a lawyer accidentally signs in on the client form or a client tests the lawyer form, and guarantees a lawyer login never triggers `resolvePostAuthRedirect` (which creates `user_profiles` rows).

### Decision 3: Dedicated `firm_pilot_requests` table for lawyer pilot inquiries

Create `public.firm_pilot_requests` in migration `0038_separate_lawyer_client_emails.sql`:
```sql
create table public.firm_pilot_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  firm_name text not null,
  email text not null,
  normalized_email text not null unique,
  note text,
  source_path text not null default '/register',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
- On `/register` (`InviteChat`), supports `?role=lawyer` to pre-select the lawyer path, updates the lawyer prompt to **"Contact the founder for a free pilot"**, and submits via `submitFirmPilotRequestAction` into `firm_pilot_requests`.
- Migrate any existing `waitlist_signups` rows with `interest_key = 'lawyer_access'` into `firm_pilot_requests` and delete them from `waitlist_signups`.

### Decision 4: Database triggers and constraints enforcing email separation

In migration `0038_separate_lawyer_client_emails.sql`:
1. **Normalize and deduplicate `firm_members.email`:**
   - Add `constraint firm_members_email_lower_chk check (email = lower(trim(email)))` and a `unique (email)` constraint on `firm_members`.
2. **Cross-role guard functions & triggers:**
   - `public.assert_not_client_email_or_user()` (`BEFORE INSERT OR UPDATE` on `firm_members` and `firm_pilot_requests`): raises an exception if `new.email` / `new.normalized_email` exists in `access_invites`, `firm_clients`, `user_profiles`, or `waitlist_signups`, or if `new.user_id` (for `firm_members`) exists in `firm_clients` or `user_profiles`.
   - `public.assert_not_lawyer_email_or_user()` (`BEFORE INSERT OR UPDATE` on `access_invites`, `firm_clients`, `user_profiles`, and `waitlist_signups`): raises an exception if the normalized email exists in `firm_members` or `firm_pilot_requests`, or if `user_id`/`id` exists in `firm_members`.
3. **Harden `haven_has_access()`:**
   - Add `and not exists (select 1 from public.firm_members fm where fm.user_id = u.id or fm.email = lower(u.email))` to `public.haven_has_access()`, ensuring RLS on client tables always denies lawyer logins.

## Risks / Trade-offs

- **[Existing overlapping test rows in the database]** -> Before adding the triggers in `0038_separate_lawyer_client_emails.sql`, the migration cleans up any overlap (currently `firm_members` only has `yanyan@law.com` and `access_invites` only has `lshangyanyan@gmail.com`, so there is zero overlap on active accounts).
- **[Owner email used for both testing client view and demo firm]** -> Because `lshangyanyan@gmail.com` is in `access_invites` and `user_profiles` (client), the demo lawyer uses a separate lawyer email (`yanyan@law.com`), which is already how the live database is set up. `firm-admin.ts` will print a clear error if anyone tries to add a client/owner email as a lawyer.

## Migration Plan

1. Apply migration `0038_separate_lawyer_client_emails.sql` (`firm_pilot_requests`, `firm_members` email uniqueness, mutual-exclusion triggers, updated `haven_has_access()`).
2. Deploy updated `/login`, `/register`, `signInAction`, `submitFirmPilotRequestAction`, and `scripts/firm-admin.ts`.
3. Verify both sign-in tabs and database triggers with automated and live checks.

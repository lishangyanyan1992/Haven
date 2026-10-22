# Design

## Context

See proposal.md for why. What exists today and shapes the approach:

- **Access gate.** `access_invites` plus `haven_has_access()` decide who can
  use the product. They are checked in the request guard (`proxy.ts`), in
  sign-in, in the advisor, file and export routes, and by restrictive
  "invited accounts only" row policies on every user-owned table and the
  `haven-vault` bucket (migration 0032).
- **Sign-up.** Public sign-up is off in Supabase. New accounts come only
  from `admin.auth.admin.inviteUserByEmail`, which emails a link to
  `/auth/callback?next=/reset-password`. The person sets a password, signs
  in at `/login`, and `signInAction` runs `isInvitedEmail` and then
  `resolvePostAuthRedirect`, which bootstraps a profile and sends them to
  onboarding. Auth email goes through Mailgun SMTP.
- **Onboarding.** Four steps (profile, employment, green card, situation)
  save into `user_profiles`. Finishing creates the `email_aliases` row, and
  that row is today's "onboarding complete" signal. Partial progress is
  inferred from `country_of_birth`, `employer_name` and
  `preference_category`.
- **Documents.** Metadata lives in `user_documents` and files in the private
  `haven-vault` bucket under `<user_id>/...`. The document page is limited
  by `DOCUMENT_READING_ALLOWLIST` (`documentContextAvailableFor`, which is
  synchronous and checks email only).
- **Unused shells.** `/clients` and `/cases` are archived routes with no
  useful code. The firm area gets a fresh `/firm` prefix instead.

## Goals / Non-Goals

**Goals:**
- Firm isolation enforced in two independent layers: server code and
  database row policies.
- Reuse the existing invite email, onboarding, and document storage rather
  than building parallel versions.
- Keep the firm's link the only new public entry point.

**Non-Goals:**
- An admin screen for firms. The owner uses a script.
- Real-time dashboard updates. The page reads fresh data on each load.
- Changing what the chat can see or do.

## Decisions

### Data model: four new tables

```
firms                (id, name, created_at)
firm_members         (firm_id, user_id UNIQUE, email, created_at)
firm_intake_links    (id, firm_id, token UNIQUE, is_active,
                      revoked_at, created_at)
                     -- at most one row per firm with revoked_at IS NULL
firm_clients         (id, firm_id, normalized_email UNIQUE,
                      user_id UNIQUE NULL, link_id, status_email_sent_at,
                      joined_at NULL, completed_at NULL,
                      reviewed_at NULL, consented_at)
firm_intake_sends    (link_id, normalized_email, ip_hash, created_at)
```

- `firm_members.user_id UNIQUE` enforces one firm per lawyer.
- `firm_clients.normalized_email UNIQUE` enforces one firm per client. The
  first firm to reach an email owns it, and later requests from other firms
  are ignored.
- "New" is firm-wide: `completed_at IS NOT NULL AND reviewed_at IS NULL`.
  The first lawyer to open the client sets `reviewed_at`. A per-lawyer
  "unread" was rejected because the spec says opening it clears the badge
  for everyone, and per-lawyer state adds a table for no stated need.
- Status is derived, not stored: email sent (no `joined_at`), signed up
  (joined, no setup fields), in progress (some fields), finished
  (`completed_at`). This uses the same field checks onboarding already uses.

*Alternative considered:* reusing `access_invites.invited_by` to mean the
firm. Rejected because the dashboard needs per-client state (consent, New,
link used), and `access_invites` stays a plain allow-list.

### Replacing a link is one transaction

`firm_replace_intake_link` revokes the old link and inserts the new one
together, so a failed replacement leaves the old link working.

### Link token stored in plain form

The token is 32 random bytes, encoded URL-safe, and the page is
`/i/<token>`. It's stored as-is so lawyers can copy it any time.

*Alternative considered:* store only a hash. Rejected because the lawyer
couldn't copy the link again, and a link only lets someone request a sign-up
email to their own inbox, so a leaked token is low-value. Replacing the link
is the remedy if it leaks.

### Joining is a two-step "claim", and needs the email's one-time code

```
 /i/<token>  --email-->  requestFirmIntake
                           |  lawyer / other firm / already joined? -> no-op
                           |  firm_intake_reserve_send: limits + log, locked
                           |  pending firm_clients row + fresh claim code
                           |    (only its hash is stored)
                           |  no account  -> inviteUserByEmail
                           |  has account -> password-reset email
                           |  both link to /reset-password?claim=<code>
                           v
                    same reply every time
 email link -> /auth/callback (keeps ?claim) -> /reset-password
                           |  page takes the session from the link
                           v
                claimFirmInviteAction(code)
                  signed in as the pending email, email confirmed,
                  and the code matches -> set user_id, joined_at,
                  clear the code, add access_invites
                           |
                           v
          new account: choose a password; existing: just sign in
```

Ordinary sign-in never joins anyone to a firm. Review found that an
email-only claim let anyone holding a link type an existing user's address
and have that account attached at its next normal sign-in. Needing the
code means only someone who opened that specific email can join.

Someone who had already finished setup is marked finished at join time,
with their setup answers copied once, so they show as Finished and New.

*Alternative considered:* claiming at sign-in by email alone (the first
version). Rejected for the reason above.

### Setup answers are a separate copy the chat can't write

The chat updates `user_profiles` (for example, "I was laid off" changes
work status). So the dashboard never reads `user_profiles`. It reads
`firm_clients.shared_answers`, which only the setup steps and settings
write, through `recordFirmSharedAnswers`. `check:firm-intake` fails if the
chat service ever calls it, and `check:firm-isolation` fails if firm
dashboard code reads `user_profiles`. Fields that only the chat sets, such
as work status, aren't shown at all.

### Firm isolation in two layers

1. **Server:** one helper, `requireFirmMember()`, resolves the signed-in
   lawyer's `firm_id` from `firm_members`. It is the only source of
   `firm_id` for every firm page, action and document link. Client lookups
   always filter by `(firm_id, firm_client.id)` and never by client id
   alone. A miss returns "not found".
2. **Database:** row policies on the firm tables allow a lawyer to read only
   rows whose `firm_id` matches their own membership, through a
   security-definer `haven_firm_id()`. Lawyers are not on `access_invites`,
   so the existing restrictive policies already block their logins from
   reading `user_profiles` and `user_documents` directly.

Client answers and documents are read on the server with the admin client,
only after layer 1 has confirmed the pairing. Documents open via
`createSignedUrl` on `haven-vault` with a 5-minute expiry, again only after
the client is confirmed to be in the lawyer's firm.

### Routing lawyers

- `proxy.ts` adds `/firm` with its own check: signed in, and
  `haven_firm_id()` is not null. Otherwise signed-out visitors go to
  `/login` and everyone else goes to the signed-in home.
- In `signInAction`, if the user is a firm member, skip the invite check
  and profile bootstrap and redirect to `/firm`.
- A lawyer who opens a client-product path still hits the invite gate. To
  make this friendlier, the guard sends firm members to `/firm` instead of
  the invite chat.

### Owner script instead of an admin screen

A script, `scripts/firm-admin.ts` (run with `tsx`), supports
`create-firm`, `add-lawyer`, `remove-lawyer` and `show-link`. Adding a
lawyer calls `inviteUserByEmail`. The script refuses an email that is
already a lawyer or a client.

### Rate limits

`firm_intake_reserve_send` checks the counts and logs the send in one
locked database step, so parallel requests can't all slip under a limit. It
allows at most 3 per email per hour, 10 per visitor per hour, and 100 per
link per day. If the send can't be logged, no email goes out. The visitor is identified by a salted IP hash, so the
raw IP is never stored. Supabase's own email limit (currently 30 an hour)
sits behind this as a backstop.

### Documents for firm clients

`documentContextAvailableFor` becomes an async check: the allow-list, or
the user being a joined firm client. Existing callers are updated to await
it.

## Risks / Trade-offs

- [The project-wide Supabase email limit (30/hour) is shared with password
  resets and lawyer invites] → Fine for a few firms. Raise it in Supabase
  auth settings as usage grows.
- [Plain-stored tokens exposed by a database leak] → They're low-value, and
  replacing the link revokes them. Documented in the owner script's help.
- [Inferred "in progress" can misreport if onboarding fields change] → Keep
  the status rules in one function next to onboarding's own progress logic,
  with a check covering each status.
- [The isolation bug class is easy to reintroduce] → A single
  `requireFirmMember()` source for `firm_id`, plus an automated check that
  every firm data function filters by it, plus a manual two-firm test before
  launch.
- [An existing beta user, locked out today, enters their email on a firm
  link] → They get a password-reset email, the claim attaches them to the
  firm on sign-in, and they regain access as that firm's client. This is
  intended.

## Migration Plan

1. Apply the new migration (tables, row policies, `haven_firm_id()`). It
   only adds things, so it's safe on the live database.
2. Deploy the code. Nothing is visible until a firm exists.
3. Create a test firm with the script, run the two-firm isolation test,
   then delete the test firms.
4. Create the first real firm.

**Rollback:** remove `/firm` and `/i` from the deploy. The tables can stay,
and existing clients keep access because they're on `access_invites`.

## Open Questions

- Exact wording of the sharing notice. This can be tuned without changing
  behavior.
- Whether lawyers want the client list filterable by status once firms have
  many clients.

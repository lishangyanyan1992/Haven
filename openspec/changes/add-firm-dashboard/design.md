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

### Link token stored in plain form

The token is 32 random bytes, encoded URL-safe, and the page is
`/i/<token>`. It's stored as-is so lawyers can copy it any time.

*Alternative considered:* store only a hash. Rejected because the lawyer
couldn't copy the link again, and a link only lets someone request a sign-up
email to their own inbox, so a leaked token is low-value. Replacing the link
is the remedy if it leaks.

### Joining is a two-step "claim"

```
 /i/<token>  --email-->  requestFirmIntakeAction
                           |  link active?  rate limits ok?
                           |  email is lawyer / other firm's client? -> no-op
                           |  upsert firm_clients (email_sent)
                           |  no auth user -> inviteUserByEmail
                           |  has auth user -> password-reset email
                           v
                    same reply every time
 email link -> /reset-password -> /login -> signInAction
                           |
                           v
                claimFirmInvite(user)   <-- runs BEFORE isInvitedEmail
                  if confirmed email matches a pending firm_clients row:
                    set user_id, joined_at; insert access_invites
                           |
                           v
                isInvitedEmail (now true) -> onboarding
```

Access is granted only at sign-in, by someone holding that mailbox, which
keeps the mailbox-ownership guarantee from the invite-only work. The claim
must run before the invite check, because the invite row is created by the
claim itself.

*Alternative considered:* insert into `access_invites` as soon as the email
is entered. Rejected because anyone holding the link could then grant
access to an address they don't own, if any sign-up path ever skipped
confirmation.

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

Every send is logged in `firm_intake_sends`, and the action checks counts
before sending: at most 3 per email per hour, 10 per visitor per hour, and
100 per link per day. The visitor is identified by a salted IP hash, so the
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

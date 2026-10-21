# Tasks

## 1. Database

- [ ] 1.1 Add migration `0033_firms.sql` with `firms`, `firm_members`, `firm_intake_links`, `firm_clients` and `firm_intake_sends`. Include the unique rules from design.md (one firm per lawyer, one firm per client email, at most one unrevoked link per firm), a security-definer `haven_firm_id()`, and row policies that let a lawyer read only their own firm's rows and give clients and signed-out visitors no access. Verify with `db push --dry-run` showing only this migration, then apply it and verify: a signed-out read of each table returns nothing, and `haven_firm_id()` returns null for a non-lawyer.
- [ ] 1.2 Add the new tables to `src/types/database.ts` and verify `npm run typecheck` passes.

## 2. Firm access helpers

- [ ] 2.1 Add `src/lib/firms/access.ts` with `requireFirmMember()`, which returns `{ firmId, lawyer }` or redirects, `getFirmMembership(userId)`, and `getFirmClient(firmId, firmClientId)`, which always filters by both. Add `evals/firms/isolation.check.ts` and verify it passes. It should fail if any exported function in `src/lib/firms/` reads `firm_clients`, `user_profiles` or `user_documents` without a `firm_id` taken from `requireFirmMember()`. Add it to `package.json` as `check:firm-isolation` and to CI.
- [ ] 2.2 Add `src/lib/firms/status.ts` with one function that turns a firm client row and profile into email sent / signed up / in progress / finished, next to onboarding's progress rules. Add `evals/firms/status.check.ts` covering each status and the New rule, and verify it passes.

## 3. Owner script

- [ ] 3.1 Add `scripts/firm-admin.ts` with `create-firm`, `add-lawyer`, `remove-lawyer` and `show-link`. It refuses emails that are already a lawyer or a client, and lawyer invites go through `inviteUserByEmail`. Document usage in `apps/haven/README.md`. Verify by creating a test firm and lawyer on the live project: the lawyer receives the invite email, and `show-link` prints a working `/i/<token>` address.

## 4. Lawyer sign-in and routing

- [ ] 4.1 In `signInAction`, send firm members to `/firm` before the invite check and skip profile setup for them. Add `/firm` to `proxy.ts` with its own check: signed out goes to `/login`, and a signed-in non-lawyer goes to the signed-in home. Also send firm members who open client-product pages to `/firm` instead of the invite chat. Verify in the browser that the test lawyer lands on `/firm` after setting a password and signing in, and that the owner account is turned away from `/firm`.

## 5. Intake link and joining

- [ ] 5.1 Build `/i/[token]` for each link state. A working link shows the firm name, the sharing notice and an email box. A turned-off link shows a "not active" message. An unknown or replaced link shows "not valid" and never reveals a firm name. Verify each state in the browser.
- [ ] 5.2 Add `requestFirmIntakeAction`. It checks the link and the rate limits (3 per email per hour, 10 per visitor per hour, 100 per link per day, with a salted IP hash), ignores emails that belong to lawyers or other firms' clients, records a pending `firm_clients` row, and sends either the invite email or a password-reset email. Every case gets the same reply. Add `evals/firms/intake.check.ts` covering new email, other firm's client, lawyer email, returning client and each limit, and verify it passes.
- [ ] 5.3 Add `claimFirmInvite(user)`, called in `signInAction` before the invite check. If the confirmed email matches a pending row, it sets `user_id` and `joined_at` and adds the email to `access_invites`. Verify end to end with a test mailbox: enter the email on the test firm's link, open the emailed link, set a password, sign in, and land on setup. Also verify that the same email entered on a second test firm's link does not move the client.
- [ ] 5.4 Set `completed_at` on the client's `firm_clients` row when onboarding finishes. Verify that finishing setup with the test client sets it and leaves other rows untouched.

## 6. Client-side notices and documents

- [ ] 6.1 Show the sharing reminder on every setup step and on the document page for firm clients, naming their firm. Verify in the browser as the test client, and that a non-firm account sees no reminder.
- [ ] 6.2 Make `documentContextAvailableFor` async and true for joined firm clients as well as the test list, then update its callers. Verify `npm run typecheck` passes, that the test client can upload a document, and that an account on neither list still gets the "not part of Haven" page.

## 7. Dashboard

- [ ] 7.1 Build `/firm`: the client list (name or email, visa, status, document count, joined date, newest first), the New badge and count, the empty state, and the link controls (copy, turn off/on, replace with confirmation). Verify in the browser with the test firm: each status appears, turning the link off makes `/i/<token>` show "not active", and replacing it makes the old address show "not valid".
- [ ] 7.2 Build `/firm/clients/[id]`: setup answers grouped like the setup steps, with "not provided" for gaps, and the documents list. Opening the page sets `reviewed_at` if it's empty. Show nothing from chats. Verify in the browser that the New badge clears for a second test lawyer, and that the page shows no chat content for a client who has used the chat.
- [ ] 7.3 Add the document-open action. It confirms the document belongs to a client of the lawyer's firm, then returns a 5-minute signed link. Verify that a document opens, the same link fails after 5 minutes, and a document id from the other test firm is refused.

## 8. Release checks

- [ ] 8.1 Two-firm isolation test on the live project with two test firms, one lawyer and one client each, run as Firm A's lawyer. Confirm Firm B's client page shows "not found", Firm B's document is refused, a direct query with Firm A's login returns only Firm A's rows, and removing the lawyer ends access on the next page load. Record the results here, then delete the test firms, users and documents.
- [ ] 8.2 Run `npm run typecheck`, `npm run check:firm-isolation` and the existing advisor checks, and verify all pass. Run Greptile on the pull request until it scores 5/5 with no open findings.

## Workflow follow-up

- Create the first real firm with `scripts/firm-admin.ts` after the pull request is merged.
- Archive the change once it's live and checked.

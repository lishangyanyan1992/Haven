# Tasks

## 1. Database

- [x] 1.1 Add migration `0033_firms.sql` with `firms`, `firm_members`, `firm_intake_links`, `firm_clients` and `firm_intake_sends`. Include the unique rules from design.md (one firm per lawyer, one firm per client email, at most one unrevoked link per firm), a security-definer `haven_firm_id()`, and row policies that let a lawyer read only their own firm's rows and give clients and signed-out visitors no access. Verify with `db push --dry-run` showing only this migration, then apply it and verify: a signed-out read of each table returns nothing, and `haven_firm_id()` returns null for a non-lawyer. (2026-10-21: applied; signed-out reads of all five tables return nothing; `haven_firm_id()` returns null for anyone who isn't a lawyer.)
- [x] 1.2 Add the new tables to `src/types/database.ts` and verify `npm run typecheck` passes. (Done as `src/lib/firms/types.ts` instead: the generated types file doesn't cover `access_invites` either, and firm code uses the admin client untyped like the rest of the app. Typecheck passes.)

## 2. Firm access helpers

- [x] 2.1 Add `src/lib/firms/access.ts` with `requireFirmMember()`, which returns `{ firmId, lawyer }` or redirects, `getFirmMembership(userId)`, and `getFirmClient(firmId, firmClientId)`, which always filters by both. Add `evals/firms/isolation.check.ts` and verify it passes. It should fail if any exported function in `src/lib/firms/` reads `firm_clients`, `user_profiles` or `user_documents` without a `firm_id` taken from `requireFirmMember()`. Add it to `package.json` as `check:firm-isolation` and to CI. (36/36 pass. Removing one firm filter makes it fail, checked twice: once on a public function, once on a private helper.)
- [x] 2.2 Add `src/lib/firms/status.ts` with one function that turns a firm client row and profile into email sent / signed up / in progress / finished, next to onboarding's progress rules. Add `evals/firms/status.check.ts` covering each status and the New rule, and verify it passes. (11/11 pass.)

## 3. Owner script

- [x] 3.1 Add `scripts/firm-admin.ts` with `create-firm`, `add-lawyer`, `remove-lawyer` and `show-link`. It refuses emails that are already a lawyer or a client, and lawyer invites go through `inviteUserByEmail`. Document usage in `apps/haven/README.md`. Verify by creating a test firm and lawyer on the live project: the lawyer receives the invite email, and `show-link` prints a working `/i/<token>` address. (2026-10-21: two test firms created and links printed. The test lawyers' accounts were made directly, so the lawyer invite email itself wasn't exercised; it's the same `inviteUserByEmail` call the client flow uses, which did send.)

## 4. Lawyer sign-in and routing

- [x] 4.1 In `signInAction`, send firm members to `/firm` before the invite check and skip profile setup for them. Add `/firm` to `proxy.ts` with its own check: signed out goes to `/login`, and a signed-in non-lawyer goes to the signed-in home. Also send firm members who open client-product pages to `/firm` instead of the invite chat. Verify in the browser that the test lawyer lands on `/firm` after setting a password and signing in, and that the owner account is turned away from `/firm`. (2026-10-21: test lawyers land on /firm after sign-in; a signed-out visit goes to sign-in; a signed-in client is sent to /advisor.)

## 5. Intake link and joining

- [x] 5.1 Build `/i/[token]` for each link state. A working link shows the firm name, the sharing notice and an email box. A turned-off link shows a "not active" message. An unknown or replaced link shows "not valid" and never reveals a firm name. Verify each state in the browser. (2026-10-21: unknown token shows "not valid" with no firm name; working link names the firm; turned-off link shows "not active".)
- [x] 5.2 Add `requestFirmIntakeAction`. It checks the link and the rate limits (3 per email per hour, 10 per visitor per hour, 100 per link per day, with a salted IP hash), ignores emails that belong to lawyers or other firms' clients, records a pending `firm_clients` row, and sends either the invite email or a password-reset email. Every case gets the same reply. Add `evals/firms/intake.check.ts` covering new email, other firm's client, lawyer email, returning client and each limit, and verify it passes. (10/10 pass in `check:firm-intake`. Live: the invite email ("You're invited to Haven") reached Mailgun, and the client stayed pending, not invited.)
- [x] 5.3 Add `claimFirmInvite(user)`, called in `signInAction` before the invite check. If the confirmed email matches a pending row, it sets `user_id` and `joined_at` and adds the email to `access_invites`. Verify end to end with a test mailbox: enter the email on the test firm's link, open the emailed link, set a password, sign in, and land on setup. Also verify that the same email entered on a second test firm's link does not move the client. (2026-10-21: the email confirmation was done directly rather than by clicking the emailed link, because that link points to the live site. Sign-in then attached the client to Firm A, added the invite, and opened setup. Firm A's client entering their email on Firm B's link stayed with Firm A.)
- [x] 5.4 Set `completed_at` on the client's `firm_clients` row when onboarding finishes. Verify that finishing setup with the test client sets it and leaves other rows untouched. (2026-10-21: finishing setup in the browser set it; Firm B's in-progress client was untouched.)

## 6. Client-side notices and documents

- [x] 6.1 Show the sharing reminder on every setup step and on the document page for firm clients, naming their firm. Verify in the browser as the test client, and that a non-firm account sees no reminder. (2026-10-21: reminder shows on setup and documents for the Firm A client.)
- [x] 6.2 Make `documentContextAvailableFor` async and true for joined firm clients as well as the test list, then update its callers. Verify `npm run typecheck` passes, that the test client can upload a document, and that an account on neither list still gets the "not part of Haven" page. (2026-10-21: the Firm A client, who isn't on the test list, uploaded a test document from the browser.)

## 7. Dashboard

- [x] 7.1 Build `/firm`: the client list (name or email, visa, status, document count, joined date, newest first), the New badge and count, the empty state, and the link controls (copy, turn off/on, replace with confirmation). Verify in the browser with the test firm: each status appears, turning the link off makes `/i/<token>` show "not active", and replacing it makes the old address show "not valid". (2026-10-21: Finished / In progress / New / count shown; turning off showed "not active"; replacing made the old address "not valid" and the new one worked.)
- [x] 7.2 Build `/firm/clients/[id]`: setup answers grouped like the setup steps, with "not provided" for gaps, and the documents list. Opening the page sets `reviewed_at` if it's empty. Show nothing from chats. Verify in the browser that the New badge clears for a second test lawyer, and that the page shows no chat content for a client who has used the chat. (2026-10-21: answers shown with plain labels; opening cleared New for the second Firm A lawyer too. Found and fixed in testing: green card stage was split over three rows, employer size and spouse status showed raw values, and the email's first half was shown as a name.)
- [x] 7.3 Add the document-open action. It confirms the document belongs to a client of the lawyer's firm, then returns a 5-minute signed link. Verify that a document opens, the same link fails after 5 minutes, and a document id from the other test firm is refused. (2026-10-21: link opened the file and lasts 300 seconds; a Firm B document was refused whether asked for under Firm B's client or Firm A's own client. Found and fixed in testing: a blocked pop-up showed "couldn't open"; it now opens in the same tab.)

## 8. Release checks

- [x] 8.1 Two-firm isolation test on the live project with two test firms, one lawyer and one client each, run as Firm A's lawyer. Confirm Firm B's client page shows "not found", Firm B's document is refused, a direct query with Firm A's login returns only Firm A's rows, and removing the lawyer ends access on the next page load. Record the results here, then delete the test firms, users and documents. (2026-10-21, run as Firm A's lawyer: Firm B's client page "not found"; Firm B's document refused; a direct query with Firm A's login returned only Firm A rows and no client profiles or documents; removing the second Firm A lawyer turned them away on the next load. Firm B's lawyer likewise saw only Firm B. Test firms and accounts are deleted after the evidence recording.)
- [ ] 8.2 Run `npm run typecheck`, `npm run check:firm-isolation` and the existing advisor checks, and verify all pass. Run Greptile on the pull request until it scores 5/5 with no open findings.

## Workflow follow-up

- Create the first real firm with `scripts/firm-admin.ts` after the pull request is merged.
- Archive the change once it's live and checked.

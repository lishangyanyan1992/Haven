/**
 * Joining a firm through its intake link (specs/firm-intake).
 *
 * The page gives every email the same reply. This checks what Haven does
 * behind it, and that joining needs the one-time code from the email: an
 * ordinary sign-in with the same address must never be enough.
 *
 * The send limits live in the database (firm_intake_reserve_send) so that
 * parallel requests can't slip past them; they're tested against the live
 * project, not here.
 *
 * Run: npm run check:firm-intake
 */

export {};

async function main() {
  const { decideIntake, claimTokenMatches, hashClaimToken, validateIntakeName, validateIntakePhone } = await import("@/lib/firms/intake");
  const { OWNER_EMAIL } = await import("@/lib/access-constants");
  const fs = await import("node:fs");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  type Input = Parameters<typeof decideIntake>[0];
  const base: Input = { email: "client@example.com", linkFirmId: "firm-a", isLawyer: false, existingClient: null };
  const run = (name: string, overrides: Partial<Input>, expected: string) => {
    const got = decideIntake({ ...base, ...overrides });
    const label = got.action === "ignore" ? `ignore:${got.reason}` : got.action;
    check(name, label === expected, `expected ${expected}, got ${label}`);
  };

  run("new email gets an invite", {}, "invite_new");
  run("pending client of the same firm gets a fresh email", { existingClient: { firm_id: "firm-a", joined_at: null } }, "resend_same_firm");
  run("joined client of the same firm gets nothing new", { existingClient: { firm_id: "firm-a", joined_at: "2026-10-21" } }, "ignore:already_joined");
  run("client of another firm is left alone", { existingClient: { firm_id: "firm-b", joined_at: null } }, "ignore:other_firm");
  run("lawyer email is left alone", { isLawyer: true }, "ignore:lawyer");
  run("owner email is left alone", { email: OWNER_EMAIL }, "ignore:owner");

  const code = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  check("code: the emailed code matches", claimTokenMatches(code, hashClaimToken(code)), "should match");
  check("code: a different code doesn't", !claimTokenMatches(`${code}x`, hashClaimToken(code)), "should not match");
  check("code: no code doesn't", !claimTokenMatches("", hashClaimToken(code)), "should not match");
  check("code: nothing stored doesn't", !claimTokenMatches(code, null), "should not match");
  check("code: only the hash is stored", hashClaimToken(code) !== code && /^[0-9a-f]{64}$/.test(hashClaimToken(code)), "store a hash");

  // Phone and name validation for mandatory lead collection.
  check("phone validation: accepts valid US format", validateIntakePhone("(415) 555-0199"), "valid formatted phone should pass");
  check("phone validation: accepts raw digits", validateIntakePhone("4155550199"), "valid 10 digits should pass");
  check("phone validation: rejects too short", !validateIntakePhone("123"), "short number should fail");
  check("phone validation: rejects empty", !validateIntakePhone(""), "empty phone should fail");
  check("name validation: accepts full name", validateIntakeName("Jane Doe"), "valid name should pass");
  check("name validation: rejects empty string or spaces", !validateIntakeName("   "), "whitespace-only name should fail");

  // Ordinary sign-in must not join anyone to a firm.
  const actions = fs.readFileSync(new URL("../../src/server/actions.ts", import.meta.url), "utf8");
  const signIn = actions.slice(actions.indexOf("export async function signInAction"), actions.indexOf("export async function signUpAction"));
  check("sign-in never joins a firm", !/claimFirmInvite\s*\(/.test(signIn), "signInAction must not call claimFirmInvite");

  // And the chat must never write the firm's copy of setup answers.
  const service = fs.readFileSync(new URL("../../src/lib/advisor/service.ts", import.meta.url), "utf8");
  check("the chat never writes shared answers", !/recordFirmSharedAnswers/.test(service), "only setup and settings may call recordFirmSharedAnswers");

  // claimFirmInvite must explicitly reject lawyer accounts.
  const intakeSrc = fs.readFileSync(new URL("../../src/lib/firms/intake.ts", import.meta.url), "utf8");
  const claimStart = intakeSrc.indexOf("export async function claimFirmInvite");
  const claimBody = intakeSrc.slice(claimStart, intakeSrc.indexOf("async function grantAccess", claimStart));
  check("claimFirmInvite rejects lawyers", /from\("firm_members"\)/.test(claimBody), "claimFirmInvite must check firm_members to reject lawyers");

  // firm-admin must check access_invites and user_profiles to reject client accounts as lawyers.
  const adminSrc = fs.readFileSync(new URL("../../scripts/firm-admin.ts", import.meta.url), "utf8");
  check("firm-admin rejects client accounts as lawyers", /from\("access_invites"\)/.test(adminSrc) && /from\("user_profiles"\)/.test(adminSrc), "firm-admin must check access_invites and user_profiles");

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * What happens to an email entered on a firm's intake link (specs/firm-intake).
 * Every case gets the same reply on the page; this checks what Haven does
 * behind it.
 *
 * Run: npm run check:firm-intake
 */

export {};

async function main() {
  const { decideIntake, INTAKE_LIMITS } = await import("@/lib/firms/intake");
  const { OWNER_EMAIL } = await import("@/lib/access-constants");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  type Input = Parameters<typeof decideIntake>[0];
  const base: Input = {
    email: "client@example.com",
    linkFirmId: "firm-a",
    isLawyer: false,
    existingClient: null,
    counts: { email: 0, visitor: 0, link: 0 }
  };
  const run = (name: string, overrides: Partial<Input>, expected: string) => {
    const got = decideIntake({ ...base, ...overrides });
    const label = got.action === "ignore" ? `ignore:${got.reason}` : got.action;
    check(name, label === expected, `expected ${expected}, got ${label}`);
  };

  run("new email gets an invite", {}, "invite_new");
  run("returning client of the same firm gets an email again", { existingClient: { firm_id: "firm-a" } }, "resend_same_firm");
  run("client of another firm is left alone", { existingClient: { firm_id: "firm-b" } }, "ignore:other_firm");
  run("lawyer email is left alone", { isLawyer: true }, "ignore:lawyer");
  run("owner email is left alone", { email: OWNER_EMAIL }, "ignore:owner");
  run("same email too often", { counts: { email: INTAKE_LIMITS.perEmailPerHour, visitor: 0, link: 0 } }, "ignore:rate_limited");
  run("same visitor too often", { counts: { email: 0, visitor: INTAKE_LIMITS.perVisitorPerHour, link: 0 } }, "ignore:rate_limited");
  run("link used too often today", { counts: { email: 0, visitor: 0, link: INTAKE_LIMITS.perLinkPerDay } }, "ignore:rate_limited");
  run("just under every limit still sends", {
    counts: { email: INTAKE_LIMITS.perEmailPerHour - 1, visitor: INTAKE_LIMITS.perVisitorPerHour - 1, link: INTAKE_LIMITS.perLinkPerDay - 1 }
  }, "invite_new");
  run("limits apply before anything else", { isLawyer: true, counts: { email: 99, visitor: 0, link: 0 } }, "ignore:rate_limited");

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

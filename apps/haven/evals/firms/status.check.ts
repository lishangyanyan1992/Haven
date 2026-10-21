/**
 * Firm client status and the New badge (specs/firm-dashboard).
 *
 * Run: npm run check:firm-status
 */

export {};

async function main() {
  const { firmClientStatus, isNewFirmClient } = await import("@/lib/firms/status");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const now = "2026-10-21T00:00:00Z";
  const stub = { country_of_birth: "", employer_name: null, preference_category: "Not sure" };

  const cases: [string, Parameters<typeof firmClientStatus>[0], Parameters<typeof firmClientStatus>[1], string][] = [
    ["entered email only", { joined_at: null, completed_at: null }, null, "email_sent"],
    ["joined, no profile yet", { joined_at: now, completed_at: null }, null, "signed_up"],
    ["joined, placeholder profile", { joined_at: now, completed_at: null }, stub, "signed_up"],
    ["saved step one", { joined_at: now, completed_at: null }, { ...stub, country_of_birth: "India" }, "in_progress"],
    ["saved employment only", { joined_at: now, completed_at: null }, { ...stub, employer_name: "Acme" }, "in_progress"],
    ["saved green card only", { joined_at: now, completed_at: null }, { ...stub, preference_category: "EB-2" }, "in_progress"],
    ["finished setup", { joined_at: now, completed_at: now }, { ...stub, country_of_birth: "India" }, "finished"],
    ["finished wins over a sparse profile", { joined_at: now, completed_at: now }, stub, "finished"]
  ];
  for (const [name, client, profile, expected] of cases) {
    const got = firmClientStatus(client, profile);
    check(`status: ${name}`, got === expected, `expected ${expected}, got ${got}`);
  }

  check("new: finished and not opened", isNewFirmClient({ completed_at: now, reviewed_at: null }), "should be New");
  check("new: finished and opened", !isNewFirmClient({ completed_at: now, reviewed_at: now }), "should not be New");
  check("new: not finished", !isNewFirmClient({ completed_at: null, reviewed_at: null }), "should not be New");

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

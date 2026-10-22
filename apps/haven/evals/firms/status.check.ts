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

  const cases: [string, Parameters<typeof firmClientStatus>[0], Parameters<typeof firmClientStatus>[1], string][] = [
    ["entered email only", { joined_at: null, completed_at: null }, {}, "email_sent"],
    ["joined, nothing saved", { joined_at: now, completed_at: null }, {}, "signed_up"],
    ["joined, no answers copy", { joined_at: now, completed_at: null }, null, "signed_up"],
    ["saved step one", { joined_at: now, completed_at: null }, { visaType: "H1B", countryOfBirth: "India" }, "in_progress"],
    ["saved employment only", { joined_at: now, completed_at: null }, { employerName: "Acme" }, "in_progress"],
    ["finished setup", { joined_at: now, completed_at: now }, { countryOfBirth: "India" }, "finished"],
    ["finished with sparse answers", { joined_at: now, completed_at: now }, {}, "finished"]
  ];
  for (const [name, client, answers, expected] of cases) {
    const got = firmClientStatus(client, answers);
    check(`status: ${name}`, got === expected, `expected ${expected}, got ${got}`);
  }

  const { pickSharedAnswers, sharedAnswersFromProfile } = await import("@/lib/firms/answers");
  const picked = pickSharedAnswers({ visaType: "H1B", employerName: "  ", topConcerns: [], countryOfBirth: "India", unrelated: "x" });
  check(
    "answers: keeps only answered setup fields",
    JSON.stringify(picked) === JSON.stringify({ visaType: "H1B", countryOfBirth: "India" }),
    `got ${JSON.stringify(picked)}`
  );
  check(
    "answers: chat-only fields are never copied",
    !("employment_status" in sharedAnswersFromProfile({ country_of_birth: "India", employment_status: "laid_off", visa_type: "H1B" })) &&
      !("employmentStatus" in sharedAnswersFromProfile({ country_of_birth: "India", employment_status: "laid_off", visa_type: "H1B" })),
    "employment status is set by the chat and must not be shared"
  );
  check(
    "answers: green card stage from profile",
    sharedAnswersFromProfile({ country_of_birth: "India", i140_approved: true, perm_stage: "not_started" }).greenCardStage === "i140_approved",
    "expected i140_approved"
  );

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

/**
 * The list of details read per document type: every detail goes to a real
 * field, and the "Haven will take…" sentence matches the list.
 *
 * Run: npm run check:fact-catalog
 */

export {};

async function main() {
  const { FACT_SETS, factSetFor, willTakeSentence } = await import("@/lib/document-facts/catalog");
  const { twoEmployerProfile } = await import("../dashboard/fixtures");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // Every target must be a field people can see and change.
  const profileFields = new Set([...Object.keys(twoEmployerProfile()), "statusEndDate"]);
  const petitionFields = new Set([
    "sponsorName", "i140ReceiptNumber", "priorityDate", "preferenceCategory",
    "i140FiledDate", "i140ApprovalDate", "permFilingDate", "permCertifiedDate"
  ]);
  const bad: string[] = [];
  for (const set of Object.values(FACT_SETS)) {
    for (const fact of set.facts) {
      if (!fact.target) continue;
      const ok = fact.target.startsWith("petition.")
        ? set.sponsorScoped && petitionFields.has(fact.target.slice("petition.".length))
        : profileFields.has(fact.target);
      if (!ok) bad.push(`${fact.key} → ${fact.target}`);
    }
  }
  check("every detail fills a real profile or green card field", bad.length === 0, bad.join(", "));

  const keys = Object.values(FACT_SETS).flatMap((s) => s.facts.map((f) => f.key));
  check("detail keys are unique", new Set(keys).size === keys.length);

  check(
    "I-140 sentence names every detail and the sponsor",
    willTakeSentence("i140_notice", "Acme Insurance") ===
      "Haven will take the sponsor, receipt number, priority date, category, filing date and approval date and fill them into Acme Insurance's green card.",
    willTakeSentence("i140_notice", "Acme Insurance")
  );
  check(
    "paystub: no details",
    willTakeSentence("paystub") === "Haven keeps this document but doesn't take any details from it."
  );
  check(
    "H-1B approval: says which details are shown only",
    willTakeSentence("h1b_petition").includes("shown on the document only"),
    willTakeSentence("h1b_petition")
  );
  check("general USCIS notice naming I-140 uses the I-140 list", factSetFor("uscis_notice", "Form I-797 ... I-140 IMMIGRANT PETITION")?.id === "i140");
  check("general USCIS notice naming I-129 uses the H-1B list", factSetFor("uscis_notice", "Case Type: I129 PETITION")?.id === "h1b_approval");
  check("unknown notice has no details", factSetFor("uscis_notice", "Biometrics appointment") === null);

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

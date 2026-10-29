/**
 * Every kind of green card can be entered: family, investor, humanitarian and
 * lottery green cards get their own steps and dates, and are never held to
 * PERM or I-140 rules.
 *
 * Run: npm run check:green-card-paths
 */

export {};

async function main() {
  const { validatePetition, normalizePetitions } = await import("@/lib/petitions");
  const { dateFieldsFor, stagesFor, changesForType, sponsorFieldFor, PATHWAY_OPTIONS } = await import("@/lib/green-card-forms");
  const { chosenGreenCardStage } = await import("@/lib/visas");
  const { expandRequiredDocuments } = await import("@/lib/sponsor-documents");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const marriage = {
    id: "pet-spouse",
    sponsorName: "Jordan Lee (spouse)",
    petitionType: "family_marriage_usc",
    preferenceCategory: "Immediate Relative (Spouse)",
    stage: "i485_filed",
    petitionFiledDate: "2025-01-10",
    petitionApprovalDate: "2025-06-02"
  };

  // 1. Checks
  check("marriage at I-485 filed: no I-140 date asked", validatePetition(marriage).length === 0, JSON.stringify(validatePetition(marriage)));
  const familyWithPd = { ...marriage, petitionType: "family_marriage_lpr", stage: "i130_filed", priorityDate: "2025-01-10" };
  check("family priority date: no PERM rule", validatePetition(familyWithPd).length === 0, JSON.stringify(validatePetition(familyWithPd)));
  check(
    "family approval before filing: caught",
    validatePetition({ ...marriage, petitionApprovalDate: "2024-12-01" }).some((e) => e.field === "petitionApprovalDate")
  );
  const employer = { id: "pet-e", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "i485_filed" };
  check("employer at I-485 filed still needs the I-140 approval date", validatePetition(employer).some((e) => e.field === "i140ApprovalDate"));

  // 2. Saved and read back
  const [read] = normalizePetitions([{ ...marriage }]);
  check(
    "marriage green card saved as entered",
    read.petitionType === "family_marriage_usc" && read.stage === "i485_filed" && read.petitionFiledDate === "2025-01-10" && read.preferenceCategory === "Immediate Relative (Spouse)",
    JSON.stringify(read)
  );

  // 3. Fields per kind
  const keys = (type: string) => dateFieldsFor(type).map((f) => f.key).join();
  check("employer: PERM and I-140 dates", keys("employer_sponsored") === "permFilingDate,permCertifiedDate,i140FiledDate,i140ApprovalDate,priorityDate");
  check("self-petition: I-140 dates, no PERM", keys("self_petition_niw") === "i140FiledDate,i140ApprovalDate,priorityDate");
  check(
    "marriage: I-130 dates, no PERM or I-140",
    keys("family_marriage_usc") === "petitionFiledDate,petitionApprovalDate,priorityDate" &&
      dateFieldsFor("family_marriage_usc")[0].label === "I-130 filed"
  );
  check("EB-5: I-526 dates", dateFieldsFor("investment_eb5")[0].label === "I-526 filed");
  check("asylum adjustment: no petition or priority date", keys("humanitarian_asylum") === "");
  check(
    "marriage steps: I-130, I-485, conditional resident",
    ["i130_filed", "i485_filed", "conditional_resident"].every((s) => stagesFor("family_marriage_usc").some((x) => x.id === s)) &&
      !stagesFor("family_marriage_usc").some((x) => x.id === "perm_in_progress")
  );
  check("current step kept even if it belongs to another kind", stagesFor("family_marriage_usc", "i140_approved").some((x) => x.id === "i140_approved"));
  check("family sponsor is the petitioner", sponsorFieldFor("family_preference").label.startsWith("Petitioner"));
  check(
    "every kind is offered",
    ["family_marriage_usc", "family_marriage_lpr", "family_preference", "employer_sponsored", "concurrent_employer", "self_petition_niw", "self_petition_eb1a", "investment_eb5", "humanitarian_asylum", "humanitarian_other", "diversity_lottery", "other"].every((id) => PATHWAY_OPTIONS.some((o) => o.id === id))
  );

  // 4. Switching kind
  const switched = changesForType(
    { ...employer, stage: "perm_in_progress", permFilingDate: "2024-01-01", i140ReceiptNumber: "IOE0912345678" } as never,
    "family_marriage_usc"
  );
  check(
    "switching to marriage: spouse category, valid step, PERM and I-140 data cleared",
    switched.preferenceCategory === "Immediate Relative (Spouse)" &&
      switched.stage === "not_started" &&
      "permFilingDate" in switched && switched.permFilingDate === undefined &&
      "i140ReceiptNumber" in switched,
    JSON.stringify(switched)
  );

  // 5. Single-step field keeps family steps
  check("Settings step: a family step is kept", chosenGreenCardStage("i130_filed", "not_started") === "i130_filed");
  check("Settings step: a work step follows the flags", chosenGreenCardStage("i140_filed", "i140_approved") === "i140_approved");

  // 6. Documents: no I-140 or PERM asked for a marriage green card
  const docs = expandRequiredDocuments({
    items: [
      { key: "i140_notice", label: "I-140 approval notice" },
      { key: "perm_certification", label: "PERM certification" }
    ],
    petitions: [read],
    documents: []
  });
  check(
    "marriage green card: I-140 and PERM not needed, with the reason",
    docs.requestedCount === 0 &&
      docs.entries.find((e) => e.key === "i140_notice")?.reason === "Not needed yet: this green card doesn't use an I-140" &&
      docs.entries.find((e) => e.key === "perm_certification")?.reason === "Not needed yet: this green card doesn't go through PERM",
    JSON.stringify(docs.entries)
  );

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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

  // 7. Review fixes: steps, timeline, lawyer summary, onboarding checks.
  const { getStagesForPathway } = await import("@/lib/visas");
  const { buildPetitionTracks, inferProfileGreenCardStage, buildImmigrationJourney } = await import("@/lib/immigration-journey");
  const { greenCardLine } = await import("@/lib/firms/green-cards");
  const { onboardingStepThreeSchema } = await import("@/lib/validation");
  const { twoEmployerProfile } = await import("./fixtures");
  const ids = (t: string) => getStagesForPathway(t).map((s) => s.id);
  check("second employer: PERM steps offered", ids("concurrent_employer").includes("perm_in_progress"));
  check(
    "employer and self-petition: permanent resident offered",
    ids("employer_sponsored").includes("i485_approved") && ids("self_petition_niw").includes("i485_approved")
  );

  const spouseProfile = twoEmployerProfile({ immigrantPetitions: [{ ...read, stage: "i130_filed" }] as never, i140Approved: false, permStage: "not_started", retainedPriorityDate: undefined, priorityDate: undefined });
  const [spouseTrack] = buildPetitionTracks(spouseProfile, new Date("2026-10-28T12:00:00Z"));
  check(
    "marriage row: I-130, wait in line, green card — no PERM or I-140",
    spouseTrack.stages.map((st) => st.key).join() === "petition,bulletin_queue,i485" && spouseTrack.stages[0].label === "I-130" && spouseTrack.stages[0].status === "current",
    JSON.stringify(spouseTrack.stages)
  );
  const journey = buildImmigrationJourney({ profile: spouseProfile, signals: { layoffReadinessScore: "medium", layoffReadinessReasoning: [] } as never, now: new Date("2026-10-28T12:00:00Z") } as never);
  const nodeKeys = journey.greenCardTrack.nodes.map((n) => n.key);
  check(
    "marriage timeline: no PERM or I-140 milestones, I-130 shown as filed",
    !nodeKeys.includes("perm") && !nodeKeys.includes("i140") && journey.greenCardTrack.nodes[0].badgeText === "Filed / Pending",
    JSON.stringify(journey.greenCardTrack.nodes.map((n) => [n.key, n.status, n.badgeText]))
  );
  const asylumProfile = twoEmployerProfile({ immigrantPetitions: [{ id: "asy", sponsorName: "Asylum adjustment", petitionType: "humanitarian_asylum", preferenceCategory: "Asylum Adjustment", stage: "i485_filed" }] as never, i140Approved: false, permStage: "not_started" });
  const asylumJourney = buildImmigrationJourney({ profile: asylumProfile, signals: { layoffReadinessScore: "medium", layoffReadinessReasoning: [] } as never, now: new Date("2026-10-28T12:00:00Z") } as never);
  check(
    "asylum timeline: no first-petition step",
    !asylumJourney.greenCardTrack.nodes.some((n) => n.key === "petition" || n.key === "perm" || n.key === "i140"),
    JSON.stringify(asylumJourney.greenCardTrack.nodes.map((n) => n.key))
  );
  const saved = twoEmployerProfile({ immigrantPetitions: undefined, i140Approved: false, permStage: "not_started", greenCardStage: "i130_filed" });
  check("saved step with no green card record: shown", inferProfileGreenCardStage(saved) === "i130_filed");

  check(
    "lawyer summary: EB-5 names its own form",
    greenCardLine({ id: "x", sponsorName: "Golden Gate RC", petitionType: "investment_eb5", preferenceCategory: "EB-5", stage: "i130_filed", petitionFiledDate: "2025-03-01" }).includes("I-526 filed Mar 1, 2025"),
    greenCardLine({ id: "x", sponsorName: "Golden Gate RC", petitionType: "investment_eb5", preferenceCategory: "EB-5", stage: "i130_filed", petitionFiledDate: "2025-03-01" })
  );
  check(
    "onboarding checks: typo in a step or category is refused",
    !onboardingStepThreeSchema.safeParse({ greenCardStage: "i485_flied", preferenceCategory: "EB-2", i140Approved: false }).success &&
      onboardingStepThreeSchema.safeParse({ greenCardStage: "i130_filed", preferenceCategory: "F-2A", i140Approved: false }).success
  );

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

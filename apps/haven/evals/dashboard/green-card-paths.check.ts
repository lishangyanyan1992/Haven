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
  const { buildPetitionTracks, inferProfileGreenCardStage, buildImmigrationJourney } = await import("@/lib/immigration-journey");
  const { greenCardLine } = await import("@/lib/firms/green-cards");
  const { getStagesForPathway } = await import("@/lib/visas");
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
    "asylum timeline: only the green card step (no petition, PERM, I-140, priority date or queue)",
    asylumJourney.greenCardTrack.nodes.map((n) => n.key).join() === "i485",
    JSON.stringify(asylumJourney.greenCardTrack.nodes.map((n) => n.key))
  );
  const consularProfile = twoEmployerProfile({ immigrantPetitions: [{ id: "emp", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "consular_processing", i140ApprovalDate: "2025-01-01" }] as never });
  const consularJourney = buildImmigrationJourney({ profile: consularProfile, signals: { layoffReadinessScore: "medium", layoffReadinessReasoning: [] } as never, now: new Date("2026-10-28T12:00:00Z") } as never);
  check(
    "employer green card in consular processing keeps its I-140 milestone",
    consularJourney.greenCardTrack.nodes.some((n) => n.key === "i140"),
    JSON.stringify(consularJourney.greenCardTrack.nodes.map((n) => n.key))
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

  // 8. Round 4 fixes.
  const { providesI140Protection } = await import("@/lib/petitions");
  const { flatFieldsFrom } = await import("@/lib/petition-save");
  const familyAtI485 = { ...marriage, stage: "i485_filed", priorityDate: "2025-01-10" };
  check("family green card at I-485: no I-140 protection", !providesI140Protection(familyAtI485 as never));
  const flags = flatFieldsFrom([{ ...familyAtI485, stage: "i130_filed" }] as never, {});
  check("family green card: I-140 filed/approved flags stay off", flags.i140_filed === false && flags.i140_approved === false, JSON.stringify(flags));
  const consularNode = consularJourney.greenCardTrack.nodes.find((n) => n.key === "i485");
  check("employer consular: last step says consular processing", consularNode?.shortLabel === "Consular processing" && consularNode.status === "current");

  // 9. Final-round fixes.
  const { displayedPetitionStage } = await import("@/lib/immigration-journey");
  check(
    "approved I-140 in consular processing keeps its protection",
    providesI140Protection({ id: "c", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "consular_processing", i140ApprovalDate: "2025-01-01" } as never)
  );
  const consularNoDate = validatePetition({ id: "c0", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "consular_processing" } as never);
  check("employer consular processing asks for the I-140 approval date", consularNoDate.some((e) => e.field === "i140ApprovalDate"), JSON.stringify(consularNoDate));
  const doneProfile = twoEmployerProfile({ immigrantPetitions: [{ ...marriage, stage: "i485_approved" }] as never });
  check("approved green card shows as permanent resident", displayedPetitionStage(doneProfile) === "i485_approved", displayedPetitionStage(doneProfile));
  const { normalizeDraft } = await import("@/lib/profile-sync");
  const noStage = normalizeDraft({ visaType: "H1B" } as never, {}) as Record<string, unknown>;
  check(
    "save step: no stage sent leaves PERM, I-140 and I-485 flags alone",
    !("perm_stage" in noStage) && !("i140_filed" in noStage) && !("i485_filed" in noStage),
    Object.keys(noStage).join(",")
  );
  const withStage = normalizeDraft({ visaType: "H1B", greenCardStage: "i140_filed" } as never, {}) as Record<string, unknown>;
  check(
    "save step: a sent stage writes the matching flags",
    withStage.perm_stage !== undefined && withStage.i140_filed === true && withStage.i485_filed === false,
    JSON.stringify({ perm: withStage.perm_stage, i140: withStage.i140_filed, i485: withStage.i485_filed })
  );
  const savedOnly = (stage: string) => inferProfileGreenCardStage({ ...twoEmployerProfile({ immigrantPetitions: [] as never }), i140Filed: false, i140Approved: false, permStage: "not_started", greenCardStage: stage } as never);
  const approvedActive = inferProfileGreenCardStage({ ...twoEmployerProfile({ immigrantPetitions: [{ ...marriage, stage: "i485_approved" }] as never }), visaType: "H4", i485Filed: true } as never);
  check("approved active green card stays approved over the old I-485 flag", approvedActive === "i485_approved", approvedActive);
  check("saved 'permanent resident' step with no green card record stays approved", savedOnly("i485_approved") === "i485_approved", savedOnly("i485_approved"));
  const pwdWithOldFlag = inferProfileGreenCardStage({ ...twoEmployerProfile({ immigrantPetitions: [] as never }), i140Filed: false, i140Approved: true, permStage: "not_started", greenCardStage: "pwd_recruitment" } as never);
  check("saved 'PWD / recruitment' step beats an old I-140 approved flag", pwdWithOldFlag === "perm_in_progress", pwdWithOldFlag);
  const familyRow = { deadline_answers: { greenCardPathway: "family_marriage_usc" } };
  const familySave = normalizeDraft({ visaType: "H4", greenCardStage: "i485_filed", i140Approved: "true" } as never, familyRow) as Record<string, unknown>;
  const familyI140 = normalizeDraft({ visaType: "H4", greenCardStage: "i140_filed" } as never, familyRow) as Record<string, unknown>;
  check("family green card can't record an I-140 as filed", familyI140.i140_filed !== true, String(familyI140.i140_filed));
  check("family green card: an I-140 step isn't saved as its step", familyI140.perm_stage === undefined && !("greenCardStage" in ((familyI140.deadline_answers as Record<string, unknown>) ?? {})), JSON.stringify({ perm: familyI140.perm_stage, da: familyI140.deadline_answers }));
  const { stageOptionsFor } = await import("@/lib/visas");
  check("Settings step list for a marriage green card has no PERM or I-140", !stageOptionsFor("family_marriage_usc").some((o) => /perm|i140|pwd/.test(o.id)));
  check("employer and self-petition step lists offer consular processing", ["employer_sponsored", "self_petition_niw"].every((t) => stageOptionsFor(t).some((o) => o.id === "consular_processing")));
  const niwSave = normalizeDraft({ visaType: "H1B", greenCardStage: "i140_approved", i140Approved: "true" } as never, { deadline_answers: { greenCardPathway: "self_petition_niw" } }) as Record<string, unknown>;
  check("self-petition at I-140 approved doesn't record a PERM", niwSave.perm_stage === "not_started" && niwSave.i140_approved === true, JSON.stringify({ perm: niwSave.perm_stage, i140: niwSave.i140_approved }));
  const consularSave = normalizeDraft({ visaType: "H1B", greenCardStage: "consular_processing", i140Approved: "true" } as never, { perm_stage: "certified", deadline_answers: { greenCardPathway: "employer_sponsored" } }) as Record<string, unknown>;
  check("employer consular step keeps PERM certified and I-140 approved", consularSave.perm_stage === "certified" && consularSave.i140_approved === true, JSON.stringify({ perm: consularSave.perm_stage, i140: consularSave.i140_approved }));
  const savedConsular = inferProfileGreenCardStage({ ...twoEmployerProfile({ immigrantPetitions: [] as never }), i140Approved: true, greenCardStage: "consular_processing" } as never);
  check("saved consular step shows over the old I-140 flag", savedConsular === "consular_processing", savedConsular);
  const noPathConsular = normalizeDraft({ visaType: "H4", greenCardStage: "consular_processing" } as never, { perm_stage: "not_started" }) as Record<string, unknown>;
  check("no pathway: consular step doesn't invent a certified PERM", noPathConsular.perm_stage === "not_started", String(noPathConsular.perm_stage));
  const nsActive = inferProfileGreenCardStage({ ...twoEmployerProfile({ immigrantPetitions: [{ ...marriage, stage: "not_started" }] as never }), visaType: "H4", i485Filed: false, greenCardStage: "consular_processing" } as never);
  check("active 'not started' green card isn't overridden by an old saved step", nsActive === "not_started", nsActive);
  const nsWithFlag = inferProfileGreenCardStage({ ...twoEmployerProfile({ immigrantPetitions: [{ ...marriage, stage: "not_started" }] as never }), visaType: "H4", i485Filed: true } as never);
  check("active 'not started' green card isn't overridden by another card's I-485 flag", nsWithFlag === "not_started", nsWithFlag);
  check("Settings step list with no green card kind shows every step", stageOptionsFor(undefined).some((o) => o.id === "i140_filed"));
  const noPathI140 = normalizeDraft({ visaType: "H1B", greenCardStage: "i140_filed" } as never, {}) as Record<string, unknown>;
  check("no pathway chosen yet: I-140 filed still saves", noPathI140.i140_filed === true, String(noPathI140.i140_filed));
  check("family green card at I-485 filed doesn't get an approved I-140", familySave.i140_approved === false, String(familySave.i140_approved));
  const employerSave = normalizeDraft({ visaType: "H1B", greenCardStage: "i485_filed", i140Approved: "true" } as never, { deadline_answers: { greenCardPathway: "employer_sponsored" } }) as Record<string, unknown>;
  check("employer green card at I-485 filed keeps its approved I-140", employerSave.i140_approved === true, String(employerSave.i140_approved));
  check("saved 'PWD / recruitment' step with no green card record shows PERM in progress", savedOnly("pwd_recruitment") === "perm_in_progress", savedOnly("pwd_recruitment"));
  const { standardVisaValue } = await import("@/lib/visas");
  check("I-94 class L2S fills L-2", standardVisaValue("L2S") === "L-2", String(standardVisaValue("L2S")));
  check("asylum and lottery steps don't offer I-130", ["humanitarian_asylum", "diversity_lottery"].every((t) => !getStagesForPathway(t).some((st) => String(st.id).startsWith("i130"))));
  const { validatePetition: vp } = await import("@/lib/petitions");
  const staleFamily = vp({ id: "s", sponsorName: "Jordan", petitionType: "family_marriage_usc", preferenceCategory: "IR", stage: "i130_filed", permFilingDate: "2025-05-01", i140ApprovalDate: "2025-01-01" } as never);
  check("old PERM/I-140 dates on a family green card don't block saving", staleFamily.length === 0, JSON.stringify(staleFamily));
  const { sharedAnswersFromProfile } = await import("@/lib/firms/answers");
  const shared = sharedAnswersFromProfile({ country_of_birth: "India", deadline_answers: { greenCardStage: "i130_filed" } }) as Record<string, unknown>;
  const sharedActive = sharedAnswersFromProfile({ country_of_birth: "India", i140_filed: true, deadline_answers: { greenCardStage: "i140_filed", immigrantPetitions: [{ id: "a", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "i140_approved", i140ApprovalDate: "2025-01-01" }] } }) as Record<string, unknown>;
  check("lawyer sees the active green card's step over an older saved one", sharedActive.greenCardStage === "i140_approved", String(sharedActive.greenCardStage));
  check("lottery green card asks for no priority date", !dateFieldsFor("diversity_lottery").some((f) => f.key === "priorityDate"));
  const backToStart = flatFieldsFrom([{ id: "n", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "not_started" } as never], { i485_filed: true }) as Record<string, unknown>;
  check("moving a green card back from I-485 filed clears the I-485 flag", backToStart.i485_filed === false, String(backToStart.i485_filed));
  const earlyPd = validatePetition({ id: "e", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "not_started", priorityDate: "2025-01-01" } as never);
  check("'not started' employer green card can't hold a priority date before PERM", earlyPd.some((e) => e.field === "priorityDate"), JSON.stringify(earlyPd));
  const nsFlat = flatFieldsFrom([{ id: "n", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "not_started" } as never], { employer_name: "Acme", employment_status: "employed" }) as Record<string, unknown>;
  check("'not started' employer green card records PERM as not started", nsFlat.perm_stage === "not_started", String(nsFlat.perm_stage));
  check("lawyer sees the saved I-130 step", shared.greenCardStage === "i130_filed", String(shared.greenCardStage));
  check("typed 'H-1B' saves as H1B", standardVisaValue("H-1B") === "H1B", String(standardVisaValue("H-1B")));
  check("I-94 class L2Y does not fill L-2", standardVisaValue("L2Y") === null, String(standardVisaValue("L2Y")));

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

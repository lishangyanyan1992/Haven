/**
 * Green card petition reading, employer matching and input checks.
 * Run: npx tsx --tsconfig tsconfig.json evals/dashboard/petitions.check.ts
 */
export {};

async function main() {
  const { normalizePetitions, sponsorMatches, validatePetition, providesI140Protection } = await import("@/lib/petitions");
  const { findActivePetition, resolveEffectivePriorityDate, inferProfileGreenCardStage } = await import(
    "@/lib/immigration-journey"
  );
  const { TWO_EMPLOYER_RAW_PETITIONS, twoEmployerProfile } = await import("./fixtures");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // 1.1 Reading older records
  const petitions = normalizePetitions(TWO_EMPLOYER_RAW_PETITIONS);
  check("normalize: keeps both petitions", petitions.length === 2, `got ${petitions.length}`);
  check(
    "normalize: older petitionKind/category names are read",
    petitions.every((p) => p.petitionType === "employer_sponsored" && p.preferenceCategory === "EB-2"),
    JSON.stringify(petitions.map((p) => [p.petitionType, p.preferenceCategory]))
  );
  const legacyWithdrawn = normalizePetitions([
    { sponsorName: "Old Co", stage: "withdrawn", isWithdrawn: true, withdrawnDate: "2024-02-01" },
    { stage: "i140_approved" },
    "not a petition"
  ]);
  check(
    "normalize: withdrawn becomes ended with reason and date; records without a sponsor are dropped",
    legacyWithdrawn.length === 1 &&
      legacyWithdrawn[0].endedReason === "withdrawn" &&
      legacyWithdrawn[0].endedDate === "2024-02-01",
    JSON.stringify(legacyWithdrawn)
  );
  check("normalize: non-array input gives an empty list", normalizePetitions({ a: 1 }).length === 0);
  check(
    "normalize: missing ids are filled and unique",
    new Set(normalizePetitions([{ sponsorName: "A" }, { sponsorName: "A" }]).map((p) => p.id)).size === 2
  );

  // 1.2 Employer matching
  check("match: brand in parentheses", sponsorMatches("Harbor Ventures", "Harbor Ventures (Lakeside Insurance)"));
  check("match: parent in parentheses", sponsorMatches("Lakeside Insurance", "Harbor Ventures (Lakeside Insurance)"));
  check("match: comma part", sponsorMatches("Northwind Mutual Insurance", "Ridgeline Labs, Northwind Mutual Insurance"));
  check("match: case, punctuation and suffix", sponsorMatches("ACME, Inc.", "acme"));
  check("no match: near-miss names", !sponsorMatches("Acme Insurance Co", "Acme Insurance Group"));
  check("no match: empty names", !sponsorMatches("", "Acme") && !sponsorMatches(null, "Acme"));

  // 1.3 Input checks
  const base = { id: "x", sponsorName: "Acme", petitionType: "employer_sponsored", preferenceCategory: "EB-2" } as const;
  const fields = (p: Parameters<typeof validatePetition>[0]) => validatePetition(p).map((e) => e.field);
  check("valid: complete approved petition", validatePetition({ ...base, stage: "i140_approved", permFilingDate: "2022-01-01", i140FiledDate: "2023-01-01", i140ApprovalDate: "2023-06-01" }).length === 0);
  check("invalid: I-140 approval before filing", fields({ ...base, stage: "i140_approved", i140FiledDate: "2023-06-01", i140ApprovalDate: "2023-01-01" }).includes("i140ApprovalDate"));
  check("invalid: PERM approval before PERM filing", fields({ ...base, stage: "perm_certified", permFilingDate: "2023-06-01", permCertifiedDate: "2023-01-01" }).includes("permCertifiedDate"));
  check("invalid: I-140 approval before PERM filing", fields({ ...base, stage: "i140_approved", permFilingDate: "2023-06-01", i140ApprovalDate: "2023-01-01" }).includes("i140ApprovalDate"));
  check("invalid: approved with no approval date", fields({ ...base, stage: "i140_approved" }).includes("i140ApprovalDate"));
  check("invalid: own priority date before PERM filed", fields({ ...base, stage: "pwd_recruitment", priorityDate: "2021-01-01" }).includes("priorityDate"));
  check("valid: carried-over priority date before PERM", !fields({ ...base, stage: "pwd_recruitment", priorityDate: "2021-01-01", isPriorityDateRecaptured: true }).includes("priorityDate"));
  check("invalid: ended with no date", fields({ ...base, stage: "pwd_recruitment", endedReason: "layoff" }).includes("endedDate"));

  // Protection after a job ends
  check("protection: approved I-140 from an ended job still counts", providesI140Protection({ ...base, stage: "i140_approved", i140ApprovalDate: "2023-01-01", endedReason: "layoff", endedDate: "2024-01-01" }));
  check("protection: denied does not count", !providesI140Protection({ ...base, stage: "i140_approved", i140ApprovalDate: "2023-01-01", endedReason: "denied", endedDate: "2023-02-01" }));
  check("protection: withdrawn within 180 days does not count", !providesI140Protection({ ...base, stage: "i140_approved", i140ApprovalDate: "2023-01-01", endedReason: "withdrawn", endedDate: "2023-03-01" }));
  check("protection: withdrawn after 180 days still counts", providesI140Protection({ ...base, stage: "i140_approved", i140ApprovalDate: "2023-01-01", endedReason: "withdrawn", endedDate: "2023-12-01" }));
  check("protection: early stage does not count", !providesI140Protection({ ...base, stage: "perm_in_progress" }));

  // 1.4 Active petition and priority date
  const harborEnded = petitions.map((p) =>
    p.id === "pet-harbor-eb2" ? { ...p, endedReason: "layoff" as const, endedDate: "2026-10-08" } : p
  );
  const endedProfile = twoEmployerProfile({ immigrantPetitions: harborEnded });
  check(
    "two employers, second ended: stage comes from the approved I-140",
    inferProfileGreenCardStage(endedProfile) === "i140_approved" && findActivePetition(endedProfile)?.id === "pet-northwind-eb2",
    `stage ${inferProfileGreenCardStage(endedProfile)}, active ${findActivePetition(endedProfile)?.id}`
  );
  const pd = resolveEffectivePriorityDate(endedProfile);
  check(
    "two employers, second ended: priority date 2021-06-14 credited to the first employer",
    pd.effectiveDate?.toISOString().slice(0, 10) === "2021-06-14" &&
      pd.sourceSponsorName === "Ridgeline Labs, Northwind Mutual Insurance",
    JSON.stringify(pd)
  );
  const bothMoving = twoEmployerProfile({ immigrantPetitions: petitions, employmentStatus: "employed" });
  const pdMoving = resolveEffectivePriorityDate(bothMoving);
  check(
    "two employers, second active: second employer's petition is current and priority date is unchanged",
    findActivePetition(bothMoving)?.id === "pet-harbor-eb2" && pdMoving.effectiveDate?.toISOString().slice(0, 10) === "2021-06-14",
    `active ${findActivePetition(bothMoving)?.id}, pd ${pdMoving.effectiveDate?.toISOString()}`
  );
  const allEnded = twoEmployerProfile({
    immigrantPetitions: harborEnded.map((p) => ({ ...p, endedReason: "layoff" as const, endedDate: "2026-10-08" }))
  });
  check(
    "every petition ended: an approved I-140 still gives the priority date",
    resolveEffectivePriorityDate(allEnded).effectiveDate?.toISOString().slice(0, 10) === "2021-06-14"
  );

  // 2.1 One profile reader keeps every green card field
  const { mapProfileRow } = await import("@/lib/profile-mapper");
  const mapped = mapProfileRow({
    id: "u1",
    full_name: "Sam Rivera",
    email: "sam@example.com",
    visa_type: "H1B",
    country_of_birth: "India",
    perm_stage: "not_started",
    i140_approved: true,
    priority_date: null,
    preference_category: "EB-2",
    employment_status: "laid_off",
    top_concerns: null,
    deadline_answers: {
      statusEndDate: "2026-12-15",
      retainedPriorityDate: "2021-06-14",
      retainedPriorityDateSponsor: "Northwind Mutual Insurance",
      retainedPriorityDateCategory: "EB-2",
      greenCardSponsor: "Harbor Ventures",
      immigrantPetitions: TWO_EMPLOYER_RAW_PETITIONS
    }
  });
  check(
    "profile reader: petitions, retained date, sponsor, category and status end date all survive",
    mapped.immigrantPetitions?.length === 2 &&
      mapped.immigrantPetitions[0].preferenceCategory === "EB-2" &&
      mapped.retainedPriorityDate === "2021-06-14" &&
      mapped.retainedPriorityDateSponsor === "Northwind Mutual Insurance" &&
      mapped.retainedPriorityDateCategory === "EB-2" &&
      mapped.greenCardSponsor === "Harbor Ventures" &&
      mapped.currentVisaExpiryDate === "2026-12-15" &&
      mapped.topConcerns.length === 0,
    JSON.stringify(mapped)
  );

  // 6.1 Planning a green card save
  const { planPetitionSave } = await import("@/lib/petition-save");
  const savedRow = {
    id: "u1",
    employment_status: "laid_off",
    employer_name: "Harbor Ventures",
    preference_category: "EB-2",
    i140_approved: false,
    priority_date: null,
    perm_stage: "not_started",
    deadline_answers: { statusEndDate: "2026-12-15", immigrantPetitions: TWO_EMPLOYER_RAW_PETITIONS }
  };
  const toSave = normalizePetitions(TWO_EMPLOYER_RAW_PETITIONS).map((p) =>
    p.id === "pet-harbor-eb2" ? { ...p, endedReason: "layoff", endedDate: "2026-10-08" } : p
  );
  const plan = planPetitionSave(toSave, savedRow);
  const update = plan.ok ? (plan.update as Record<string, any>) : {};
  check(
    "save: valid list is saved in the new shape, original kept once, other answers untouched",
    plan.ok &&
      update.deadline_answers.immigrantPetitions[0].preferenceCategory === "EB-2" &&
      update.deadline_answers.immigrantPetitionsLegacy === TWO_EMPLOYER_RAW_PETITIONS &&
      update.deadline_answers.statusEndDate === "2026-12-15",
    JSON.stringify(plan)
  );
  check(
    "save: flat answers follow the green cards (I-140 approved, approval date, priority date)",
    update.i140_approved === true && update.i140_approval_date === "2026-01-20" && update.priority_date === "2021-06-14",
    JSON.stringify(update)
  );
  check("save: laid off, so the PERM stage answer is left alone", !("perm_stage" in update), JSON.stringify(update));
  const secondPlan = planPetitionSave(toSave, { ...savedRow, deadline_answers: update.deadline_answers });
  check(
    "save: the original copy is only kept the first time",
    secondPlan.ok && (secondPlan.update as Record<string, any>).deadline_answers.immigrantPetitionsLegacy === TWO_EMPLOYER_RAW_PETITIONS
  );
  const badPlan = planPetitionSave(
    [{ ...toSave[0], i140FiledDate: "2026-05-01", i140ApprovalDate: "2026-01-20" }],
    savedRow
  );
  check(
    "save: I-140 approval before filing is rejected with a field error",
    !badPlan.ok && Boolean(badPlan.fieldErrors?.["pet-northwind-eb2"]?.some((e) => e.field === "i140ApprovalDate")),
    JSON.stringify(badPlan)
  );
  check("save: a green card with no name is rejected", !planPetitionSave([{ stage: "i140_approved" }], savedRow).ok);
  check("save: not a list is rejected", !planPetitionSave("nope", savedRow).ok);
  const employedPlan = planPetitionSave(
    [{ id: "a", sponsorName: "Acme Robotics", petitionType: "employer_sponsored", preferenceCategory: "EB-3", stage: "perm_in_progress", permFilingDate: "2026-04-01", priorityDate: "2026-04-01" }],
    { ...savedRow, employment_status: "employed", employer_name: "Acme Robotics", deadline_answers: {} }
  );
  check(
    "save: current employer's green card sets the PERM stage answer",
    employedPlan.ok && (employedPlan.update as Record<string, any>).perm_stage === "in_progress" &&
      (employedPlan.update as Record<string, any>).deadline_answers.immigrantPetitionsLegacy === undefined,
    JSON.stringify(employedPlan)
  );

  // A priority date copied from the old green card list doesn't come back after that card is removed.
  const copiedRow = { ...savedRow, priority_date: "2021-06-14" };
  const removedPlan = planPetitionSave(toSave.filter((p) => p.id === "pet-harbor-eb2"), copiedRow);
  check(
    "save: removing the approved green card drops its copied priority date",
    removedPlan.ok && (removedPlan.update as Record<string, any>).priority_date === null,
    JSON.stringify(removedPlan.ok ? (removedPlan.update as Record<string, any>).priority_date : removedPlan)
  );
  // A priority date the person typed themselves is kept.
  const typedRow = { ...savedRow, priority_date: "2019-03-01", deadline_answers: { statusEndDate: "2026-12-15" } };
  const typedPlan = planPetitionSave(toSave.filter((p) => p.id === "pet-harbor-eb2"), typedRow);
  check(
    "save: a typed priority date with no approved green card is kept",
    typedPlan.ok && (typedPlan.update as Record<string, any>).priority_date === "2019-03-01",
    JSON.stringify(typedPlan.ok ? (typedPlan.update as Record<string, any>).priority_date : typedPlan)
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

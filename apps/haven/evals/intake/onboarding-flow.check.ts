/**
 * Evals for Universal Onboarding validation and dynamic branching.
 * Run: npx tsx --tsconfig tsconfig.json evals/intake/onboarding-flow.check.ts
 */
export {};

async function main() {
  const { isWorkAuthorizedVisa, GREEN_CARD_PATHWAYS, getStagesForPathway } = await import("@/lib/visas");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // Helper matching OnboardingFlow.tsx validation logic:
  function getMissingStep2Fields(data: {
    visaType?: string;
    customVisaDetail?: string;
    isEmployedInUs?: string;
    employerName?: string;
    jobTitle?: string;
    h1bStartDate?: string;
    employerSize?: string;
  }) {
    const effectiveVisa = data.visaType === "other" ? data.customVisaDetail : data.visaType;
    const isWorkAuth = isWorkAuthorizedVisa(effectiveVisa);
    const isEmployed = data.isEmployedInUs === "yes" || (isWorkAuth && data.isEmployedInUs !== "no");

    const missing: string[] = [];
    if (isEmployed) {
      if (!data.employerName?.trim()) missing.push("employerName");
      if (!data.jobTitle?.trim()) missing.push("jobTitle");
      if (!data.employerSize?.trim()) missing.push("employerSize");
      if ((data.visaType === "H1B" || data.visaType === "H-1B") && !data.h1bStartDate?.trim()) {
        missing.push("h1bStartDate");
      }
    }
    return missing;
  }

  function getMissingStep3Fields(data: {
    greenCardPursued?: string;
    greenCardPathway?: string;
    greenCardStage?: string;
    preferenceCategory?: string;
  }) {
    const missing: string[] = [];
    if (data.greenCardPursued !== "no") {
      if (!data.greenCardStage?.trim()) missing.push("greenCardStage");
      if (data.greenCardStage && data.greenCardStage !== "not_started" && !data.preferenceCategory?.trim()) {
        missing.push("preferenceCategory");
      }
    }
    return missing;
  }

  // 1. Step 2 Non-Work Visas (B-2, F-1)
  const b2Unemployed = { visaType: "B-2", isEmployedInUs: "no" };
  const b2Missing = getMissingStep2Fields(b2Unemployed);
  check("Step 2 B-2: unemployed visitor has zero missing fields", b2Missing.length === 0, JSON.stringify(b2Missing));

  const f1Student = { visaType: "F-1", isEmployedInUs: "no" };
  const f1Missing = getMissingStep2Fields(f1Student);
  check("Step 2 F-1: student without US job has zero missing fields", f1Missing.length === 0, JSON.stringify(f1Missing));

  // 2. Step 2 Work Visas (H-1B vs O-1A)
  const h1bEmpty = { visaType: "H1B" };
  const h1bMissing = getMissingStep2Fields(h1bEmpty);
  check(
    "Step 2 H-1B: requires employerName, jobTitle, employerSize, and h1bStartDate",
    h1bMissing.includes("employerName") &&
    h1bMissing.includes("jobTitle") &&
    h1bMissing.includes("employerSize") &&
    h1bMissing.includes("h1bStartDate"),
    JSON.stringify(h1bMissing)
  );

  const o1Empty = { visaType: "O-1A" };
  const o1Missing = getMissingStep2Fields(o1Empty);
  check(
    "Step 2 O-1A: requires employer but does NOT require h1bStartDate",
    o1Missing.includes("employerName") && !o1Missing.includes("h1bStartDate"),
    JSON.stringify(o1Missing)
  );

  // 3. Step 3 Marriage Green Card Flow
  const marriageGc = {
    greenCardPursued: "yes",
    greenCardPathway: "family_marriage_usc",
    greenCardStage: "i130_filed",
    preferenceCategory: "Immediate Relative (Spouse)"
  };
  const marriageMissing = getMissingStep3Fields(marriageGc);
  check("Step 3 Marriage GC: valid marriage fields have zero missing fields", marriageMissing.length === 0, JSON.stringify(marriageMissing));

  const marriageStages = getStagesForPathway("family_marriage_usc");
  check("Step 3 Marriage GC: stages include I-130 filed and 2-year conditional card",
    marriageStages.some(s => s.id === "i130_filed") && marriageStages.some(s => s.id === "conditional_resident")
  );
  check("Step 3 Marriage GC: stages do NOT include PERM",
    !marriageStages.some(s => s.id === "perm_certified")
  );

  // 4. Step 3 Exploring / Not Pursuing GC
  const notPursuing = { greenCardPursued: "no" };
  const notPursuingMissing = getMissingStep3Fields(notPursuing);
  check("Step 3 Skipped: user not pursuing green card has zero missing fields", notPursuingMissing.length === 0, JSON.stringify(notPursuingMissing));

  // 5. Self-Petition (EB-2 NIW)
  const niwStages = getStagesForPathway("self_petition_niw");
  check("Step 3 NIW: stages do NOT require PERM labor certification",
    !niwStages.some(s => s.id === "perm_certified")
  );

  console.log(`\n${pass}/${pass + failures.length} onboarding flow checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

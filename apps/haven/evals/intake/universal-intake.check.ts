/**
 * Evals for Universal Visa and Green Card Intake utilities.
 * Run: npx tsx --tsconfig tsconfig.json evals/intake/universal-intake.check.ts
 */
export {};

async function main() {
  const {
    isWorkAuthorizedVisa,
    ALL_VISA_OPTIONS,
    GREEN_CARD_PATHWAYS,
    getStagesForPathway,
    SPONSOR_ATTRIBUTION_OPTIONS
  } = await import("@/lib/visas");
  const { normalizePetitions } = await import("@/lib/petitions");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // 1. Visa Work Authorization Checks
  check("isWorkAuthorizedVisa: H-1B is work authorized", isWorkAuthorizedVisa("H1B"));
  check("isWorkAuthorizedVisa: O-1A is work authorized", isWorkAuthorizedVisa("O-1A"));
  check("isWorkAuthorizedVisa: TN is work authorized", isWorkAuthorizedVisa("TN"));
  check("isWorkAuthorizedVisa: STEM OPT is work authorized", isWorkAuthorizedVisa("STEM OPT"));
  check("isWorkAuthorizedVisa: B-2 visitor is NOT work authorized", !isWorkAuthorizedVisa("B-2"));
  check("isWorkAuthorizedVisa: B-1 business visitor is NOT work authorized", !isWorkAuthorizedVisa("B-1"));
  check("isWorkAuthorizedVisa: F-1 student (pre-OPT) is NOT work authorized", !isWorkAuthorizedVisa("F-1"));
  check("isWorkAuthorizedVisa: K-1 fiancé is NOT work authorized", !isWorkAuthorizedVisa("K-1"));
  check("isWorkAuthorizedVisa: Custom EAD write-in heuristic identifies work authorized", isWorkAuthorizedVisa("Pending Asylum with EAD card"));
  check("isWorkAuthorizedVisa: Custom tourist write-in is NOT work authorized", !isWorkAuthorizedVisa("G-4 Dependent without permit"));

  // 2. Taxonomies and Options
  check("ALL_VISA_OPTIONS: includes B-1, B-2, O-1, TPS, Citizen",
    ["B-1", "B-2", "O-1", "TPS", "Citizen", "other"].every(v => ALL_VISA_OPTIONS.some(opt => opt.value === v))
  );

  check("GREEN_CARD_PATHWAYS: includes marriage, self-petition, investment, lottery",
    ["family_marriage_usc", "self_petition_niw", "investment_eb5", "diversity_lottery"].every(
      pathway => GREEN_CARD_PATHWAYS.some(p => p.id === pathway)
    )
  );

  // 3. Dynamic Stages
  const familyStages = getStagesForPathway("family_marriage_usc");
  check("familyStages: includes I-130 and conditional resident stages",
    familyStages.some(s => s.id === "i130_filed") && familyStages.some(s => s.id === "conditional_resident")
  );

  const employerStages = getStagesForPathway("employer_sponsored");
  check("employerStages: includes PERM and I-140 stages",
    employerStages.some(s => s.id === "perm_certified") && employerStages.some(s => s.id === "i140_approved")
  );

  const niwStages = getStagesForPathway("self_petition_niw");
  check("niwStages: excludes PERM and has I-140 filed",
    !niwStages.some(s => s.id === "perm_certified") && niwStages.some(s => s.id === "i140_filed")
  );

  // 4. Petition Normalization with Family/Marriage and Custom Attributions
  const marriagePetition = normalizePetitions([
    {
      sponsorName: "Jane Doe (Spouse)",
      petitionType: "family_marriage_usc",
      stage: "i130_filed",
      priorityDate: "2025-06-01",
      category: "Immediate Relative (Spouse)"
    }
  ]);
  check("normalize: preserves marriage petition and non-EB category",
    marriagePetition.length === 1 &&
    marriagePetition[0].petitionType === "family_marriage_usc" &&
    marriagePetition[0].stage === "i130_filed" &&
    marriagePetition[0].preferenceCategory === "Immediate Relative (Spouse)"
  );

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * End-to-end evals for diverse immigration personas:
 * - B-2 visitor (unemployed, no green card)
 * - F-1 student (pre-OPT, exploring options)
 * - Marriage to US Citizen (Family I-130 / I-485 with spouse sponsor)
 * - Self-petitioned EB-2 NIW (O-1A visa, retained priority date from prior employer)
 * - Custom unlisted visa write-in ("G-4 International Organization")
 *
 * Run: npx tsx --tsconfig tsconfig.json evals/intake/personas-e2e.check.ts
 */
export {};

async function main() {
  const { mapProfileRow } = await import("@/lib/profile-mapper");
  const { resolveDashboardFacts } = await import("@/lib/dashboard-facts");
  const { normalizePetitions } = await import("@/lib/petitions");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const now = new Date("2026-10-29T12:00:00Z");

  // Persona 1: B-2 Visitor (Non-work, no employer, no green card)
  const b2Row: Record<string, unknown> = {
    id: "user-b2-visitor",
    full_name: "Maria Santos",
    email: "maria@example.com",
    visa_type: "B-2",
    country_of_birth: "Brazil",
    primary_goal: "stay_flexible",
    employer_name: null,
    job_title: null,
    h1b_start_date: null,
    employer_size: null,
    perm_stage: "not_started",
    i140_approved: false,
    i140_filed: false,
    i485_filed: false,
    preference_category: "Not sure",
    deadline_answers: {
      statusEndDate: "2027-04-15"
    }
  };

  const b2Profile = mapProfileRow(b2Row);
  check("Persona B-2: visaType maps correctly as 'B-2'", b2Profile.visaType === "B-2");
  check("Persona B-2: employer fields are null/undefined", !b2Profile.employerName && !b2Profile.h1bStartDate);
  const b2Facts = resolveDashboardFacts({ profile: b2Profile, now });
  check("Persona B-2: dashboard facts compute cleanly without errors", b2Facts.stage === "not_started");

  // Persona 2: F-1 Student (Pre-OPT, exploring options)
  const f1Row: Record<string, unknown> = {
    id: "user-f1-student",
    full_name: "Li Wei",
    email: "liwei@example.com",
    visa_type: "F-1",
    country_of_birth: "China",
    primary_goal: "explore_options",
    perm_stage: "not_started",
    i140_approved: false,
    preference_category: "Not sure",
    deadline_answers: {
      statusEndDate: "2027-06-01"
    }
  };

  const f1Profile = mapProfileRow(f1Row);
  check("Persona F-1: visaType maps correctly as 'F-1'", f1Profile.visaType === "F-1");
  const f1Facts = resolveDashboardFacts({ profile: f1Profile, now });
  check("Persona F-1: dashboard facts resolve without exception", f1Facts.stage === "not_started");

  // Persona 3: Marriage to US Citizen (Form I-130 + I-485)
  const marriageRow: Record<string, unknown> = {
    id: "user-marriage-usc",
    full_name: "Amara Diallo",
    email: "amara@example.com",
    visa_type: "B-2",
    country_of_birth: "Other",
    primary_goal: "get_gc",
    perm_stage: "not_started",
    i140_approved: false,
    i485_filed: true,
    preference_category: "Immediate Relative (Spouse)",
    priority_date: "2026-02-10",
    deadline_answers: {
      greenCardPathway: "family_marriage_usc",
      greenCardSponsor: "Spouse (US Citizen)",
      immigrantPetitions: [
        {
          id: "pet-marriage-spouse",
          sponsorName: "John Doe (Spouse)",
          petitionType: "family_marriage_usc",
          stage: "i485_filed",
          preferenceCategory: "Immediate Relative (Spouse)",
          priorityDate: "2026-02-10"
        }
      ]
    }
  };

  const marriageProfile = mapProfileRow(marriageRow);
  check("Persona Marriage: preferenceCategory maps to 'Immediate Relative (Spouse)'",
    marriageProfile.preferenceCategory === "Immediate Relative (Spouse)"
  );
  check("Persona Marriage: greenCardSponsor attributes to spouse",
    marriageProfile.greenCardSponsor === "Spouse (US Citizen)"
  );
  check("Persona Marriage: immigrantPetitions includes marriage petition",
    Boolean(marriageProfile.immigrantPetitions?.length && marriageProfile.immigrantPetitions[0].petitionType === "family_marriage_usc")
  );
  const marriageFacts = resolveDashboardFacts({ profile: marriageProfile, now });
  check("Persona Marriage: dashboard facts resolve I-485 stage cleanly", marriageFacts.stage === "i485_filed");

  // Persona 4: Self-Petition EB-2 NIW with Prior Approved I-140 (O-1A Visa)
  const niwRow: Record<string, unknown> = {
    id: "user-niw-retained",
    full_name: "Dr. Elena Rostova",
    email: "elena@example.com",
    visa_type: "O-1A",
    country_of_birth: "India",
    employer_name: "Aether AI Inc.",
    job_title: "Staff Research Scientist",
    perm_stage: "certified",
    i140_approved: true,
    preference_category: "EB-2 NIW",
    priority_date: "2021-05-12",
    deadline_answers: {
      greenCardPathway: "self_petition_niw",
      greenCardSponsor: "Self-Petition",
      retainedPriorityDate: "2021-05-12",
      retainedPriorityDateSponsor: "Former Tech Corp",
      immigrantPetitions: [
        {
          id: "pet-former-eb2",
          sponsorName: "Former Tech Corp",
          petitionType: "employer_sponsored",
          stage: "i140_approved",
          preferenceCategory: "EB-2",
          priorityDate: "2021-05-12"
        },
        {
          id: "pet-self-niw",
          sponsorName: "Self-Petition",
          petitionType: "self_petition_niw",
          stage: "i140_filed",
          preferenceCategory: "EB-2 NIW",
          priorityDate: "2026-01-15"
        }
      ]
    }
  };

  const niwProfile = mapProfileRow(niwRow);
  check("Persona NIW: visaType is O-1A", niwProfile.visaType === "O-1A");
  check("Persona NIW: has 2 distinct petitions (former employer + self-petition)",
    niwProfile.immigrantPetitions?.length === 2
  );
  const niwFacts = resolveDashboardFacts({ profile: niwProfile, now });
  check("Persona NIW: effective priority date locked from 2021 former employer",
    niwFacts.priorityDate.iso === "2021-05-12" && niwFacts.priorityDate.sourceSponsorName === "Former Tech Corp"
  );
  check("Persona NIW: I-140 protection is unlocked from approved petition",
    niwFacts.protection.hasApprovedI140
  );

  // Persona 5: Custom Unlisted Visa Write-in ("G-4 International Organization")
  const customRow: Record<string, unknown> = {
    id: "user-custom-g4",
    full_name: "Kofi Annan",
    email: "kofi@example.com",
    visa_type: "G-4 International Organization",
    country_of_birth: "Other",
    primary_goal: "job_stability",
    perm_stage: "not_started",
    i140_approved: false,
    preference_category: "Not sure"
  };

  const customProfile = mapProfileRow(customRow);
  check("Persona Custom: preserves exact custom status string 'G-4 International Organization'",
    customProfile.visaType === "G-4 International Organization"
  );
  const customFacts = resolveDashboardFacts({ profile: customProfile, now });
  check("Persona Custom: dashboard facts resolve without exception", customFacts.stage === "not_started");

  console.log(`\n${pass}/${pass + failures.length} persona e2e checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

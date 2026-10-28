/**
 * Conflict rules, and every dashboard surface agreeing on the same facts.
 * Run: npx tsx --tsconfig tsconfig.json evals/dashboard/consistency.check.ts
 */
export {};

async function main() {
  const { findDashboardConflicts } = await import("@/lib/dashboard-consistency");
  const { resolveDashboardFacts } = await import("@/lib/dashboard-facts");
  const { buildImmigrationJourney } = await import("@/lib/immigration-journey");
  const { computeDerivedSignals, mergeSnapshotProfile } = await import("@/lib/haven");
  const { buildAdvisorContext } = await import("@/lib/advisor/service");
  const { havenSnapshot } = await import("@/lib/repositories/mock-data");
  const { normalizePetitions } = await import("@/lib/petitions");
  const { TWO_EMPLOYER_NOW, TWO_EMPLOYER_RAW_PETITIONS, twoEmployerProfile } = await import("./fixtures");
  type Profile = ReturnType<typeof twoEmployerProfile>;

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };
  const ids = (profile: Profile, extra: { deadlines?: Record<string, unknown>; layoffDate?: string | null } = {}) =>
    findDashboardConflicts({ profile, ...extra }).map((c) => c.id);

  const raw = normalizePetitions(TWO_EMPLOYER_RAW_PETITIONS);
  const ended = raw.map((p) =>
    p.id === "pet-harbor-eb2" ? { ...p, endedReason: "layoff" as const, endedDate: "2026-10-08" } : p
  );

  // 4.1 One check per rule
  const asSaved = twoEmployerProfile({ immigrantPetitions: raw });
  const asSavedConflicts = findDashboardConflicts({ profile: asSaved, layoffDate: "2026-10-08" });
  const activeAfterLayoff = asSavedConflicts.find((c) => c.id === "petition-active-after-layoff");
  check(
    "rule: green card still in progress for the employer you were laid off from, with a one-click fix",
    Boolean(
      activeAfterLayoff &&
        activeAfterLayoff.quickFix?.petitionId === "pet-harbor-eb2" &&
        activeAfterLayoff.quickFix.date === "2026-10-08" &&
        activeAfterLayoff.message.includes("Harbor Ventures (Lakeside Insurance)")
    ),
    JSON.stringify(asSavedConflicts)
  );
  check(
    "rule: own priority date before PERM was filed",
    ids(asSaved, { layoffDate: "2026-10-08" }).includes("priority-date-before-perm")
  );
  check(
    "rule: ending the green card clears both",
    ids(twoEmployerProfile({ immigrantPetitions: ended }), { layoffDate: "2026-10-08" }).length === 0,
    JSON.stringify(ids(twoEmployerProfile({ immigrantPetitions: ended }), { layoffDate: "2026-10-08" }))
  );
  check(
    "rule: I-140 'approved' answer vs records",
    ids(twoEmployerProfile({ i140Approved: false, immigrantPetitions: ended })).includes("i140-flag-vs-petitions") &&
      ids(
        twoEmployerProfile({
          i140Approved: true,
          immigrantPetitions: [{ ...ended[1], endedReason: undefined, endedDate: undefined, isPriorityDateRecaptured: true }],
          employmentStatus: "employed"
        })
      ).includes("i140-flag-vs-petitions")
  );
  const employedPerm = twoEmployerProfile({
    employmentStatus: "employed",
    permStage: "not_started",
    immigrantPetitions: [ended[0], { ...ended[1], endedReason: undefined, endedDate: undefined, isPriorityDateRecaptured: true }]
  });
  const permConflicts = findDashboardConflicts({ profile: employedPerm });
  check(
    "rule: PERM stage answer vs current employer's green card",
    permConflicts.some((c) => c.id === "perm-stage-vs-current-petition" && c.message.includes("not started") && c.message.includes("in progress")),
    JSON.stringify(permConflicts)
  );
  check(
    "rule: I-140 approved before PERM was filed",
    ids(
      twoEmployerProfile({
        immigrantPetitions: [{ ...ended[0], permFilingDate: "2026-05-01" }, ended[1]]
      })
    ).includes("i140-approval-before-perm") &&
      ids(
        twoEmployerProfile({ immigrantPetitions: undefined, i140ApprovalDate: "2023-01-01", permFilingDate: "2023-06-01" })
      ).includes("i140-approval-before-perm")
  );
  check(
    "rule: status end date before last day of work",
    ids(twoEmployerProfile({ immigrantPetitions: ended }), {
      deadlines: { statusEndDate: "2026-09-30", jobEnded: "yes", lastWorkDay: "2026-10-08" }
    }).includes("status-end-before-layoff")
  );
  check(
    "all clear: a consistent single-employer profile has no conflicts",
    ids(
      twoEmployerProfile({
        employerName: "Acme Robotics",
        employmentStatus: "employed",
        permStage: "in_progress",
        i140Approved: false,
        i140ApprovalDate: undefined,
        retainedPriorityDate: undefined,
        immigrantPetitions: [
          { id: "a", sponsorName: "Acme Robotics", petitionType: "employer_sponsored", preferenceCategory: "EB-2", stage: "perm_in_progress", permFilingDate: "2026-03-01", priorityDate: "2026-03-01" }
        ]
      })
    ).length === 0
  );
  check(
    "conflicts are ordered: the layoff question shows first",
    asSavedConflicts[0]?.id === "petition-active-after-layoff",
    JSON.stringify(asSavedConflicts.map((c) => c.id))
  );

  // 4.2 Every surface shows the same stage, priority date, sponsor and protection
  type SurfaceFacts = { surface: string; stage?: string; priorityDate?: string | null; sponsor?: string | null; protected?: boolean };
  const disagreements = (rows: SurfaceFacts[]) => {
    const out: string[] = [];
    for (const key of ["stage", "priorityDate", "sponsor", "protected"] as const) {
      const seen = rows.filter((r) => r[key] !== undefined);
      const values = new Set(seen.map((r) => String(r[key])));
      if (values.size > 1) out.push(`${key}: ${seen.map((r) => `${r.surface}=${r[key]}`).join(", ")}`);
    }
    return out;
  };

  const now = TWO_EMPLOYER_NOW;
  const profile = twoEmployerProfile({ immigrantPetitions: ended });
  const facts = resolveDashboardFacts({ profile, now, layoffDate: "2026-10-08" });
  const signals = computeDerivedSignals(profile, null, { now, layoffDate: "2026-10-08" });
  const journey = buildImmigrationJourney({
    profile,
    signals,
    activeLayoffEvent: { layoffDate: "2026-10-08", employerAtLayoff: profile.employerName ?? null, visaTypeAtLayoff: "H1B" },
    now
  });
  const snapshot = mergeSnapshotProfile(havenSnapshot, profile);
  const advisor = buildAdvisorContext({ ...snapshot, activeLayoffEvent: null } as never);
  const advisorPd = advisor.profileSummary.find((l) => l.startsWith("Priority date:")) ?? "";
  const advisorI140 = advisor.profileSummary.find((l) => l.startsWith("I-140 approved:")) ?? "";
  const sponsor = "Ridgeline Labs, Northwind Mutual Insurance";

  const rows: SurfaceFacts[] = [
    {
      surface: "resolver",
      stage: facts.stage,
      priorityDate: facts.priorityDate.iso,
      sponsor: facts.protection.protectingSponsor,
      protected: facts.protection.isRevocationProtected
    },
    {
      surface: "green card track",
      stage: journey.greenCardTrack.stage,
      priorityDate: journey.greenCardTrack.priorityDate,
      sponsor: journey.protection.protectingSponsor ?? null,
      protected: Boolean(journey.protection.isRevocationProtected)
    },
    {
      surface: "stored signals",
      protected: Boolean(signals.ac21PortabilityStatus?.startsWith("Unlocked"))
    },
    {
      surface: "planner",
      sponsor: snapshot.planner.situationSummary.includes(sponsor) ? sponsor : "missing"
    },
    {
      surface: "advisor",
      priorityDate: advisorPd.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
      sponsor: advisorI140.includes(sponsor) ? sponsor : "missing"
    }
  ];
  const problems = disagreements(rows);
  check("all surfaces agree for the two-employer case", problems.length === 0, problems.join(" | "));
  check(
    "the agreement check catches a surface with a different value",
    disagreements([...rows, { surface: "stub", stage: "perm_in_progress", priorityDate: "2020-01-01" }]).length === 2
  );
  check(
    "advisor lists both green cards, with the ended one marked",
    advisor.profileSummary.some((l) => l.startsWith("Green cards on file:") && l.includes("Harbor Ventures") && l.includes("layoff")),
    advisor.profileSummary.join(" / ")
  );

  // 5.1 One milestone row per green card
  const tracks = journey.greenCardTrack.tracks;
  const first = tracks[0];
  const second = tracks[1];
  check(
    "tracks: two rows, approved one first and protected, ended one marked with reason and month",
    tracks.length === 2 &&
      first.id === "pet-northwind-eb2" &&
      first.isPrimary &&
      first.tone === "protected" &&
      first.stages.find((st) => st.key === "i140")?.status === "completed" &&
      first.stages.find((st) => st.key === "bulletin_queue")?.status === "current" &&
      second.id === "pet-harbor-eb2" &&
      second.tone === "ended" &&
      second.statusLine === "Ended at layoff, Oct 2026" &&
      second.stages.every((st) => st.status === "stopped"),
    JSON.stringify(tracks)
  );
  check(
    "tracks: priority date source is named once for the section",
    journey.greenCardTrack.priorityDateSourceName === sponsor,
    String(journey.greenCardTrack.priorityDateSourceName)
  );
  check(
    "tracks: laid off, so no current employer is named as still running PERM",
    journey.greenCardTrack.activePetitionSponsor === sponsor,
    String(journey.greenCardTrack.activePetitionSponsor)
  );
  const single = buildImmigrationJourney({
    profile: twoEmployerProfile({ immigrantPetitions: [ended[0]] }),
    signals,
    now
  });
  check("tracks: one green card gives one row", single.greenCardTrack.tracks.length === 1);
  const none = buildImmigrationJourney({ profile: twoEmployerProfile({ immigrantPetitions: undefined }), signals, now });
  check("tracks: no green card records gives no rows (single classic track is shown)", none.greenCardTrack.tracks.length === 0);

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

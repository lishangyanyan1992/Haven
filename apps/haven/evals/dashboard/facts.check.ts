/**
 * One resolved value per dashboard fact; fresh values beat stored ones.
 * Run: npx tsx --tsconfig tsconfig.json evals/dashboard/facts.check.ts
 */
export {};

async function main() {
  const { resolveDashboardFacts } = await import("@/lib/dashboard-facts");
  const { computeDerivedSignals } = await import("@/lib/haven");
  const { mapDerivedSignals } = await import("@/lib/repositories/supabase-case-compass");
  const { normalizePetitions } = await import("@/lib/petitions");
  const { TWO_EMPLOYER_NOW, TWO_EMPLOYER_RAW_PETITIONS, twoEmployerProfile } = await import("./fixtures");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const now = TWO_EMPLOYER_NOW;
  const petitions = normalizePetitions(TWO_EMPLOYER_RAW_PETITIONS).map((p) =>
    p.id === "pet-harbor-eb2" ? { ...p, endedReason: "layoff" as const, endedDate: "2026-10-08" } : p
  );
  const twoEmployer = twoEmployerProfile({ immigrantPetitions: petitions });

  // 3.1 Resolver on the two-employer case
  const facts = resolveDashboardFacts({ profile: twoEmployer, now, layoffDate: "2026-10-08" });
  check("two employers: stage is I-140 approved", facts.stage === "i140_approved", facts.stage);
  check("two employers: current green card is the approved one", facts.activePetitionId === "pet-northwind-eb2", String(facts.activePetitionId));
  check(
    "two employers: priority date 2021-06-14 from the first employer",
    facts.priorityDate.iso === "2021-06-14" && facts.priorityDate.sourceSponsorName === "Ridgeline Labs, Northwind Mutual Insurance",
    JSON.stringify(facts.priorityDate)
  );
  check(
    "two employers: protection unlocked, credited to the first employer",
    facts.protection.hasApprovedI140 &&
      facts.protection.isRevocationProtected &&
      facts.protection.protectingSponsor === "Ridgeline Labs, Northwind Mutual Insurance" &&
      Boolean(facts.protection.statusLabel?.startsWith("Unlocked")),
    JSON.stringify(facts.protection)
  );
  check(
    "two employers: laid off with an approved I-140 is medium readiness",
    facts.readiness.score === "medium" && facts.readiness.reasoning[0] === "You are already in an active layoff scenario.",
    JSON.stringify(facts.readiness)
  );
  check("two employers: no conflicts once the second green card is ended", facts.conflicts.length === 0, JSON.stringify(facts.conflicts));

  // Single-employer cases
  const employed = twoEmployerProfile({
    employerName: "Acme Robotics",
    employmentStatus: "employed",
    retainedPriorityDate: undefined,
    retainedPriorityDateSponsor: undefined,
    immigrantPetitions: [
      { id: "a", sponsorName: "Acme Robotics", petitionType: "employer_sponsored", preferenceCategory: "EB-3", stage: "perm_in_progress", permFilingDate: "2026-04-01", priorityDate: "2026-04-01" }
    ],
    i140Approved: false,
    i140ApprovalDate: undefined,
    priorityDate: "2026-04-01",
    permStage: "in_progress",
    preferenceCategory: "EB-3"
  });
  const employedFacts = resolveDashboardFacts({ profile: employed, now });
  check(
    "single employer, PERM filed: stage PERM, no protection, low readiness, no conflicts",
    employedFacts.stage === "perm_in_progress" &&
      !employedFacts.protection.hasApprovedI140 &&
      employedFacts.protection.statusLabel === undefined &&
      employedFacts.readiness.score === "low" &&
      employedFacts.conflicts.length === 0,
    JSON.stringify({ s: employedFacts.stage, p: employedFacts.protection, r: employedFacts.readiness, c: employedFacts.conflicts })
  );
  const freshApproval = twoEmployerProfile({
    employerName: "Acme Robotics",
    employmentStatus: "employed",
    retainedPriorityDate: undefined,
    retainedPriorityDateSponsor: undefined,
    immigrantPetitions: undefined,
    i140Approved: true,
    i140ApprovalDate: "2026-09-01",
    permStage: "certified"
  });
  const freshFacts = resolveDashboardFacts({ profile: freshApproval, now });
  check(
    "single employer, approved under 180 days ago: protection 'Available after' the lock-in date",
    freshFacts.protection.hasApprovedI140 && freshFacts.protection.statusLabel === "Available after Feb 28, 2027",
    String(freshFacts.protection.statusLabel)
  );

  // 3.2 Every calculator agrees with the resolver
  const signals = computeDerivedSignals(twoEmployer, null, { now, layoffDate: "2026-10-08" });
  check(
    "old calculator matches the resolver for protection and readiness",
    signals.ac21PortabilityStatus === facts.protection.statusLabel &&
      signals.layoffReadinessScore === facts.readiness.score &&
      JSON.stringify(signals.layoffReadinessReasoning) === JSON.stringify(facts.readiness.reasoning),
    JSON.stringify(signals)
  );

  // 3.3 Stored results can't override fresh ones
  const staleRow = {
    h1b_cap_date: "2020-01-01",
    days_until_visa_expiry: 999,
    visa_bulletin_position: "old",
    estimated_gc_date_range: "2028 - 2030",
    ac21_portability_status: "Available after Sep 21, 2026",
    layoff_readiness_score: "high" as const,
    layoff_readiness_reasoning: ["old reason"]
  };
  const mapped = mapDerivedSignals(staleRow, twoEmployer, null, now);
  check(
    "stale stored protection and readiness are replaced by fresh values",
    mapped.ac21PortabilityStatus === facts.protection.statusLabel &&
      mapped.layoffReadinessScore === "medium" &&
      !mapped.layoffReadinessReasoning.includes("old reason") &&
      mapped.h1bCapDate !== "2020-01-01",
    JSON.stringify(mapped)
  );
  check(
    "a stored wait estimate fills in only when there is no fresh bulletin estimate",
    mapped.estimatedGreenCardDateRange === "2028 - 2030" &&
      mapDerivedSignals(staleRow, twoEmployer, { estimatedGreenCardDateRange: "2027 - 2028" }, now).estimatedGreenCardDateRange === "2027 - 2028",
    String(mapped.estimatedGreenCardDateRange)
  );

  // 3.4 Retained date alone still counts as a priority date
  const retainedOnly = twoEmployerProfile({ priorityDate: undefined, immigrantPetitions: undefined });
  const retainedFacts = resolveDashboardFacts({ profile: retainedOnly, now });
  check(
    "retained priority date with an empty priority date field still gives a date and a wait estimate",
    retainedFacts.priorityDate.iso === "2021-06-14" && retainedFacts.waitEstimate === "Estimate pending bulletin sync",
    JSON.stringify({ pd: retainedFacts.priorityDate, w: retainedFacts.waitEstimate })
  );

  // 3.5 Saves write what the dashboard would compute
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(new URL("../../", import.meta.url).pathname);
  const sync = fs.readFileSync(path.join(root, "src/lib/profile-sync.ts"), "utf8");
  const deadlinesSrc = fs.readFileSync(path.join(root, "src/lib/deadlines.ts"), "utf8");
  check(
    "saves recompute stored signals from the full profile",
    /persistDerivedSignals\(\s*userId,\s*profile,/.test(sync) &&
      sync.includes("export async function refreshDerivedSignals") &&
      deadlinesSrc.includes("await refreshDerivedSignals(userId)"),
    "expected profile, deadline and green card saves to refresh stored signals"
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

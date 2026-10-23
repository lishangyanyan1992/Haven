/**
 * Client Case dashboard checks:
 * 1. Left navigation order: Case (/dashboard) -> Documents (/documents) -> Ask (/advisor) -> Settings (/settings)
 * 2. Default signed-in home is /dashboard and /dashboard is not archived
 * 3. Law Firm Engagement pipeline (Intake -> Documents -> Initial Consultation -> Contract Signed -> Case Prep -> Petition Filed)
 * 4. Overlaid Immigration Journey (Visa Status + Job/Sponsorship + Green Card Timeline synchronized on a shared axis)
 *
 * Run: npm run check:case-dashboard --workspace @haven/app
 */

export {};

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { isArchivedPath, SIGNED_IN_HOME } = await import("@/lib/archived-routes");
  const {
    buildFirmEngagementOverview,
    cleanEngagementState,
    FIRM_ENGAGEMENT_STAGES,
    validateEngagementUpdate
  } = await import("@/lib/firms/engagement");
  const { buildImmigrationJourney } = await import("@/lib/immigration-journey");
  const { computeDerivedSignals } = await import("@/lib/haven");
  const { havenSnapshot } = await import("@/lib/repositories/mock-data");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const root = path.resolve(new URL("../../", import.meta.url).pathname);
  const navSource = fs.readFileSync(path.join(root, "src/components/app/app-shell-nav.tsx"), "utf8");

  // 1. Navigation order check
  const hrefMatches = [...navSource.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
  check(
    "nav: order is Case (/dashboard) -> Documents (/documents) -> Ask (/advisor) -> Settings (/settings)",
    JSON.stringify(hrefMatches) === JSON.stringify(["/dashboard", "/documents", "/advisor", "/settings"]),
    `got ${JSON.stringify(hrefMatches)}`
  );
  check(
    "nav: top tab is labeled Case",
    /href:\s*"\/dashboard",\s*label:\s*"Case"/.test(navSource),
    "expected /dashboard label to be Case"
  );

  // 2. Signed-in home & un-archived /dashboard
  check("routes: SIGNED_IN_HOME is /dashboard", SIGNED_IN_HOME === "/dashboard", `got ${SIGNED_IN_HOME}`);
  check("routes: /dashboard is not archived", !isArchivedPath("/dashboard"), "expected /dashboard to be active");

  // 3. Law Firm Engagement stages & transitions
  check(
    "engagement: defines 6 stages in order",
    JSON.stringify(FIRM_ENGAGEMENT_STAGES.map((s) => s.key)) ===
      JSON.stringify([
        "intake_completed",
        "documents_uploaded",
        "initial_consultation",
        "contract_signed",
        "case_prep",
        "petition_filed"
      ]),
    `got ${JSON.stringify(FIRM_ENGAGEMENT_STAGES.map((s) => s.key))}`
  );

  const afterIntakeAndDocs = buildFirmEngagementOverview({
    firmName: "Beacon Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-10-18T00:00:00Z",
    completedAt: "2026-10-19T00:00:00Z",
    reviewedAt: "2026-10-20T00:00:00Z",
    uploadedDocumentCount: 4,
    requiredDocumentCount: 4,
    fulfilledRequiredCount: 4,
    engagementState: null
  });
  check(
    "engagement: intake + docs completed makes Initial Consultation Call the current step",
    afterIntakeAndDocs.currentStep.key === "initial_consultation" &&
      afterIntakeAndDocs.nextStep?.key === "contract_signed" &&
      afterIntakeAndDocs.completedCount === 2,
    `got current=${afterIntakeAndDocs.currentStep.key}, next=${afterIntakeAndDocs.nextStep?.key}, completed=${afterIntakeAndDocs.completedCount}`
  );

  const afterConsultation = buildFirmEngagementOverview({
    firmName: "Beacon Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-10-18T00:00:00Z",
    completedAt: "2026-10-19T00:00:00Z",
    reviewedAt: "2026-10-20T00:00:00Z",
    uploadedDocumentCount: 4,
    requiredDocumentCount: 4,
    fulfilledRequiredCount: 4,
    engagementState: {
      stage: "initial_consultation",
      stageStatus: "completed",
      scheduledDate: "2026-10-22",
      note: "Great speaking today. Sending retainer agreement shortly."
    }
  });
  check(
    "engagement: completing Initial Consultation advances current step to Contract Signed",
    afterConsultation.currentStep.key === "contract_signed" &&
      afterConsultation.nextStep?.key === "case_prep" &&
      afterConsultation.completedCount === 3 &&
      afterConsultation.attorneyNote === "Great speaking today. Sending retainer agreement shortly.",
    `got current=${afterConsultation.currentStep.key}, completed=${afterConsultation.completedCount}`
  );

  const validEngagement = validateEngagementUpdate({
    stage: "contract_signed",
    stageStatus: "completed",
    scheduledDate: "2026-10-23",
    note: "Retainer signed"
  });
  check("engagement: validates legal stage update", validEngagement.ok, JSON.stringify(validEngagement));

  const invalidEngagement = validateEngagementUpdate({
    stage: "unknown_stage"
  });
  check("engagement: rejects invalid stage key", !invalidEngagement.ok, "expected failure on unknown stage");

  const inheritedKeyEngagement = validateEngagementUpdate({
    stage: "constructor"
  });
  check(
    "engagement: rejects inherited prototype keys like constructor",
    !inheritedKeyEngagement.ok && !("stage" in cleanEngagementState({ stage: "constructor" })),
    "expected constructor stage to be rejected"
  );

  // 4. Overlaid Immigration Journey checks
  const refNow = new Date("2026-10-23T00:00:00Z");
  const baseProfile = {
    ...havenSnapshot.profile,
    visaType: "H1B" as const,
    countryOfBirth: "India",
    h1bStartDate: "2022-10-01",
    currentVisaExpiryDate: "2027-09-30",
    employerName: "Stripe",
    jobTitle: "Staff Engineer",
    i140Approved: true,
    i140ApprovalDate: "2025-05-01",
    priorityDate: "2023-11-15",
    preferenceCategory: "EB-2" as const,
    i485Filed: false
  };
  const signals = computeDerivedSignals(baseProfile);
  const journey = buildImmigrationJourney({
    profile: baseProfile,
    deadlines: { statusEndDate: "2027-09-30" },
    signals,
    now: refNow
  });

  check(
    "journey: computes shared axis with todayPercent between 5 and 95",
    journey.axis.todayPercent > 5 && journey.axis.todayPercent < 95 && journey.axis.ticks.length === 5,
    `got todayPercent=${journey.axis.todayPercent}`
  );
  check(
    "journey: visa track is started_active with start, renewal, expiry, and 6-year cap pins",
    journey.visaTrack.lifecycleState === "started_active" &&
      journey.visaTrack.pins.some((p) => p.id === "visa-start") &&
      journey.visaTrack.pins.some((p) => p.id === "visa-expiry") &&
      journey.visaTrack.pins.some((p) => p.id === "visa-cap"),
    `got state=${journey.visaTrack.lifecycleState}, pins=${journey.visaTrack.pins.map((p) => p.id).join(",")}`
  );
  check(
    "journey: job track reflects active sponsor and AC21 portability pin",
    journey.jobTrack.lifecycleState === "employed" &&
      journey.jobTrack.employerName === "Stripe" &&
      journey.jobTrack.pins.some((p) => p.id === "job-ac21"),
    `got job=${journey.jobTrack.lifecycleState}, pins=${journey.jobTrack.pins.map((p) => p.id).join(",")}`
  );
  check(
    "journey: green card track reflects i140_approved and 5 stage nodes",
    journey.greenCardTrack.stage === "i140_approved" &&
      journey.greenCardTrack.nodes.length === 5 &&
      journey.greenCardTrack.nodes.find((n) => n.key === "i140")?.status === "completed",
    `got gcStage=${journey.greenCardTrack.stage}`
  );

  const i140FiledJourney = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      i140Approved: false,
      i140Filed: true
    },
    deadlines: {},
    signals,
    now: refNow
  });
  check(
    "journey: green card track reflects i140_filed when i140Filed is true",
    i140FiledJourney.greenCardTrack.stage === "i140_filed" &&
      i140FiledJourney.greenCardTrack.nodes.find((n) => n.key === "i140")?.status === "current",
    `got gcStage=${i140FiledJourney.greenCardTrack.stage}`
  );

  // Expired visa + grace period scenario
  const expiredAndLaidOff = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      currentVisaExpiryDate: "2026-10-01",
      employmentStatus: "laid_off"
    },
    deadlines: {
      statusEndDate: "2026-10-01",
      jobEnded: "yes",
      lastWorkDay: "2026-09-23"
    },
    signals,
    now: refNow
  });
  check(
    "journey: detects expired visa and 60-day grace period on job track",
    expiredAndLaidOff.visaTrack.lifecycleState === "expired" &&
      expiredAndLaidOff.jobTrack.lifecycleState === "grace_period" &&
      expiredAndLaidOff.jobTrack.graceDaysRemaining === 30,
    `got visa=${expiredAndLaidOff.visaTrack.lifecycleState}, job=${expiredAndLaidOff.jobTrack.lifecycleState}, graceDays=${expiredAndLaidOff.jobTrack.graceDaysRemaining}`
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

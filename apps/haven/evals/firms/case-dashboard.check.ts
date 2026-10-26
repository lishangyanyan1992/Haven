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
    validateConsultationBooking,
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

  // Consultation booking call-to-action checks (Step 3: Initial consultation call)
  const withBookingUrl = buildFirmEngagementOverview({
    firmName: "Beacon Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-10-18T00:00:00Z",
    completedAt: "2026-10-19T00:00:00Z",
    reviewedAt: "2026-10-20T00:00:00Z",
    uploadedDocumentCount: 4,
    requiredDocumentCount: 4,
    fulfilledRequiredCount: 4,
    bookingUrl: "https://calendly.com/beacon-law/consultation",
    engagementState: null
  });
  check(
    "engagement cta: firm booking URL generates 'Book consultation call' action",
    withBookingUrl.currentStep.key === "initial_consultation" &&
      withBookingUrl.currentStep.actionHref === "https://calendly.com/beacon-law/consultation" &&
      withBookingUrl.currentStep.actionLabel === "Book consultation call" &&
      withBookingUrl.bookingUrl === "https://calendly.com/beacon-law/consultation",
    `got actionHref=${withBookingUrl.currentStep.actionHref}, actionLabel=${withBookingUrl.currentStep.actionLabel}`
  );

  const withBookingEmail = buildFirmEngagementOverview({
    firmName: "Beacon Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-10-18T00:00:00Z",
    completedAt: "2026-10-19T00:00:00Z",
    reviewedAt: "2026-10-20T00:00:00Z",
    uploadedDocumentCount: 4,
    requiredDocumentCount: 4,
    fulfilledRequiredCount: 4,
    bookingEmail: "consultations@beaconlaw.com",
    engagementState: null
  });
  check(
    "engagement cta: firm scheduling email generates mailto action",
    withBookingEmail.currentStep.key === "initial_consultation" &&
      Boolean(withBookingEmail.currentStep.actionHref?.startsWith("mailto:consultations@beaconlaw.com")) &&
      withBookingEmail.currentStep.actionLabel === "Email to schedule call" &&
      withBookingEmail.bookingEmail === "consultations@beaconlaw.com",
    `got actionHref=${withBookingEmail.currentStep.actionHref}, actionLabel=${withBookingEmail.currentStep.actionLabel}`
  );

  const withDualChannels = buildFirmEngagementOverview({
    firmName: "Beacon Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-10-18T00:00:00Z",
    completedAt: "2026-10-19T00:00:00Z",
    reviewedAt: "2026-10-20T00:00:00Z",
    uploadedDocumentCount: 4,
    requiredDocumentCount: 4,
    fulfilledRequiredCount: 4,
    bookingUrl: "https://calendly.com/beacon-law/consultation",
    bookingEmail: "consultations@beaconlaw.com",
    engagementState: null
  });
  check(
    "engagement cta: dual channels preserves both and prioritizes booking URL as primary action",
    withDualChannels.currentStep.key === "initial_consultation" &&
      withDualChannels.currentStep.actionHref === "https://calendly.com/beacon-law/consultation" &&
      withDualChannels.currentStep.actionLabel === "Book consultation call" &&
      withDualChannels.bookingUrl === "https://calendly.com/beacon-law/consultation" &&
      withDualChannels.bookingEmail === "consultations@beaconlaw.com",
    `got url=${withDualChannels.bookingUrl}, email=${withDualChannels.bookingEmail}`
  );

  const withClientOverride = buildFirmEngagementOverview({
    firmName: "Beacon Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-10-18T00:00:00Z",
    completedAt: "2026-10-19T00:00:00Z",
    reviewedAt: "2026-10-20T00:00:00Z",
    uploadedDocumentCount: 4,
    requiredDocumentCount: 4,
    fulfilledRequiredCount: 4,
    bookingUrl: "https://calendly.com/beacon-law/default",
    bookingEmail: "default@beaconlaw.com",
    engagementState: {
      bookingUrl: "https://calendly.com/beacon-law/partner-override",
      bookingEmail: "partner@beaconlaw.com"
    }
  });
  check(
    "engagement cta: per-client engagement override takes precedence over firm defaults",
    withClientOverride.bookingUrl === "https://calendly.com/beacon-law/partner-override" &&
      withClientOverride.bookingEmail === "partner@beaconlaw.com" &&
      withClientOverride.currentStep.actionHref === "https://calendly.com/beacon-law/partner-override",
    `got url=${withClientOverride.bookingUrl}, actionHref=${withClientOverride.currentStep.actionHref}`
  );

  const unconfigured = buildFirmEngagementOverview({
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
    "engagement cta: unconfigured firm leaves booking channels empty with no action button",
    unconfigured.bookingUrl === null &&
      unconfigured.bookingEmail === null &&
      unconfigured.currentStep.actionHref === undefined,
    `got bookingUrl=${unconfigured.bookingUrl}, actionHref=${unconfigured.currentStep.actionHref}`
  );

  const validBookingConfig = validateConsultationBooking({
    bookingUrl: "  https://calendly.com/test  ",
    bookingEmail: "  TEAM@FIRM.COM  "
  });
  check(
    "validation: trims and normalizes valid booking config",
    validBookingConfig.ok &&
      validBookingConfig.bookingUrl === "https://calendly.com/test" &&
      validBookingConfig.bookingEmail === "team@firm.com",
    JSON.stringify(validBookingConfig)
  );

  const invalidUrlConfig = validateConsultationBooking({
    bookingUrl: "javascript:alert(1)"
  });
  check(
    "validation: rejects non-http/https booking URL",
    !invalidUrlConfig.ok,
    "expected invalid URL to be rejected"
  );

  const invalidEmailConfig = validateConsultationBooking({
    bookingEmail: "not-an-email"
  });
  check(
    "validation: rejects malformed booking email",
    !invalidEmailConfig.ok,
    "expected invalid email to be rejected"
  );

  const bareSchemeConfig = validateConsultationBooking({
    bookingUrl: "https://"
  });
  check(
    "validation: rejects bare scheme without destination in firm booking",
    !bareSchemeConfig.ok,
    "expected bare https:// to be rejected"
  );

  const bareSchemeEngagement = validateEngagementUpdate({
    bookingUrl: "https://"
  });
  check(
    "validation: rejects bare scheme in client engagement override",
    !bareSchemeEngagement.ok,
    "expected bare https:// in engagement override to be rejected"
  );

  const overlengthEngagementUrl = validateEngagementUpdate({
    bookingUrl: `https://calendly.com/${"a".repeat(1005)}`
  });
  check(
    "validation: rejects overlength booking URL in client engagement override",
    !overlengthEngagementUrl.ok,
    "expected overlength URL to be rejected"
  );

  const overlengthEngagementEmail = validateEngagementUpdate({
    bookingEmail: `${"a".repeat(250)}@example.com`
  });
  check(
    "validation: rejects overlength email in client engagement override",
    !overlengthEngagementEmail.ok,
    "expected overlength email to be rejected"
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

  // Reconciliation Scenario 1: I-94 caps 60-day grace period under 8 CFR 214.1(l)(2)
  const userTestNow = new Date("2026-10-26T00:00:00Z");
  const cappedGraceJourney = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      currentVisaExpiryDate: "2026-10-29",
      employmentStatus: "laid_off",
      i140Approved: true,
      i140ApprovalDate: "2026-03-25" // >180d by Oct 26
    },
    deadlines: {
      statusEndDate: "2026-10-29",
      jobEnded: "yes",
      lastWorkDay: "2026-10-08",
      agencyDeadlineDate: "2026-10-30",
      agencyDeadlineType: "interview"
    },
    signals,
    now: userTestNow
  });

  check(
    "reconciliation: I-94 earlier than day 60 caps authorized stay to visa expiry date (3 days remaining)",
    cappedGraceJourney.protection.isGraceCappedByVisa === true &&
      cappedGraceJourney.protection.effectiveStayDaysRemaining === 3 &&
      cappedGraceJourney.visaTrack.effectiveStayDaysRemaining === 3 &&
      cappedGraceJourney.jobTrack.effectiveStayDaysRemaining === 3 &&
      cappedGraceJourney.visaTrack.effectiveStayEndDate === "2026-10-29" &&
      cappedGraceJourney.jobTrack.effectiveStayEndDate === "2026-10-29" &&
      cappedGraceJourney.protection.reconciliationNotice !== null,
    `got isCapped=${cappedGraceJourney.protection.isGraceCappedByVisa}, daysRemaining=${cappedGraceJourney.protection.effectiveStayDaysRemaining}`
  );

  check(
    "reconciliation: tactical 90-day window metrics and pins computed with Today centered at 50%",
    cappedGraceJourney.tacticalWindow.todayPercent === 50 &&
      cappedGraceJourney.tacticalWindow.pins.some((p) => p.isToday) &&
      cappedGraceJourney.tacticalWindow.pins.some((p) => p.id === "tactical-last-day") &&
      cappedGraceJourney.tacticalWindow.pins.some((p) => p.id === "tactical-stay-end") &&
      cappedGraceJourney.tacticalWindow.pins.some((p) => p.id === "tactical-agency-deadline") &&
      cappedGraceJourney.axis.macroBracket.startPercent < cappedGraceJourney.axis.macroBracket.endPercent,
    `pins=${cappedGraceJourney.tacticalWindow.pins.map((p) => p.id).join(",")}`
  );

  check(
    "reconciliation: AC21 180-day portability protection unlocked for approved I-140",
    cappedGraceJourney.protection.isAc21PortabilityUnlocked === true &&
      Boolean(cappedGraceJourney.protection.portabilitySummary),
    `unlocked=${cappedGraceJourney.protection.isAc21PortabilityUnlocked}`
  );

  // Reconciliation Scenario 2: Visa expiry is far in future (e.g. 2027), 60-day grace governs
  const longVisaLaidOff = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      currentVisaExpiryDate: "2027-10-01",
      employmentStatus: "laid_off"
    },
    deadlines: {
      statusEndDate: "2027-10-01",
      jobEnded: "yes",
      lastWorkDay: "2026-10-08"
    },
    signals,
    now: userTestNow
  });

  check(
    "reconciliation: visa expiry after day 60 switches visa track to grace period valid through day 60",
    longVisaLaidOff.protection.isGraceCappedByVisa === false &&
      longVisaLaidOff.protection.effectiveStayDaysRemaining === 42 &&
      longVisaLaidOff.visaTrack.effectiveStayDaysRemaining === 42 &&
      longVisaLaidOff.visaTrack.headline.includes("grace period") &&
      !longVisaLaidOff.visaTrack.headline.includes("2027"),
    `isCapped=${longVisaLaidOff.protection.isGraceCappedByVisa}, headline=${longVisaLaidOff.visaTrack.headline}`
  );

  // Laid-off profile without lastWorkDay does not invent grace-period wording
  const laidOffNoLastWorkDay = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      currentVisaExpiryDate: "2027-10-01",
      employmentStatus: "laid_off"
    },
    deadlines: {
      statusEndDate: "2027-10-01",
      jobEnded: "yes"
    },
    signals,
    now: userTestNow
  });

  check(
    "reconciliation: laid-off profile without lastWorkDay preserves standard visa track wording without grace text",
    !laidOffNoLastWorkDay.visaTrack.headline.includes("grace") &&
      !laidOffNoLastWorkDay.visaTrack.statusBadge.includes("grace") &&
      laidOffNoLastWorkDay.protection.effectiveStayEndDate === "2027-10-01",
    `headline=${laidOffNoLastWorkDay.visaTrack.headline}, badge=${laidOffNoLastWorkDay.visaTrack.statusBadge}`
  );

  // Active employed user with far-out visa expiry does not satisfy urgent stay banner condition
  const activeEmployedFarExpiry = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      currentVisaExpiryDate: "2027-10-01",
      employmentStatus: "employed"
    },
    deadlines: {
      statusEndDate: "2027-10-01",
      jobEnded: "no"
    },
    signals,
    now: userTestNow
  });

  const isStayUrgent =
    activeEmployedFarExpiry.protection.effectiveStayDaysRemaining !== null &&
    activeEmployedFarExpiry.protection.effectiveStayDaysRemaining <= 60;

  check(
    "reconciliation: active employed user with far-out expiry does not satisfy urgent stay banner condition despite urgent today pin",
    activeEmployedFarExpiry.tacticalWindow.pins.some((p) => p.isToday && p.status === "urgent") &&
      !isStayUrgent &&
      activeEmployedFarExpiry.protection.effectiveStayDaysRemaining === 340,
    `isStayUrgent=${isStayUrgent}, days=${activeEmployedFarExpiry.protection.effectiveStayDaysRemaining}`
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

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
    "nav: order is Case (/dashboard) -> Documents (/documents) -> Ask (/advisor) -> Your Info (/profile) -> Settings (/settings)",
    JSON.stringify(hrefMatches) === JSON.stringify(["/dashboard", "/documents", "/advisor", "/profile", "/settings"]) ||
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
    "timeline focus scale: macro focus zone allocates 40% to 45% of bar width around today",
    journey.axis.macroBracket.endPercent - journey.axis.macroBracket.startPercent >= 40 &&
      journey.axis.macroBracket.endPercent - journey.axis.macroBracket.startPercent <= 45 &&
      journey.axis.todayPercent === 50,
    `got width=${journey.axis.macroBracket.endPercent - journey.axis.macroBracket.startPercent}, today=${journey.axis.todayPercent}`
  );
  check(
    "timeline focus scale: axis ticks align with 5 piecewise boundaries and label Today at 50%",
    journey.axis.ticks.length === 5 &&
      journey.axis.ticks[0].percent === 4 &&
      journey.axis.ticks[1].percent === 28 &&
      journey.axis.ticks[2].percent === 50 &&
      journey.axis.ticks[2].label.includes("(Today)") &&
      journey.axis.ticks[3].percent === 72 &&
      journey.axis.ticks[4].percent === 96,
    `got ticks=${JSON.stringify(journey.axis.ticks)}`
  );

  // Verify strict monotonic ordering across all pins
  const allJourneyPins = [
    ...journey.visaTrack.pins,
    ...journey.jobTrack.pins,
    ...journey.greenCardTrack.pins
  ].sort((a, b) => new Date(a.isoDate).getTime() - new Date(b.isoDate).getTime());
  let isMonotonic = true;
  for (let i = 0; i < allJourneyPins.length - 1; i++) {
    if (allJourneyPins[i].percent > allJourneyPins[i + 1].percent) {
      isMonotonic = false;
      break;
    }
  }
  check(
    "timeline focus scale: strictly preserves chronological monotonic ordering across all pins",
    isMonotonic && allJourneyPins.length >= 6,
    `pins=${allJourneyPins.map((p) => `${p.id}:${p.isoDate}@${p.percent}%`).join(", ")}`
  );
  check(
    "timeline focus scale: pins carry daysDiff metadata for immediate countdown inspection",
    journey.visaTrack.pins.every((p) => typeof p.daysDiff === "number") &&
      journey.jobTrack.pins.every((p) => typeof p.daysDiff === "number") &&
      journey.greenCardTrack.pins.every((p) => typeof p.daysDiff === "number"),
    "expected all pins to have daysDiff number"
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

  const cappedLastDayPin = cappedGraceJourney.jobTrack.pins.find((p) => p.id === "job-last-day");
  const cappedGraceEndPin = cappedGraceJourney.jobTrack.pins.find((p) => p.id === "job-grace-end");
  check(
    "timeline focus scale: non-colliding immediate pins allocate >= 4.5% width for 21-day grace span",
    Boolean(cappedLastDayPin && cappedGraceEndPin) &&
      ((cappedGraceEndPin?.percent ?? 0) - (cappedLastDayPin?.percent ?? 0)) >= 4.5,
    `got lastDay=${cappedLastDayPin?.percent}%, graceEnd=${cappedGraceEndPin?.percent}%, diff=${(cappedGraceEndPin?.percent ?? 0) - (cappedLastDayPin?.percent ?? 0)}%`
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
      laidOffNoLastWorkDay.protection.effectiveStayEndDate === null,
    `headline=${laidOffNoLastWorkDay.visaTrack.headline}, badge=${laidOffNoLastWorkDay.visaTrack.statusBadge}`
  );

  // Laid-off profile without lastWorkDay but imminent visa expiry exposes urgent deadline
  const laidOffImminentExpiryNoLastWorkDay = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      currentVisaExpiryDate: "2026-10-29",
      employmentStatus: "laid_off"
    },
    deadlines: {
      statusEndDate: "2026-10-29",
      jobEnded: "yes"
    },
    signals,
    now: userTestNow
  });

  check(
    "reconciliation: laid-off profile without lastWorkDay but imminent I-94 exposes urgent deadline of 3 days",
    laidOffImminentExpiryNoLastWorkDay.protection.effectiveStayEndDate === null &&
      laidOffImminentExpiryNoLastWorkDay.protection.urgentDeadlineDaysRemaining === 3 &&
      laidOffImminentExpiryNoLastWorkDay.protection.urgentDeadlineLabel === "Oct 29, 2026",
    `days=${laidOffImminentExpiryNoLastWorkDay.protection.urgentDeadlineDaysRemaining}`
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

  // Multi-Employer Green Card Scenario 1: Retained priority date from prior sponsor under 8 CFR § 204.5(e)
  const multiEmployerRetainedPdJourney = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      employerName: "Acme AI",
      permStage: "in_progress",
      i140Approved: false,
      retainedPriorityDate: "2021-03-15",
      retainedPriorityDateSponsor: "Meta Platforms",
      preferenceCategory: "EB-2",
      employmentStatus: "employed"
    },
    signals,
    now: userTestNow
  });

  check(
    "multi-employer: retained priority date preserves queue position and unlocks AC21 extensions during PERM",
    multiEmployerRetainedPdJourney.greenCardTrack.priorityDate === "2021-03-15" &&
      multiEmployerRetainedPdJourney.greenCardTrack.retainedPriorityDate === "2021-03-15" &&
      multiEmployerRetainedPdJourney.greenCardTrack.retainedSponsorName === "Meta Platforms" &&
      multiEmployerRetainedPdJourney.greenCardTrack.stage === "perm_in_progress" &&
      multiEmployerRetainedPdJourney.greenCardTrack.headline.includes("Recapturing Mar 15, 2021 PD") &&
      multiEmployerRetainedPdJourney.protection.hasI140Approval === true &&
      multiEmployerRetainedPdJourney.protection.isAc21PortabilityUnlocked === true &&
      multiEmployerRetainedPdJourney.protection.protectingSponsor === "Meta Platforms" &&
      multiEmployerRetainedPdJourney.overlayInsights.some((o) => o.id === "retained-pd-recapture"),
    `priorityDate=${multiEmployerRetainedPdJourney.greenCardTrack.priorityDate}, headline=${multiEmployerRetainedPdJourney.greenCardTrack.headline}`
  );

  // Multi-Employer Green Card Scenario 2: Discrete immigrant petitions with approaching 6-year H-1B cap
  const multiEmployerApproachingCapJourney = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      h1bStartDate: "2020-11-01",
      employerName: "Stripe",
      permStage: "in_progress",
      i140Approved: false,
      employmentStatus: "employed",
      immigrantPetitions: [
        {
          id: "pet-prior",
          sponsorName: "Amazon",
          petitionType: "employer_sponsored",
          preferenceCategory: "EB-2",
          stage: "i140_approved",
          priorityDate: "2021-06-01",
          i140ApprovalDate: "2022-01-10",
          isRevocationProtected: true
        },
        {
          id: "pet-current",
          sponsorName: "Stripe",
          petitionType: "employer_sponsored",
          preferenceCategory: "EB-2",
          stage: "perm_in_progress",
          permFilingDate: "2026-01-15"
        }
      ]
    },
    signals: {
      ...signals,
      h1bCapDate: "2026-11-01"
    },
    now: userTestNow
  });

  check(
    "multi-employer: prior approved I-140 bridges H-1B cap with AC21 extensions while current PERM is pending",
    multiEmployerApproachingCapJourney.protection.hasI140Approval === true &&
      multiEmployerApproachingCapJourney.protection.isAc21PortabilityUnlocked === true &&
      multiEmployerApproachingCapJourney.greenCardTrack.stage === "perm_in_progress" &&
      multiEmployerApproachingCapJourney.overlayInsights.some((o) => o.id === "cap-protected") &&
      !multiEmployerApproachingCapJourney.overlayInsights.some((o) => o.id === "cap-unprotected") &&
      (multiEmployerApproachingCapJourney.greenCardTrack.petitions?.length ?? 0) === 2 &&
      Boolean(multiEmployerApproachingCapJourney.greenCardTrack.nodes.find((n) => n.key === "priority_date")?.badgeText.includes("Retained")),
    `hasI140Approval=${multiEmployerApproachingCapJourney.protection.hasI140Approval}, petitions=${multiEmployerApproachingCapJourney.greenCardTrack.petitions?.length}`
  );

  // Multi-Employer Green Card Scenario 3: Concurrent self-petition (EB-2 NIW) with employer PERM
  const concurrentNiwJourney = buildImmigrationJourney({
    profile: {
      ...baseProfile,
      visaType: "H1B",
      employerName: "Databricks",
      permStage: "in_progress",
      employmentStatus: "employed",
      immigrantPetitions: [
        {
          id: "eb2-niw",
          sponsorName: "Self-Petition (NIW)",
          petitionType: "self_petition_niw",
          preferenceCategory: "EB-2 NIW",
          stage: "i140_approved",
          priorityDate: "2023-04-10",
          isRevocationProtected: true
        },
        {
          id: "databricks-perm",
          sponsorName: "Databricks",
          petitionType: "employer_sponsored",
          preferenceCategory: "EB-2",
          stage: "perm_in_progress"
        }
      ]
    },
    signals,
    now: userTestNow
  });

  check(
    "multi-employer: concurrent EB-2 NIW self-petition tracked independently alongside employer PERM",
    concurrentNiwJourney.protection.hasI140Approval === true &&
      concurrentNiwJourney.greenCardTrack.priorityDate === "2023-04-10" &&
      concurrentNiwJourney.greenCardTrack.retainedPriorityDate === null &&
      !concurrentNiwJourney.greenCardTrack.headline.includes("Recapturing") &&
      (concurrentNiwJourney.greenCardTrack.petitions?.length ?? 0) === 2 &&
      concurrentNiwJourney.greenCardTrack.petitions?.some((p) => p.petitionType === "self_petition_niw" && p.isApproved) === true,
    `priorityDate=${concurrentNiwJourney.greenCardTrack.priorityDate}`
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

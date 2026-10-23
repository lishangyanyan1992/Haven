import type { DeadlineAnswers } from "@/lib/deadlines";
import type {
  ActiveLayoffEvent,
  DerivedProfileSignals,
  GreenCardStage,
  ImmigrationProfile,
  PriorityDateIntelligence
} from "@/types/domain";

export type JourneyTrackTone = "sage" | "sky" | "sand" | "blush" | "ink";

export type JourneyPlotPin = {
  id: string;
  label: string;
  dateLabel: string;
  isoDate: string;
  percent: number;
  tone: JourneyTrackTone;
  status: "past" | "today" | "upcoming" | "urgent";
  detail: string;
};

export type JourneyBarSegment = {
  id: string;
  label: string;
  startPercent: number;
  endPercent: number;
  tone: JourneyTrackTone;
  dashed?: boolean;
};

export type VisaLifecycleState =
  | "started_active"
  | "expiring_soon"
  | "expired"
  | "completed"
  | "needs_dates";

export type VisaJourneyTrack = {
  visaType: string;
  lifecycleState: VisaLifecycleState;
  statusBadge: string;
  statusTone: JourneyTrackTone;
  headline: string;
  summary: string;
  startDate: string | null;
  startDateLabel: string | null;
  expiryDate: string | null;
  expiryDateLabel: string | null;
  daysUntilExpiry: number | null;
  capDate: string | null;
  capDateLabel: string | null;
  renewalWindowDateLabel: string | null;
  segments: JourneyBarSegment[];
  pins: JourneyPlotPin[];
};

export type JobLifecycleState =
  | "employed"
  | "grace_period"
  | "searching"
  | "needs_details";

export type JobJourneyTrack = {
  isWorkVisa: boolean;
  employerName: string | null;
  jobTitle: string | null;
  employerSize: string | null;
  lifecycleState: JobLifecycleState;
  statusBadge: string;
  statusTone: JourneyTrackTone;
  headline: string;
  summary: string;
  lastWorkDayLabel: string | null;
  graceEndLabel: string | null;
  graceDaysRemaining: number | null;
  portabilityLabel: string | null;
  segments: JourneyBarSegment[];
  pins: JourneyPlotPin[];
};

export type GreenCardStageNode = {
  key: "perm" | "priority_date" | "i140" | "bulletin_queue" | "i485";
  label: string;
  shortLabel: string;
  status: "completed" | "current" | "upcoming";
  badgeText: string;
  dateOrMeta: string;
  detail: string;
};

export type GreenCardJourneyTrack = {
  stage: GreenCardStage;
  categoryLabel: string;
  statusBadge: string;
  statusTone: JourneyTrackTone;
  headline: string;
  summary: string;
  priorityDate: string | null;
  priorityDateLabel: string | null;
  estimatedRangeLabel: string | null;
  bulletinCutoffLabel: string | null;
  nodes: GreenCardStageNode[];
  segments: JourneyBarSegment[];
  pins: JourneyPlotPin[];
};

export type OverlayInsight = {
  id: string;
  title: string;
  body: string;
  tone: "sage" | "sky" | "blush" | "sand";
};

export type ImmigrationJourneyView = {
  axis: {
    startIso: string;
    endIso: string;
    startLabel: string;
    endLabel: string;
    todayIso: string;
    todayLabel: string;
    todayPercent: number;
    ticks: { label: string; percent: number }[];
  };
  visaTrack: VisaJourneyTrack;
  jobTrack: JobJourneyTrack;
  greenCardTrack: GreenCardJourneyTrack;
  overlayInsights: OverlayInsight[];
  missingFields: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00Z` : trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string | Date | null | undefined): string | null {
  const date = value instanceof Date ? value : parseIsoDate(value);
  if (!date) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatMonthYear(value: Date): string {
  return value.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function inferProfileGreenCardStage(profile: ImmigrationProfile): GreenCardStage {
  if (profile.i485Filed) return "i485_filed";
  if (profile.i140Approved) return "i140_approved";
  if (profile.permStage === "certified") return "perm_certified";
  if (profile.permStage === "in_progress") return "perm_in_progress";
  return "not_started";
}

function estimateFutureGcDate(
  profile: ImmigrationProfile,
  intelligence: PriorityDateIntelligence | null,
  today: Date
): Date | null {
  if (profile.visaType === "GC" || profile.visaType === "Citizen") {
    return today;
  }
  if (profile.i485Filed) {
    return new Date(today.getTime() + 270 * DAY_MS);
  }
  if (intelligence?.isCurrent) {
    return new Date(today.getTime() + 365 * DAY_MS);
  }
  if (profile.priorityDate) {
    // Approximate horizon for visual overlay based on category & chargeability
    const isBackloggedCountry =
      profile.countryOfBirth === "India" || profile.countryOfBirth === "China";
    const yearsOut =
      profile.preferenceCategory === "EB-1"
        ? isBackloggedCountry
          ? 2
          : 1
        : isBackloggedCountry
          ? 4
          : 1.5;
    return new Date(today.getTime() + Math.round(yearsOut * 365 * DAY_MS));
  }
  return null;
}

export function buildImmigrationJourney(input: {
  profile: ImmigrationProfile;
  deadlines?: DeadlineAnswers | null;
  signals: DerivedProfileSignals;
  activeLayoffEvent?: ActiveLayoffEvent | null;
  priorityDateIntelligence?: PriorityDateIntelligence | null;
  now?: Date;
}): ImmigrationJourneyView {
  const today = input.now ?? new Date();
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const todayUtc = new Date(todayMs);
  const deadlines = input.deadlines ?? {};
  const { profile, signals, activeLayoffEvent, priorityDateIntelligence } = input;

  // Resolve key dates across profile + deadline_answers
  const visaStartRaw = profile.h1bStartDate ?? null;
  const visaStartDate = parseIsoDate(visaStartRaw);

  const visaExpiryRaw = deadlines.statusEndDate || profile.currentVisaExpiryDate || null;
  const visaExpiryDate = parseIsoDate(visaExpiryRaw);

  const capDateRaw =
    signals.h1bCapDate ??
    (visaStartDate && profile.visaType === "H1B"
      ? toIsoDate(new Date(Date.UTC(visaStartDate.getUTCFullYear() + 6, visaStartDate.getUTCMonth(), visaStartDate.getUTCDate())))
      : null);
  const capDate = parseIsoDate(capDateRaw);

  const priorityDateRaw = profile.priorityDate ?? null;
  const priorityDate = parseIsoDate(priorityDateRaw);

  const permFilingDate = parseIsoDate(profile.permFilingDate ?? null);
  const i140ApprovalDate = parseIsoDate(profile.i140ApprovalDate ?? null);

  const lastWorkDayRaw = activeLayoffEvent?.layoffDate || (deadlines.jobEnded === "yes" ? deadlines.lastWorkDay : null) || null;
  const lastWorkDayDate = parseIsoDate(lastWorkDayRaw);
  const isLaidOff =
    Boolean(activeLayoffEvent) ||
    deadlines.jobEnded === "yes" ||
    profile.employmentStatus === "laid_off";
  const graceEndDate = lastWorkDayDate ? new Date(lastWorkDayDate.getTime() + 60 * DAY_MS) : null;

  const projectedGcDate = estimateFutureGcDate(profile, priorityDateIntelligence ?? null, todayUtc);

  // Build shared time horizon [axisStart, axisEnd]
  const candidatePastMs: number[] = [todayMs - 365 * DAY_MS];
  if (visaStartDate) candidatePastMs.push(visaStartDate.getTime());
  if (priorityDate) candidatePastMs.push(priorityDate.getTime());
  if (permFilingDate) candidatePastMs.push(permFilingDate.getTime());
  if (lastWorkDayDate) candidatePastMs.push(lastWorkDayDate.getTime() - 90 * DAY_MS);

  const candidateFutureMs: number[] = [todayMs + 540 * DAY_MS];
  if (visaExpiryDate) candidateFutureMs.push(visaExpiryDate.getTime() + 60 * DAY_MS);
  if (capDate) candidateFutureMs.push(capDate.getTime() + 60 * DAY_MS);
  if (graceEndDate) candidateFutureMs.push(graceEndDate.getTime() + 60 * DAY_MS);
  if (projectedGcDate) candidateFutureMs.push(projectedGcDate.getTime());

  const minStartMs = Math.min(...candidatePastMs);
  const maxEndMs = Math.max(...candidateFutureMs, minStartMs + 365 * DAY_MS);
  const spanMs = Math.max(maxEndMs - minStartMs, 180 * DAY_MS);

  // Add 4% breathing room on both ends
  const paddedStartMs = minStartMs - spanMs * 0.04;
  const paddedEndMs = maxEndMs + spanMs * 0.04;
  const totalSpanMs = paddedEndMs - paddedStartMs;

  const toPercent = (ms: number) => {
    const raw = ((ms - paddedStartMs) / totalSpanMs) * 100;
    return Math.round(Math.min(98, Math.max(2, raw)) * 10) / 10;
  };

  const todayPercent = toPercent(todayMs);

  // Build 5 clean axis ticks
  const tickCount = 5;
  const ticks: { label: string; percent: number }[] = [];
  for (let i = 0; i < tickCount; i++) {
    const frac = i / (tickCount - 1);
    const ms = paddedStartMs + frac * totalSpanMs;
    ticks.push({
      label: formatMonthYear(new Date(ms)),
      percent: Math.round((4 + frac * 92) * 10) / 10
    });
  }

  // =========================================================================
  // TRACK 1: VISA STATUS TRACK
  // =========================================================================
  const daysUntilExpiry = visaExpiryDate
    ? Math.ceil((visaExpiryDate.getTime() - todayMs) / DAY_MS)
    : signals.daysUntilVisaExpiry ?? null;

  let visaLifecycle: VisaLifecycleState = "started_active";
  let visaBadge = `${profile.visaType} · Active`;
  let visaTone: JourneyTrackTone = "sage";
  let visaHeadline = `${profile.visaType} status is active`;
  let visaSummary = "Your current status is active and tracked alongside your employment and green card timelines.";

  if (profile.visaType === "GC" || profile.visaType === "Citizen") {
    visaLifecycle = "completed";
    visaBadge = profile.visaType === "Citizen" ? "US Citizen · Completed" : "Green Card · Completed";
    visaTone = "sage";
    visaHeadline = `${profile.visaType === "Citizen" ? "Citizenship" : "Permanent residency"} complete`;
    visaSummary = "You hold permanent status and no longer depend on temporary visa renewals.";
  } else if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
    visaLifecycle = "expired";
    visaBadge = `Expired ${Math.abs(daysUntilExpiry)}d ago`;
    visaTone = "blush";
    visaHeadline = `${profile.visaType} expiration date passed`;
    visaSummary = `Your recorded ${profile.visaType} end date (${formatDateLabel(visaExpiryDate)}) has passed. Confirm whether an extension or change of status was filed.`;
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 90) {
    visaLifecycle = "expiring_soon";
    visaBadge = `Expires in ${daysUntilExpiry}d`;
    visaTone = daysUntilExpiry <= 30 ? "blush" : "sand";
    visaHeadline = `${profile.visaType} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
    visaSummary = `Current status runs through ${formatDateLabel(visaExpiryDate)}. Coordinate renewal or extension filing well before expiration.`;
  } else if (visaExpiryDate) {
    visaLifecycle = "started_active";
    visaBadge = `Active · ${daysUntilExpiry}d left`;
    visaTone = "sage";
    visaHeadline = `${profile.visaType} active through ${formatDateLabel(visaExpiryDate)}`;
    visaSummary = visaStartDate
      ? `Started ${formatDateLabel(visaStartDate)} and valid through ${formatDateLabel(visaExpiryDate)}.`
      : `Valid through ${formatDateLabel(visaExpiryDate)}.`;
  } else if (visaStartDate) {
    visaLifecycle = "started_active";
    visaBadge = `Started ${formatDateLabel(visaStartDate)}`;
    visaTone = "sky";
    visaHeadline = `${profile.visaType} started ${formatDateLabel(visaStartDate)}`;
    visaSummary = "Add your current I-94 or approval notice expiration date to plot your renewal window.";
  } else {
    visaLifecycle = "needs_dates";
    visaBadge = `${profile.visaType || "Visa"} · Add dates`;
    visaTone = "sand";
    visaHeadline = `${profile.visaType || "Current visa"} start & expiry dates needed`;
    visaSummary = "Add your visa start date and expiration date to see your exact status bar and renewal window.";
  }

  const visaSegments: JourneyBarSegment[] = [];
  const visaPins: JourneyPlotPin[] = [];

  const effectiveVisaStartMs = visaStartDate ? visaStartDate.getTime() : todayMs - 180 * DAY_MS;
  const effectiveVisaEndMs = visaExpiryDate
    ? visaExpiryDate.getTime()
    : capDate
      ? capDate.getTime()
      : todayMs + 365 * DAY_MS;

  const visaStartPct = toPercent(effectiveVisaStartMs);
  const visaEndPct = toPercent(Math.max(effectiveVisaEndMs, effectiveVisaStartMs + 30 * DAY_MS));

  if (visaEndPct > todayPercent && visaStartPct < todayPercent) {
    visaSegments.push({
      id: "visa-elapsed",
      label: `${profile.visaType} elapsed`,
      startPercent: visaStartPct,
      endPercent: todayPercent,
      tone: "sage"
    });
    visaSegments.push({
      id: "visa-remaining",
      label: `${profile.visaType} remaining validity`,
      startPercent: todayPercent,
      endPercent: visaEndPct,
      tone: visaLifecycle === "expiring_soon" ? "blush" : "sky"
    });
  } else {
    visaSegments.push({
      id: "visa-main",
      label: `${profile.visaType} window`,
      startPercent: Math.min(visaStartPct, visaEndPct),
      endPercent: Math.max(visaStartPct + 3, visaEndPct),
      tone: visaLifecycle === "expired" ? "blush" : "sage"
    });
  }

  if (capDate && (!visaExpiryDate || capDate.getTime() > visaExpiryDate.getTime() + 14 * DAY_MS)) {
    const capPct = toPercent(capDate.getTime());
    if (capPct > visaEndPct) {
      visaSegments.push({
        id: "visa-cap-window",
        label: "Remaining 6-year H-1B cap horizon",
        startPercent: visaEndPct,
        endPercent: capPct,
        tone: "sand",
        dashed: true
      });
    }
  }

  if (visaStartDate) {
    visaPins.push({
      id: "visa-start",
      label: `${profile.visaType} started`,
      dateLabel: formatDateLabel(visaStartDate)!,
      isoDate: toIsoDate(visaStartDate),
      percent: toPercent(visaStartDate.getTime()),
      tone: "sage",
      status: visaStartDate.getTime() <= todayMs ? "past" : "upcoming",
      detail: `Initial ${profile.visaType} start date on file.`
    });
  }

  let renewalWindowDateLabel: string | null = null;
  if (visaExpiryDate) {
    const renewalDate = new Date(visaExpiryDate.getTime() - 180 * DAY_MS);
    renewalWindowDateLabel = formatDateLabel(renewalDate);
    if (renewalDate.getTime() > (visaStartDate?.getTime() ?? 0)) {
      visaPins.push({
        id: "visa-renewal",
        label: "Renewal window opens",
        dateLabel: renewalWindowDateLabel!,
        isoDate: toIsoDate(renewalDate),
        percent: toPercent(renewalDate.getTime()),
        tone: "sky",
        status: renewalDate.getTime() <= todayMs ? "past" : "upcoming",
        detail: "Earliest standard window (6 months before expiry) to file an extension."
      });
    }

    visaPins.push({
      id: "visa-expiry",
      label: daysUntilExpiry !== null && daysUntilExpiry < 0 ? `${profile.visaType} expired` : `${profile.visaType} expires`,
      dateLabel: formatDateLabel(visaExpiryDate)!,
      isoDate: toIsoDate(visaExpiryDate),
      percent: toPercent(visaExpiryDate.getTime()),
      tone: visaLifecycle === "expired" || visaLifecycle === "expiring_soon" ? "blush" : "ink",
      status:
        daysUntilExpiry !== null && daysUntilExpiry < 0
          ? "urgent"
          : daysUntilExpiry !== null && daysUntilExpiry <= 90
            ? "urgent"
            : "upcoming",
      detail:
        daysUntilExpiry !== null && daysUntilExpiry >= 0
          ? `${daysUntilExpiry} days remaining until current status expiration.`
          : "Current status expiration date has passed."
    });
  }

  if (capDate) {
    visaPins.push({
      id: "visa-cap",
      label: "6-year H-1B max-out",
      dateLabel: formatDateLabel(capDate)!,
      isoDate: toIsoDate(capDate),
      percent: toPercent(capDate.getTime()),
      tone: profile.i140Approved ? "sage" : "sand",
      status: capDate.getTime() <= todayMs ? "urgent" : "upcoming",
      detail: profile.i140Approved
        ? "Approved I-140 unlocks AC21 extensions beyond the 6-year cap."
        : "6-year statutory H-1B limit unless PERM/I-140 qualifies for AC21 extension."
    });
  }

  // =========================================================================
  // TRACK 2: EMPLOYMENT / JOB TRACK
  // =========================================================================
  const isWorkVisa =
    ["H1B", "OPT", "STEM OPT", "O-1"].includes(profile.visaType) ||
    Boolean(profile.employerName?.trim() || profile.jobTitle?.trim());

  const employerName = profile.employerName?.trim() || null;
  const jobTitle = profile.jobTitle?.trim() || null;
  const roleHeadlineParts = [employerName, jobTitle].filter(Boolean);
  const roleLabel = roleHeadlineParts.length > 0 ? roleHeadlineParts.join(" · ") : "Sponsoring employer";

  const graceDaysRemaining = graceEndDate
    ? Math.ceil((graceEndDate.getTime() - todayMs) / DAY_MS)
    : null;

  let jobLifecycle: JobLifecycleState = "employed";
  let jobBadge = employerName ? `Employed · ${employerName}` : "Employed";
  let jobTone: JourneyTrackTone = "sage";
  let jobHeadline = roleLabel;
  let jobSummary = employerName
    ? `Active work authorization with ${employerName}${jobTitle ? ` as ${jobTitle}` : ""}.`
    : "Add your employer and job title to align your work authorization with your visa and green card tracks.";

  if (isLaidOff) {
    jobLifecycle = "grace_period";
    jobTone = "blush";
    if (graceDaysRemaining !== null) {
      jobBadge =
        graceDaysRemaining >= 0
          ? `60-day grace · ${graceDaysRemaining}d left`
          : `Grace window passed (${Math.abs(graceDaysRemaining)}d ago)`;
      jobHeadline =
        graceDaysRemaining >= 0
          ? `${graceDaysRemaining} days left in 60-day grace period`
          : "60-day grace period window has passed";
      jobSummary = ` Employment ended ${formatDateLabel(lastWorkDayDate)}. Bridge window ends ${formatDateLabel(graceEndDate)}.`;
    } else {
      jobBadge = "60-day grace period";
      jobHeadline = "Employment ended — in grace period";
      jobSummary = "Add your last day of work to plot your exact 60-day filing window.";
    }
  } else if (profile.employmentStatus === "actively_searching") {
    jobLifecycle = "searching";
    jobBadge = "Actively searching";
    jobTone = "sky";
    jobHeadline = `${roleLabel} (Planning transfer)`;
    jobSummary = "Tracking H-1B transfer timing and I-140 job portability across employers.";
  } else if (!employerName && !jobTitle) {
    jobLifecycle = "needs_details";
    jobBadge = "Add job details";
    jobTone = "sand";
  }

  const jobSegments: JourneyBarSegment[] = [];
  const jobPins: JourneyPlotPin[] = [];

  const jobStartMs = visaStartDate ? visaStartDate.getTime() : todayMs - 180 * DAY_MS;
  const jobStartPct = toPercent(jobStartMs);

  if (isLaidOff && lastWorkDayDate && graceEndDate) {
    const layoffPct = toPercent(lastWorkDayDate.getTime());
    const gracePct = toPercent(graceEndDate.getTime());
    if (layoffPct > jobStartPct) {
      jobSegments.push({
        id: "job-employed",
        label: employerName ?? "Employment period",
        startPercent: jobStartPct,
        endPercent: layoffPct,
        tone: "sage"
      });
    }
    jobSegments.push({
      id: "job-grace",
      label: "60-day grace window",
      startPercent: layoffPct,
      endPercent: Math.max(layoffPct + 2.5, gracePct),
      tone: "blush"
    });
    jobPins.push({
      id: "job-last-day",
      label: "Last day of work",
      dateLabel: formatDateLabel(lastWorkDayDate)!,
      isoDate: toIsoDate(lastWorkDayDate),
      percent: layoffPct,
      tone: "blush",
      status: "past",
      detail: `Employment with ${employerName ?? "sponsor"} ended.`
    });
    jobPins.push({
      id: "job-grace-end",
      label: "60-day grace ends",
      dateLabel: formatDateLabel(graceEndDate)!,
      isoDate: toIsoDate(graceEndDate),
      percent: gracePct,
      tone: "blush",
      status: "urgent",
      detail: "File transfer, change of status, or departure before this date."
    });
  } else {
    const jobEndMs = effectiveVisaEndMs;
    const jobEndPct = toPercent(Math.max(jobEndMs, todayMs + 90 * DAY_MS));
    jobSegments.push({
      id: "job-active",
      label: roleLabel,
      startPercent: jobStartPct,
      endPercent: todayPercent,
      tone: "sage"
    });
    jobSegments.push({
      id: "job-authorized",
      label: "Authorized employment window",
      startPercent: todayPercent,
      endPercent: Math.max(todayPercent + 3, jobEndPct),
      tone: "sky",
      dashed: true
    });
  }

  let portabilityLabel: string | null = signals.ac21PortabilityStatus ?? null;
  if (profile.i140Approved) {
    if (i140ApprovalDate) {
      const ac21Date = new Date(i140ApprovalDate.getTime() + 180 * DAY_MS);
      const unlocked = ac21Date.getTime() <= todayMs;
      portabilityLabel = unlocked
        ? `AC21 portable (unlocked ${formatDateLabel(ac21Date)})`
        : `AC21 unlocks ${formatDateLabel(ac21Date)}`;
      jobPins.push({
        id: "job-ac21",
        label: unlocked ? "AC21 portability unlocked" : "AC21 180-day lock-in",
        dateLabel: formatDateLabel(ac21Date)!,
        isoDate: toIsoDate(ac21Date),
        percent: toPercent(ac21Date.getTime()),
        tone: "sage",
        status: unlocked ? "past" : "upcoming",
        detail: "180 days post I-140 approval protects priority date and job portability."
      });
    } else {
      portabilityLabel = "Approved I-140 on file (AC21 eligible after 180 days)";
    }
  }

  if (deadlines.agencyDeadlineDate && deadlines.agencyDeadlineType) {
    const agencyDate = parseIsoDate(deadlines.agencyDeadlineDate);
    if (agencyDate) {
      const typeLabels: Record<string, string> = {
        rfe: "RFE response due",
        interview: "Agency interview",
        biometrics: "Biometrics appointment",
        other: "USCIS / consulate deadline"
      };
      jobPins.push({
        id: "job-agency-deadline",
        label: typeLabels[deadlines.agencyDeadlineType] ?? "Agency deadline",
        dateLabel: formatDateLabel(agencyDate)!,
        isoDate: toIsoDate(agencyDate),
        percent: toPercent(agencyDate.getTime()),
        tone: "blush",
        status: "urgent",
        detail: "Upcoming agency deadline from your case record."
      });
    }
  }

  // =========================================================================
  // TRACK 3: GREEN CARD TIMELINE TRACK
  // =========================================================================
  const gcStage = inferProfileGreenCardStage(profile);
  const categoryLabel =
    profile.preferenceCategory && profile.preferenceCategory !== "Not sure"
      ? `${profile.preferenceCategory}${profile.countryOfBirth ? ` · ${profile.countryOfBirth}` : ""}`
      : profile.countryOfBirth
        ? `Category TBD · ${profile.countryOfBirth}`
        : "Category TBD";

  const STAGE_ORDER: Record<GreenCardStage, number> = {
    not_started: 0,
    perm_in_progress: 1,
    perm_certified: 2,
    i140_filed: 3,
    i140_approved: 4,
    i485_filed: 5
  };
  const stageRank = STAGE_ORDER[gcStage];
  const isGcComplete = profile.visaType === "GC" || profile.visaType === "Citizen";

  const estimatedRangeLabel =
    priorityDateIntelligence?.estimatedGreenCardDateRange ??
    signals.estimatedGreenCardDateRange ??
    (projectedGcDate ? `Est. ${formatMonthYear(projectedGcDate)}` : null);

  const bulletinCutoffLabel = priorityDateIntelligence?.latestCutoffLabel
    ? `${priorityDateIntelligence.latestBulletinLabel}: ${priorityDateIntelligence.latestCutoffLabel}`
    : null;

  const gcNodes: GreenCardStageNode[] = [
    {
      key: "perm",
      label: "PERM Labor Certification",
      shortLabel: "PERM",
      status:
        isGcComplete || stageRank >= 2 || profile.preferenceCategory === "EB-1" || profile.preferenceCategory === "EB-2 NIW"
          ? "completed"
          : stageRank === 1
            ? "current"
            : "upcoming",
      badgeText:
        profile.preferenceCategory === "EB-1" || profile.preferenceCategory === "EB-2 NIW"
          ? "Waived / Self-petition"
          : stageRank >= 2 || isGcComplete
            ? "Certified"
            : stageRank === 1
              ? "In progress"
              : "Not started",
      dateOrMeta: permFilingDate ? `Filed ${formatDateLabel(permFilingDate)}` : "Step 1 of sponsorship",
      detail: "Prevailing wage determination, recruitment, and DOL ETA-9089 certification."
    },
    {
      key: "priority_date",
      label: "Priority Date Locked",
      shortLabel: "Priority Date",
      status: priorityDate || stageRank >= 2 || isGcComplete ? "completed" : stageRank === 1 ? "current" : "upcoming",
      badgeText: priorityDate ? formatDateLabel(priorityDate)! : "Not locked yet",
      dateOrMeta: priorityDate ? `Queue place: ${categoryLabel}` : "Set when PERM or I-140 is filed",
      detail: "Your place in the Visa Bulletin line based on preference category and country of birth."
    },
    {
      key: "i140",
      label: "I-140 Immigrant Petition",
      shortLabel: "I-140",
      status:
        isGcComplete || stageRank >= 4
          ? "completed"
          : stageRank === 2 || stageRank === 3
            ? "current"
            : "upcoming",
      badgeText:
        isGcComplete || stageRank >= 4
          ? "Approved"
          : stageRank === 3
            ? "Filed / Pending"
            : stageRank === 2
              ? "Ready to file"
              : "Upcoming",
      dateOrMeta: i140ApprovalDate
        ? `Approved ${formatDateLabel(i140ApprovalDate)}`
        : profile.i140Approved
          ? "Approved on file"
          : "Unlocks AC21 extensions",
      detail: "Approves your immigrant classification and unlocks post-6-year H-1B extensions."
    },
    {
      key: "bulletin_queue",
      label: "Visa Bulletin Queue",
      shortLabel: "Visa Bulletin",
      status:
        isGcComplete || stageRank >= 5 || priorityDateIntelligence?.isCurrent
          ? "completed"
          : stageRank >= 3 || Boolean(priorityDate)
            ? "current"
            : "upcoming",
      badgeText: priorityDateIntelligence?.isCurrent
        ? "Current"
        : priorityDateIntelligence?.gapLabel
          ? priorityDateIntelligence.gapLabel
          : priorityDate
            ? "Tracking monthly"
            : "Awaiting priority date",
      dateOrMeta: bulletinCutoffLabel ?? categoryLabel,
      detail:
        priorityDateIntelligence?.visaBulletinPosition ??
        signals.visaBulletinPosition ??
        "Monthly Visa Bulletin cutoff movement determines when you can file I-485."
    },
    {
      key: "i485",
      label: "I-485 Adjustment of Status",
      shortLabel: "I-485 / Green Card",
      status: isGcComplete ? "completed" : stageRank >= 5 ? "current" : "upcoming",
      badgeText: isGcComplete ? "Approved" : stageRank >= 5 ? "Filed & Pending" : "Upcoming",
      dateOrMeta: estimatedRangeLabel ?? "Final step to permanent residency",
      detail: "Biometrics, EAD/AP combo card, and final green card adjudication."
    }
  ];

  const gcSegments: JourneyBarSegment[] = [];
  const gcPins: JourneyPlotPin[] = [];

  const gcStartDate = permFilingDate ?? priorityDate ?? (stageRank > 0 ? visaStartDate : null);
  const gcStartPct = gcStartDate ? toPercent(gcStartDate.getTime()) : todayPercent;
  const gcTargetPct = projectedGcDate ? toPercent(projectedGcDate.getTime()) : Math.min(96, todayPercent + 28);

  if (stageRank > 0 || priorityDate || isGcComplete) {
    if (gcStartPct < todayPercent) {
      gcSegments.push({
        id: "gc-completed-span",
        label: "Green card progress to date",
        startPercent: gcStartPct,
        endPercent: todayPercent,
        tone: "sage"
      });
    }
    if (!isGcComplete && gcTargetPct > todayPercent) {
      gcSegments.push({
        id: "gc-projected-span",
        label: "Projected bulletin & I-485 window",
        startPercent: todayPercent,
        endPercent: gcTargetPct,
        tone: "sky",
        dashed: true
      });
    }
  } else {
    gcSegments.push({
      id: "gc-not-started",
      label: "Green card track not started yet",
      startPercent: todayPercent,
      endPercent: Math.min(95, todayPercent + 24),
      tone: "sand",
      dashed: true
    });
  }

  if (priorityDate) {
    gcPins.push({
      id: "gc-pd",
      label: "Priority date",
      dateLabel: formatDateLabel(priorityDate)!,
      isoDate: toIsoDate(priorityDate),
      percent: toPercent(priorityDate.getTime()),
      tone: "sage",
      status: priorityDate.getTime() <= todayMs ? "past" : "upcoming",
      detail: `${categoryLabel} priority date locked.`
    });
  }

  if (i140ApprovalDate) {
    gcPins.push({
      id: "gc-i140",
      label: "I-140 approved",
      dateLabel: formatDateLabel(i140ApprovalDate)!,
      isoDate: toIsoDate(i140ApprovalDate),
      percent: toPercent(i140ApprovalDate.getTime()),
      tone: "sage",
      status: "past",
      detail: "Immigrant petition approved."
    });
  }

  if (projectedGcDate && !isGcComplete) {
    gcPins.push({
      id: "gc-target",
      label: profile.i485Filed ? "Est. I-485 decision window" : "Projected green card horizon",
      dateLabel: estimatedRangeLabel ?? formatMonthYear(projectedGcDate),
      isoDate: toIsoDate(projectedGcDate),
      percent: gcTargetPct,
      tone: "sky",
      status: "upcoming",
      detail:
        priorityDateIntelligence?.estimateLabel ??
        "Estimated window based on current Visa Bulletin queue position."
    });
  }

  const STAGE_BADGE_LABELS: Record<GreenCardStage, string> = {
    not_started: "Not started",
    perm_in_progress: "PERM in progress",
    perm_certified: "PERM certified",
    i140_filed: "I-140 filed",
    i140_approved: "I-140 approved",
    i485_filed: "I-485 filed"
  };

  const gcStatusBadge = isGcComplete ? "Green Card holder" : STAGE_BADGE_LABELS[gcStage];
  const gcStatusTone: JourneyTrackTone =
    isGcComplete || stageRank >= 4 ? "sage" : stageRank >= 1 ? "sky" : "sand";
  const gcHeadline = isGcComplete
    ? "Permanent residency completed"
    : `${STAGE_BADGE_LABELS[gcStage]} · ${categoryLabel}`;
  const gcSummary =
    priorityDateIntelligence?.visaBulletinPosition ??
    signals.visaBulletinPosition ??
    (stageRank === 0
      ? "Green card sponsorship has not started yet. Overlay shows how starting PERM/I-140 aligns with your current visa window."
      : `Tracking ${ STAGE_BADGE_LABELS[gcStage].toLowerCase() } in the ${categoryLabel} queue.`);

  // =========================================================================
  // CROSS-TRACK OVERLAY INSIGHTS
  // =========================================================================
  const overlayInsights: OverlayInsight[] = [];

  if (isLaidOff && graceDaysRemaining !== null) {
    overlayInsights.push({
      id: "grace-vs-gc",
      title: "60-day grace period vs. Green Card portability",
      body: profile.i140Approved
        ? `Your employment ended with ${Math.max(0, graceDaysRemaining)} days left in your 60-day grace window, and your approved I-140 preserves your ${formatDateLabel(priorityDate) ?? "priority date"} and unlocks H-1B extensions with a new sponsor.`
        : `Your 60-day grace window has ${Math.max(0, graceDaysRemaining)} days remaining. Because an I-140 is not yet approved, focus first on an H-1B transfer or change of status before ${formatDateLabel(graceEndDate)}.`,
      tone: "blush"
    });
  }

  if (profile.visaType === "H1B" && capDate) {
    const daysToCap = Math.ceil((capDate.getTime() - todayMs) / DAY_MS);
    if (profile.i140Approved) {
      overlayInsights.push({
        id: "cap-protected",
        title: "Visa cap & Green Card tracks are bridged",
        body: `Your 6-year H-1B cap date is ${formatDateLabel(capDate)}, and your approved I-140 makes you eligible for 3-year AC21 extensions beyond the 6-year limit while waiting in the ${categoryLabel} queue.`,
        tone: "sage"
      });
    } else if (daysToCap <= 730) {
      overlayInsights.push({
        id: "cap-unprotected",
        title: "H-1B 6-year cap vs. Green Card filing deadline",
        body: `Your 6-year H-1B cap is ${formatDateLabel(capDate)} (${Math.max(0, Math.round(daysToCap / 30))} months away) and I-140 is not yet approved. To extend H-1B past year 6, PERM or I-140 generally must be filed at least 365 days before cap-out.`,
        tone: "blush"
      });
    }
  }

  if (visaExpiryDate && daysUntilExpiry !== null && daysUntilExpiry <= 180 && daysUntilExpiry >= 0) {
    overlayInsights.push({
      id: "renewal-overlap",
      title: "Visa renewal window is open now",
      body: `Your ${profile.visaType} expires on ${formatDateLabel(visaExpiryDate)} (${daysUntilExpiry} days left), which is inside the 6-month renewal filing window. Confirm extension prep with ${employerName ?? "your sponsor"} and your law firm.`,
      tone: daysUntilExpiry <= 45 ? "blush" : "sky"
    });
  }

  if (overlayInsights.length === 0) {
    overlayInsights.push({
      id: "steady-alignment",
      title: "How your Visa, Job, and Green Card tracks align",
      body: profile.i140Approved
        ? `Your ${profile.visaType} status, employment with ${employerName ?? "your sponsor"}, and approved I-140 are aligned. Keep monitoring monthly Visa Bulletin movement for ${categoryLabel}.`
        : `Your ${profile.visaType} and employment tracks are active. Advancing from ${STAGE_BADGE_LABELS[gcStage]} to an approved I-140 is the key milestone that locks in your priority date and long-term visa extensions.`,
      tone: "sky"
    });
  }

  const missingFields: string[] = [];
  if (!visaStartDate && profile.visaType === "H1B") missingFields.push("H-1B start date");
  if (!visaExpiryDate && profile.visaType !== "GC" && profile.visaType !== "Citizen") {
    missingFields.push("Current visa expiry date");
  }
  if (!employerName && isWorkVisa) missingFields.push("Employer name");
  if (!priorityDate && stageRank >= 1) missingFields.push("Priority date");

  return {
    axis: {
      startIso: toIsoDate(new Date(paddedStartMs)),
      endIso: toIsoDate(new Date(paddedEndMs)),
      startLabel: formatMonthYear(new Date(paddedStartMs)),
      endLabel: formatMonthYear(new Date(paddedEndMs)),
      todayIso: toIsoDate(todayUtc),
      todayLabel: formatDateLabel(todayUtc)!,
      todayPercent,
      ticks
    },
    visaTrack: {
      visaType: profile.visaType,
      lifecycleState: visaLifecycle,
      statusBadge: visaBadge,
      statusTone: visaTone,
      headline: visaHeadline,
      summary: visaSummary,
      startDate: visaStartDate ? toIsoDate(visaStartDate) : null,
      startDateLabel: formatDateLabel(visaStartDate),
      expiryDate: visaExpiryDate ? toIsoDate(visaExpiryDate) : null,
      expiryDateLabel: formatDateLabel(visaExpiryDate),
      daysUntilExpiry,
      capDate: capDate ? toIsoDate(capDate) : null,
      capDateLabel: formatDateLabel(capDate),
      renewalWindowDateLabel,
      segments: visaSegments,
      pins: visaPins
    },
    jobTrack: {
      isWorkVisa,
      employerName,
      jobTitle,
      employerSize: profile.employerSize ?? null,
      lifecycleState: jobLifecycle,
      statusBadge: jobBadge,
      statusTone: jobTone,
      headline: jobHeadline,
      summary: jobSummary,
      lastWorkDayLabel: formatDateLabel(lastWorkDayDate),
      graceEndLabel: formatDateLabel(graceEndDate),
      graceDaysRemaining,
      portabilityLabel,
      segments: jobSegments,
      pins: jobPins
    },
    greenCardTrack: {
      stage: gcStage,
      categoryLabel,
      statusBadge: gcStatusBadge,
      statusTone: gcStatusTone,
      headline: gcHeadline,
      summary: gcSummary,
      priorityDate: priorityDate ? toIsoDate(priorityDate) : null,
      priorityDateLabel: formatDateLabel(priorityDate),
      estimatedRangeLabel,
      bulletinCutoffLabel,
      nodes: gcNodes,
      segments: gcSegments,
      pins: gcPins
    },
    overlayInsights,
    missingFields
  };
}

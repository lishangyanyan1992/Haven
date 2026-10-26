import type { DeadlineAnswers } from "@/lib/deadlines";
import type {
  ActiveLayoffEvent,
  DerivedProfileSignals,
  GreenCardStage,
  ImmigrationProfile,
  ImmigrantPetition,
  ImmigrantPetitionStage,
  ImmigrantPetitionType,
  PreferenceCategory,
  PriorityDateIntelligence
} from "@/types/domain";
import { isPetitionWithdrawn } from "@/types/domain";

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
  effectiveStayEndDate?: string | null;
  effectiveStayEndLabel?: string | null;
  effectiveStayDaysRemaining?: number | null;
  isGraceCappedByVisa?: boolean;
  reconciliationNotice?: string | null;
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
  effectiveStayEndDate?: string | null;
  effectiveStayEndLabel?: string | null;
  effectiveStayDaysRemaining?: number | null;
  isGraceCappedByVisa?: boolean;
  reconciliationNotice?: string | null;
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

export type ImmigrantPetitionSummary = {
  id: string;
  sponsorName: string;
  petitionType: ImmigrantPetitionType;
  preferenceCategory: PreferenceCategory;
  stage: ImmigrantPetitionStage;
  stageLabel: string;
  priorityDateLabel: string | null;
  isApproved: boolean;
  isRevocationProtected: boolean;
  isRecaptured?: boolean;
  isPrimaryActive?: boolean;
  notes?: string;
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
  retainedPriorityDate?: string | null;
  retainedPriorityDateLabel?: string | null;
  retainedSponsorName?: string | null;
  isPriorityDateRecaptured?: boolean;
  activePetitionSponsor?: string | null;
  activePetitionStageLabel?: string | null;
  petitions?: ImmigrantPetitionSummary[];
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

export type TacticalTimelinePin = {
  id: string;
  label: string;
  dateLabel: string;
  isoDate: string;
  percent: number;
  tone: JourneyTrackTone;
  status: "past" | "upcoming" | "urgent";
  detail: string;
  daysDiff: number;
  isToday?: boolean;
};

export type TacticalTimelineView = {
  startIso: string;
  endIso: string;
  startLabel: string;
  endLabel: string;
  todayPercent: number;
  pins: TacticalTimelinePin[];
  ticks: { label: string; percent: number }[];
};

export type JourneyProtectionStatus = {
  isAc21PortabilityUnlocked: boolean;
  hasI140Approval: boolean;
  isRevocationProtected?: boolean;
  isGraceCappedByVisa: boolean;
  protectingSponsor?: string | null;
  retainedPriorityDate?: string | null;
  effectiveStayEndDate: string | null;
  effectiveStayEndLabel: string | null;
  effectiveStayDaysRemaining: number | null;
  urgentDeadlineDaysRemaining: number | null;
  urgentDeadlineLabel: string | null;
  reconciliationNotice: string | null;
  portabilitySummary: string | null;
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
    macroBracket: {
      startPercent: number;
      endPercent: number;
      label: string;
    };
  };
  tacticalWindow: TacticalTimelineView;
  protection: JourneyProtectionStatus;
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

export function findActivePetition(profile: ImmigrationProfile): ImmigrantPetition | null {
  if (!profile.immigrantPetitions || profile.immigrantPetitions.length === 0) {
    return null;
  }
  const nonWithdrawn = profile.immigrantPetitions.filter(p => !isPetitionWithdrawn(p));
  if (nonWithdrawn.length === 0) return null;

  const isEmployerType = (type: string) =>
    type === "employer_sponsored" || type === "concurrent_employer";

  if (profile.employerName) {
    const empLower = profile.employerName.trim().toLowerCase();
    const currentEmployerPetition = nonWithdrawn.find(
      p => isEmployerType(p.petitionType) && p.sponsorName?.trim().toLowerCase() === empLower
    );
    if (currentEmployerPetition) return currentEmployerPetition;
  }

  const inProgressEmployer = nonWithdrawn.find(
    p => isEmployerType(p.petitionType) && p.stage !== "i140_approved" && p.stage !== "i485_approved"
  );
  if (inProgressEmployer) return inProgressEmployer;

  const anyEmployer = nonWithdrawn.find(p => isEmployerType(p.petitionType));
  if (anyEmployer) return anyEmployer;

  return nonWithdrawn[0];
}

export function inferProfileGreenCardStage(profile: ImmigrationProfile): GreenCardStage {
  if (profile.i485Filed) return "i485_filed";

  const activePetition = findActivePetition(profile);
  if (activePetition) {
    if (activePetition.stage === "i485_filed" || activePetition.stage === "i485_approved") return "i485_filed";
    if (activePetition.stage === "i140_approved") return "i140_approved";
    if (activePetition.stage === "i140_filed") return "i140_filed";
    if (activePetition.stage === "perm_certified") return "perm_certified";
    if (activePetition.stage === "perm_in_progress" || activePetition.stage === "pwd_recruitment") return "perm_in_progress";
  }

  if (profile.i140Approved) return "i140_approved";
  if (profile.i140Filed) return "i140_filed";
  if (profile.permStage === "certified") return "perm_certified";
  if (profile.permStage === "in_progress") return "perm_in_progress";
  return "not_started";
}

export function resolveEffectivePriorityDate(profile: ImmigrationProfile): {
  effectiveDate: Date | null;
  isRetained: boolean;
  retainedSponsorName: string | null;
  retainedCategory: PreferenceCategory | null;
  isRecaptured: boolean;
} {
  // 1. Explicit retainedPriorityDate
  if (profile.retainedPriorityDate) {
    const parsed = parseIsoDate(profile.retainedPriorityDate);
    if (parsed) {
      const hasRecaptured = profile.immigrantPetitions?.some(
        p => p.isPriorityDateRecaptured || p.stage === "i140_approved"
      ) ?? false;
      return {
        effectiveDate: parsed,
        isRetained: true,
        retainedSponsorName: profile.retainedPriorityDateSponsor ?? null,
        retainedCategory: profile.retainedPriorityDateCategory ?? profile.preferenceCategory,
        isRecaptured: hasRecaptured
      };
    }
  }

  // 2. Search immigrantPetitions for approved I-140 petitions
  if (profile.immigrantPetitions && profile.immigrantPetitions.length > 0) {
    const activePetition = findActivePetition(profile);
    const approvedPetitions = profile.immigrantPetitions.filter(
      p =>
        (p.stage === "i140_approved" || p.stage === "i485_filed" || p.stage === "i485_approved") &&
        !isPetitionWithdrawn(p) &&
        p.priorityDate
    );
    if (approvedPetitions.length > 0) {
      approvedPetitions.sort((a, b) => {
        const dateA = parseIsoDate(a.priorityDate)?.getTime() ?? Infinity;
        const dateB = parseIsoDate(b.priorityDate)?.getTime() ?? Infinity;
        return dateA - dateB;
      });
      const earliestApproved = approvedPetitions[0];
      const parsed = parseIsoDate(earliestApproved.priorityDate);
      if (parsed) {
        const activeSponsor = activePetition?.sponsorName ?? profile.employerName;
        const isFromPriorSponsor = Boolean(
          earliestApproved.petitionType === "employer_sponsored" &&
          activeSponsor &&
          earliestApproved.sponsorName &&
          earliestApproved.sponsorName.trim().toLowerCase() !== activeSponsor.trim().toLowerCase()
        );
        return {
          effectiveDate: parsed,
          isRetained: isFromPriorSponsor,
          retainedSponsorName: isFromPriorSponsor ? earliestApproved.sponsorName : null,
          retainedCategory: earliestApproved.preferenceCategory,
          isRecaptured: earliestApproved.isPriorityDateRecaptured ?? false
        };
      }
    }
  }

  // 3. Legacy profile.priorityDate
  if (profile.priorityDate) {
    const parsed = parseIsoDate(profile.priorityDate);
    if (parsed) {
      return {
        effectiveDate: parsed,
        isRetained: Boolean(profile.retainedPriorityDateSponsor),
        retainedSponsorName: profile.retainedPriorityDateSponsor ?? null,
        retainedCategory: profile.preferenceCategory,
        isRecaptured: false
      };
    }
  }

  // 4. Pending active petition date
  if (profile.immigrantPetitions && profile.immigrantPetitions.length > 0) {
    const activePetition = findActivePetition(profile);
    const pendingWithDate =
      activePetition && (activePetition.priorityDate || activePetition.permFilingDate)
        ? activePetition
        : null;
    if (pendingWithDate) {
      const parsed = parseIsoDate(pendingWithDate.priorityDate || pendingWithDate.permFilingDate);
      if (parsed) {
        return {
          effectiveDate: parsed,
          isRetained: false,
          retainedSponsorName: null,
          retainedCategory: pendingWithDate.preferenceCategory,
          isRecaptured: false
        };
      }
    }
  }

  // 5. Fallback to permFilingDate
  if (profile.permFilingDate) {
    const parsed = parseIsoDate(profile.permFilingDate);
    return {
      effectiveDate: parsed,
      isRetained: false,
      retainedSponsorName: null,
      retainedCategory: profile.preferenceCategory,
      isRecaptured: false
    };
  }

  return {
    effectiveDate: null,
    isRetained: false,
    retainedSponsorName: null,
    retainedCategory: null,
    isRecaptured: false
  };
}

export function evaluateI140Protections(
  profile: ImmigrationProfile,
  nowUtc: Date
): {
  hasApprovedI140: boolean;
  isAc21PortabilityUnlocked: boolean;
  isRevocationProtected: boolean;
  protectingSponsor: string | null;
  i140ApprovalDate: Date | null;
  portabilitySummary: string | null;
} {
  const nowMs = nowUtc.getTime();

  if (profile.immigrantPetitions && profile.immigrantPetitions.length > 0) {
    const qualifyingPetitions = profile.immigrantPetitions.filter(
      p =>
        (p.stage === "i140_approved" || p.stage === "i485_filed" || p.stage === "i485_approved") &&
        !isPetitionWithdrawn(p)
    );

    if (qualifyingPetitions.length > 0) {
      const isUnlocked = (p: (typeof qualifyingPetitions)[number]) => {
        if (p.isRevocationProtected) return true;
        const d = parseIsoDate(p.i140ApprovalDate);
        return Boolean(d && d.getTime() + 180 * DAY_MS <= nowMs);
      };
      const byApprovalDate = [...qualifyingPetitions].sort(
        (a, b) =>
          (parseIsoDate(a.i140ApprovalDate)?.getTime() ?? Infinity) -
          (parseIsoDate(b.i140ApprovalDate)?.getTime() ?? Infinity)
      );
      const protectedPetition =
        qualifyingPetitions.find(p => p.isRevocationProtected) ??
        byApprovalDate.find(isUnlocked) ??
        byApprovalDate[0];
      const approvalDate = parseIsoDate(protectedPetition.i140ApprovalDate);
      const sponsor = protectedPetition.sponsorName || profile.retainedPriorityDateSponsor || "prior sponsor";

      let isRevocationProtected = false;
      let summary = "";

      if (protectedPetition.isRevocationProtected) {
        isRevocationProtected = true;
        summary = `Approved Form I-140 with ${sponsor} passed the 180-day portability mark under 8 CFR § 205.1. Your priority date is permanent, and AC21 3-year H-1B extensions are unlocked.`;
      } else if (approvalDate) {
        const lockInDate = new Date(approvalDate.getTime() + 180 * DAY_MS);
        isRevocationProtected = lockInDate.getTime() <= nowMs;
        summary = isRevocationProtected
          ? `Form I-140 approval with ${sponsor} reached 180-day mark on ${formatDateLabel(lockInDate)}. Your priority date is permanently protected, and AC21 3-year H-1B extensions are unlocked with any employer.`
          : `Form I-140 approval with ${sponsor} unlocks AC21 3-year extensions. Revocation protection under 8 CFR § 205.1 locks in on ${formatDateLabel(lockInDate)}.`;
      } else {
        isRevocationProtected = false;
        summary = `Approved Form I-140 on file with ${sponsor} preserves priority date retention and unlocks AC21 3-year extensions beyond the 6-year H-1B limit.`;
      }

      return {
        hasApprovedI140: true,
        isAc21PortabilityUnlocked: true,
        isRevocationProtected,
        protectingSponsor: sponsor,
        i140ApprovalDate: approvalDate,
        portabilitySummary: summary
      };
    }
  }

  if (profile.retainedPriorityDate) {
    const sponsor = profile.retainedPriorityDateSponsor ?? "prior sponsor";
    return {
      hasApprovedI140: true,
      isAc21PortabilityUnlocked: true,
      isRevocationProtected: false,
      protectingSponsor: sponsor,
      i140ApprovalDate: null,
      portabilitySummary: `Retained priority date from ${sponsor} confirms an approved Form I-140, preserving your queue position and unlocking AC21 3-year extensions.`
    };
  }

  if (profile.i140Approved) {
    const approvalDate = parseIsoDate(profile.i140ApprovalDate ?? null);
    if (approvalDate) {
      const lockInDate = new Date(approvalDate.getTime() + 180 * DAY_MS);
      const isRevocationProtected = lockInDate.getTime() <= nowMs;
      return {
        hasApprovedI140: true,
        isAc21PortabilityUnlocked: true,
        isRevocationProtected,
        protectingSponsor: profile.employerName ?? null,
        i140ApprovalDate: approvalDate,
        portabilitySummary: isRevocationProtected
          ? `I-140 approval reached the 180-day portability mark on ${formatDateLabel(lockInDate)}. Your priority date is permanently protected, and a new sponsor can file an H-1B transfer with AC21 3-year extensions.`
          : `I-140 approval unlocks AC21 3-year extensions. Revocation protection under 8 CFR § 205.1 locks in on ${formatDateLabel(lockInDate)}.`
      };
    }
    return {
      hasApprovedI140: true,
      isAc21PortabilityUnlocked: true,
      isRevocationProtected: false,
      protectingSponsor: profile.employerName ?? null,
      i140ApprovalDate: null,
      portabilitySummary:
        "Approved I-140 on file protects priority date retention and unlocks AC21 extensions beyond the 6-year limit."
    };
  }

  return {
    hasApprovedI140: false,
    isAc21PortabilityUnlocked: false,
    isRevocationProtected: false,
    protectingSponsor: null,
    i140ApprovalDate: null,
    portabilitySummary: null
  };
}

export function synthesizePetitions(
  profile: ImmigrationProfile,
  nowUtc: Date = new Date()
): ImmigrantPetitionSummary[] {
  if (profile.immigrantPetitions && profile.immigrantPetitions.length > 0) {
    const activePetition = findActivePetition(profile);
    const nowMs = nowUtc.getTime();

    return profile.immigrantPetitions.map(p => {
      const isApproved = p.stage === "i140_approved" || p.stage === "i485_filed" || p.stage === "i485_approved";
      let isProtected = Boolean(p.isRevocationProtected);
      if (!isProtected && isApproved && p.i140ApprovalDate) {
        const approvalDate = parseIsoDate(p.i140ApprovalDate);
        if (approvalDate && approvalDate.getTime() + 180 * DAY_MS <= nowMs) {
          isProtected = true;
        }
      }

      const stageLabel =
        p.stage === "pwd_recruitment"
          ? "Prevailing Wage & Recruitment"
          : p.stage === "perm_in_progress"
            ? "PERM In Progress"
            : p.stage === "perm_certified"
              ? "PERM Certified"
              : p.stage === "i140_filed"
                ? "I-140 Filed (Pending)"
                : p.stage === "i140_approved"
                  ? "I-140 Approved"
                  : p.stage === "i485_filed"
                    ? "I-485 Filed (Adjustment of Status)"
                    : p.stage === "i485_approved"
                      ? "I-485 Approved (Green Card Issued)"
                      : "Withdrawn";

      const isEmployer =
        p.petitionType === "employer_sponsored" || p.petitionType === "concurrent_employer";
      const isPrimaryActive = activePetition
        ? p.id === activePetition.id
        : isEmployer && !isPetitionWithdrawn(p);

      return {
        id: p.id,
        sponsorName: p.sponsorName,
        petitionType: p.petitionType,
        preferenceCategory: p.preferenceCategory,
        stage: p.stage,
        stageLabel,
        priorityDateLabel: formatDateLabel(p.priorityDate),
        isApproved,
        isRevocationProtected: Boolean(isProtected),
        isRecaptured: p.isPriorityDateRecaptured,
        isPrimaryActive,
        notes: p.notes
      };
    });
  }

  const summaries: ImmigrantPetitionSummary[] = [];

  if (profile.retainedPriorityDateSponsor || profile.retainedPriorityDate) {
    summaries.push({
      id: "prior-retained-i140",
      sponsorName: profile.retainedPriorityDateSponsor ?? "Prior Sponsoring Employer",
      petitionType: "employer_sponsored",
      preferenceCategory: profile.retainedPriorityDateCategory ?? profile.preferenceCategory,
      stage: "i140_approved",
      stageLabel: "I-140 Approved (Retained)",
      priorityDateLabel: formatDateLabel(profile.retainedPriorityDate ?? profile.priorityDate),
      isApproved: true,
      isRevocationProtected: false,
      isRecaptured: true,
      isPrimaryActive: false,
      notes: "Priority date locked in under 8 CFR § 204.5(e) and portable to subsequent employers."
    });
  }

  const hasStartedGreenCard =
    (profile.permStage && profile.permStage !== "not_started") ||
    profile.i140Filed ||
    profile.i140Approved ||
    profile.i485Filed;

  if (hasStartedGreenCard) {
    const activeStage: ImmigrantPetitionStage = profile.i485Filed
      ? "i485_filed"
      : profile.i140Approved
        ? "i140_approved"
        : profile.i140Filed
          ? "i140_filed"
          : profile.permStage === "certified"
            ? "perm_certified"
            : profile.permStage === "in_progress"
              ? "perm_in_progress"
              : "pwd_recruitment";

    const stageLabel =
      activeStage === "pwd_recruitment"
        ? "Prevailing Wage & Recruitment"
        : activeStage === "perm_in_progress"
          ? "PERM In Progress"
          : activeStage === "perm_certified"
            ? "PERM Certified"
            : activeStage === "i140_filed"
              ? (profile.retainedPriorityDate ? "I-140 Filed (Recapture Requested)" : "I-140 Filed (Pending)")
              : activeStage === "i140_approved"
                ? "I-140 Approved"
                : "I-485 Filed";

    const approvalDate = parseIsoDate(profile.i140ApprovalDate ?? null);
    const isRevocationProtected = activeStage === "i140_approved" && Boolean(
      approvalDate && approvalDate.getTime() + 180 * DAY_MS <= nowUtc.getTime()
    );

    summaries.push({
      id: "current-active-petition",
      sponsorName: profile.employerName ?? "Current Sponsoring Employer",
      petitionType: "employer_sponsored",
      preferenceCategory: profile.preferenceCategory,
      stage: activeStage,
      stageLabel,
      priorityDateLabel: formatDateLabel(profile.priorityDate),
      isApproved: activeStage === "i140_approved" || activeStage === "i485_filed",
      isRevocationProtected,
      isRecaptured: Boolean(profile.retainedPriorityDate && (profile.i140Filed || profile.i140Approved || profile.i485Filed)),
      isPrimaryActive: true,
      notes: profile.retainedPriorityDate
        ? `Recaptures prior priority date (${formatDateLabel(profile.retainedPriorityDate)}) upon I-140 approval.`
        : undefined
    });
  }

  return summaries;
}

function estimateFutureGcDate(
  profile: ImmigrationProfile,
  intelligence: PriorityDateIntelligence | null,
  today: Date,
  effectivePriorityDate?: Date | null
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
  const pd = effectivePriorityDate ?? (profile.priorityDate ? parseIsoDate(profile.priorityDate) : null);
  if (pd) {
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

  const i140Protections = evaluateI140Protections(profile, todayUtc);
  const hasI140Approval = i140Protections.hasApprovedI140;
  const isAc21PortabilityUnlocked = i140Protections.isAc21PortabilityUnlocked;
  const isRevocationProtected = i140Protections.isRevocationProtected;
  const portabilitySummary = i140Protections.portabilitySummary;
  const protectingSponsor = i140Protections.protectingSponsor;
  const effectiveI140ApprovalDate = i140Protections.i140ApprovalDate;

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

  const pdResolution = resolveEffectivePriorityDate(profile);
  const priorityDate = pdResolution.effectiveDate;
  const isRetainedPriorityDate = pdResolution.isRetained;
  const retainedSponsorName = pdResolution.retainedSponsorName;
  const isPriorityDateRecaptured = pdResolution.isRecaptured;
  const petitions = synthesizePetitions(profile, todayUtc);

  const permFilingDate = parseIsoDate(profile.permFilingDate ?? null);

  const lastWorkDayRaw = activeLayoffEvent?.layoffDate || (deadlines.jobEnded === "yes" ? deadlines.lastWorkDay : null) || null;
  const lastWorkDayDate = parseIsoDate(lastWorkDayRaw);
  const isLaidOff =
    Boolean(activeLayoffEvent) ||
    deadlines.jobEnded === "yes" ||
    profile.employmentStatus === "laid_off";
  const graceEndDate = lastWorkDayDate ? new Date(lastWorkDayDate.getTime() + 60 * DAY_MS) : null;
  const hasGracePeriod = Boolean(isLaidOff && graceEndDate);

  // Legal reconciliation under 8 CFR § 214.1(l)(2)
  let effectiveStayEndDate: Date | null = null;
  let isGraceCappedByVisa = false;
  let reconciliationNotice: string | null = null;

  if (hasGracePeriod && graceEndDate && visaExpiryDate) {
    if (visaExpiryDate.getTime() < graceEndDate.getTime()) {
      effectiveStayEndDate = visaExpiryDate;
      isGraceCappedByVisa = true;
      reconciliationNotice =
        "Under 8 CFR § 214.1(l)(2), authorized stay is capped by your I-94 expiration date, which occurs before the full 60-day grace period.";
    } else {
      effectiveStayEndDate = graceEndDate;
      isGraceCappedByVisa = false;
      reconciliationNotice = null;
    }
  } else if (hasGracePeriod && graceEndDate) {
    effectiveStayEndDate = graceEndDate;
    isGraceCappedByVisa = false;
    reconciliationNotice = null;
  } else if (!isLaidOff) {
    effectiveStayEndDate = visaExpiryDate;
    isGraceCappedByVisa = false;
    reconciliationNotice = null;
  } else {
    effectiveStayEndDate = null;
    isGraceCappedByVisa = false;
    reconciliationNotice =
      "Employment ended, but your last day of work is missing. Enter your last day of work to calculate your authorized stay deadline.";
  }

  const effectiveStayDaysRemaining = effectiveStayEndDate
    ? Math.ceil((effectiveStayEndDate.getTime() - todayMs) / DAY_MS)
    : null;
  const effectiveStayEndLabel = formatDateLabel(effectiveStayEndDate);

  const projectedGcDate = estimateFutureGcDate(
    profile,
    priorityDateIntelligence ?? null,
    todayUtc,
    priorityDate
  );

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
  if (effectiveStayEndDate) candidateFutureMs.push(effectiveStayEndDate.getTime() + 60 * DAY_MS);
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
  } else if (hasGracePeriod && effectiveStayEndDate) {
    if (effectiveStayDaysRemaining !== null && effectiveStayDaysRemaining < 0) {
      visaLifecycle = "expired";
      visaBadge = isGraceCappedByVisa
        ? `Stay expired (${Math.abs(effectiveStayDaysRemaining)}d ago)`
        : `Grace expired (${Math.abs(effectiveStayDaysRemaining)}d ago)`;
      visaTone = "blush";
      visaHeadline = isGraceCappedByVisa
        ? `${profile.visaType} authorized stay expired`
        : `${profile.visaType} 60-day grace period expired`;
      visaSummary = isGraceCappedByVisa
        ? `Your I-94 expired on ${effectiveStayEndLabel}, capping your grace period under 8 CFR § 214.1(l)(2). Confirm whether an extension or change of status was filed.`
        : `Your 60-day grace period ended on ${effectiveStayEndLabel}. Confirm timely filing of a transfer, change of status, or departure.`;
    } else if (effectiveStayDaysRemaining !== null && effectiveStayDaysRemaining <= 90) {
      visaLifecycle = "expiring_soon";
      visaBadge = isGraceCappedByVisa
        ? `Grace capped · ${effectiveStayDaysRemaining}d left`
        : `${profile.visaType} grace · ${effectiveStayDaysRemaining}d left`;
      visaTone = effectiveStayDaysRemaining <= 30 ? "blush" : "sand";
      visaHeadline = isGraceCappedByVisa
        ? `${profile.visaType} grace period ends in ${effectiveStayDaysRemaining} day${effectiveStayDaysRemaining === 1 ? "" : "s"}`
        : `${profile.visaType} in grace period (${effectiveStayDaysRemaining}d left)`;
      visaSummary = isGraceCappedByVisa
        ? `Employment ended ${formatDateLabel(lastWorkDayDate)}. Under 8 CFR § 214.1(l)(2), your grace period ends on your I-94 expiration date (${effectiveStayEndLabel}), not the standard 60-day mark.`
        : `Employment ended ${formatDateLabel(lastWorkDayDate)}. While petition was approved through ${formatDateLabel(visaExpiryDate)}, authorized stay is limited to 60 consecutive days ending ${effectiveStayEndLabel}.`;
    } else {
      visaLifecycle = "started_active";
      visaBadge = isGraceCappedByVisa
        ? `Grace capped · ${effectiveStayDaysRemaining}d left`
        : `${profile.visaType} grace · ${effectiveStayDaysRemaining}d left`;
      visaTone = "sand";
      visaHeadline = `${profile.visaType} in grace period through ${effectiveStayEndLabel}`;
      visaSummary = `Authorized stay runs through ${effectiveStayEndLabel}. Coordinate a change of status or new petition before expiration.`;
    }
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
  const effectiveVisaEndMs = hasGracePeriod && effectiveStayEndDate
    ? effectiveStayEndDate.getTime()
    : visaExpiryDate
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
  if (!hasGracePeriod && visaExpiryDate) {
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
  } else if (hasGracePeriod && effectiveStayEndDate) {
    visaPins.push({
      id: "visa-stay-deadline",
      label: isGraceCappedByVisa
        ? effectiveStayDaysRemaining !== null && effectiveStayDaysRemaining < 0
          ? "I-94 expired (grace cap)"
          : "Authorized stay ends (I-94)"
        : "Authorized stay ends (60d grace)",
      dateLabel: effectiveStayEndLabel!,
      isoDate: toIsoDate(effectiveStayEndDate),
      percent: toPercent(effectiveStayEndDate.getTime()),
      tone: "blush",
      status: "urgent",
      detail: isGraceCappedByVisa
        ? "I-94 expiration caps your 60-day grace period under 8 CFR § 214.1(l)(2)."
        : "Authorized stay ends upon expiration of the 60-day grace period."
    });
  }

  if (capDate) {
    visaPins.push({
      id: "visa-cap",
      label: "6-year H-1B max-out",
      dateLabel: formatDateLabel(capDate)!,
      isoDate: toIsoDate(capDate),
      percent: toPercent(capDate.getTime()),
      tone: hasI140Approval ? "sage" : "sand",
      status: capDate.getTime() <= todayMs ? "urgent" : "upcoming",
      detail: hasI140Approval
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
    if (isGraceCappedByVisa && effectiveStayDaysRemaining !== null) {
      jobBadge =
        effectiveStayDaysRemaining >= 0
          ? `Grace capped by I-94 · ${effectiveStayDaysRemaining}d left`
          : `Stay expired (${Math.abs(effectiveStayDaysRemaining)}d ago)`;
      jobHeadline =
        effectiveStayDaysRemaining >= 0
          ? `${effectiveStayDaysRemaining} days left of authorized stay (I-94 cap)`
          : "Authorized stay expired on I-94 expiration date";
      jobSummary = `Employment ended ${formatDateLabel(lastWorkDayDate)}. Full 60-day window would reach ${formatDateLabel(graceEndDate)}, but your I-94 expires ${effectiveStayEndLabel}. File transfer, change of status, or depart before this date.`;
    } else if (graceDaysRemaining !== null) {
      jobBadge =
        graceDaysRemaining >= 0
          ? `60-day grace · ${graceDaysRemaining}d left`
          : `Grace window passed (${Math.abs(graceDaysRemaining)}d ago)`;
      jobHeadline =
        graceDaysRemaining >= 0
          ? `${graceDaysRemaining} days left in 60-day grace period`
          : "60-day grace period window has passed";
      jobSummary = `Employment ended ${formatDateLabel(lastWorkDayDate)}. Bridge window ends ${formatDateLabel(graceEndDate)}.`;
    } else {
      jobBadge = "60-day grace period";
      jobHeadline = "Employment ended in grace period";
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
    const graceTargetDate = effectiveStayEndDate ?? graceEndDate;
    const gracePct = toPercent(graceTargetDate.getTime());
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
      label: isGraceCappedByVisa ? "Grace period (capped by I-94)" : "60-day grace window",
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
      label: isGraceCappedByVisa ? "Authorized stay ends (I-94 cap)" : "60-day grace ends",
      dateLabel: formatDateLabel(graceTargetDate)!,
      isoDate: toIsoDate(graceTargetDate),
      percent: gracePct,
      tone: "blush",
      status: "urgent",
      detail: isGraceCappedByVisa
        ? "Under 8 CFR § 214.1(l)(2), authorized stay ends when your I-94 expires."
        : "File transfer, change of status, or departure before this date."
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
  if (hasI140Approval) {
    if (effectiveI140ApprovalDate) {
      const ac21Date = new Date(effectiveI140ApprovalDate.getTime() + 180 * DAY_MS);
      const isProtected = isRevocationProtected || ac21Date.getTime() <= todayMs;
      portabilityLabel = isProtected
        ? `AC21 portable (unlocked ${formatDateLabel(ac21Date)})`
        : `AC21 extension eligible (180d lock-in ${formatDateLabel(ac21Date)})`;
      jobPins.push({
        id: "job-ac21",
        label: isProtected ? "AC21 portability unlocked" : "AC21 180-day lock-in",
        dateLabel: formatDateLabel(ac21Date)!,
        isoDate: toIsoDate(ac21Date),
        percent: toPercent(ac21Date.getTime()),
        tone: "sage",
        status: isProtected ? "past" : "upcoming",
        detail: "180 days post I-140 approval protects priority date and job portability."
      });
    } else {
      portabilityLabel = `AC21 portable (prior I-140 approved with ${protectingSponsor ?? "prior sponsor"})`;
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
      dateOrMeta: permFilingDate
        ? `Filed ${formatDateLabel(permFilingDate)}`
        : employerName
          ? `With ${employerName}`
          : "Step 1 of sponsorship",
      detail: "Prevailing wage determination, recruitment, and DOL ETA-9089 certification."
    },
    {
      key: "priority_date",
      label: isRetainedPriorityDate ? "Priority Date (Retained)" : "Priority Date Locked",
      shortLabel: "Priority Date",
      status: priorityDate || stageRank >= 2 || isGcComplete ? "completed" : stageRank === 1 ? "current" : "upcoming",
      badgeText: priorityDate
        ? isRetainedPriorityDate
          ? `Retained · ${formatDateLabel(priorityDate)!}`
          : formatDateLabel(priorityDate)!
        : "Not locked yet",
      dateOrMeta: priorityDate
        ? isRetainedPriorityDate
          ? `From ${retainedSponsorName ?? "prior sponsor"} (8 CFR § 204.5(e))`
          : `Queue place: ${categoryLabel}`
        : "Set when PERM or I-140 is filed",
      detail: isRetainedPriorityDate
        ? `Locked-in queue place retained from ${retainedSponsorName ?? "prior sponsor"} and portable to subsequent employers under 8 CFR § 204.5(e).`
        : "Your place in the Visa Bulletin line based on preference category and country of birth."
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
              : isRetainedPriorityDate
                ? "Pending new sponsor"
                : "Upcoming",
      dateOrMeta:
        effectiveI140ApprovalDate && (isGcComplete || stageRank >= 4)
          ? `Approved ${formatDateLabel(effectiveI140ApprovalDate)}`
          : hasI140Approval
            ? isRetainedPriorityDate
              ? `Recapturing at ${employerName ?? "new sponsor"}`
              : "Approved on file"
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

  if (effectiveI140ApprovalDate) {
    gcPins.push({
      id: "gc-i140",
      label: "I-140 approved",
      dateLabel: formatDateLabel(effectiveI140ApprovalDate)!,
      isoDate: toIsoDate(effectiveI140ApprovalDate),
      percent: toPercent(effectiveI140ApprovalDate.getTime()),
      tone: "sage",
      status: "past",
      detail: protectingSponsor ? `Immigrant petition approved (${protectingSponsor}).` : "Immigrant petition approved."
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
    : isRetainedPriorityDate && priorityDate
      ? `${STAGE_BADGE_LABELS[gcStage]} · Recapturing ${formatDateLabel(priorityDate)} PD`
      : `${STAGE_BADGE_LABELS[gcStage]} · ${categoryLabel}`;
  const gcSummary =
    priorityDateIntelligence?.visaBulletinPosition ??
    signals.visaBulletinPosition ??
    (stageRank === 0
      ? "Green card sponsorship has not started yet. Overlay shows how starting PERM/I-140 aligns with your current visa window."
      : `Tracking ${ STAGE_BADGE_LABELS[gcStage].toLowerCase() } in the ${categoryLabel} queue.`);

  // =========================================================================
  // TACTICAL 90-DAY WINDOW METRICS & PINS
  // =========================================================================
  const tacticalStartMs = todayMs - 45 * DAY_MS;
  const tacticalEndMs = todayMs + 45 * DAY_MS;
  const tacticalSpanMs = tacticalEndMs - tacticalStartMs;

  const toTacticalPercent = (ms: number) => {
    const raw = ((ms - tacticalStartMs) / tacticalSpanMs) * 100;
    return Math.round(Math.min(97, Math.max(3, raw)) * 10) / 10;
  };

  const tacticalPins: TacticalTimelinePin[] = [];

  // 1. Today
  tacticalPins.push({
    id: "tactical-today",
    label: "Today",
    dateLabel: formatDateLabel(todayUtc)!,
    isoDate: toIsoDate(todayUtc),
    percent: 50,
    tone: "ink",
    status: "urgent",
    detail: "Current tracking date on your journey.",
    daysDiff: 0,
    isToday: true
  });

  // 2. Last work day
  if (lastWorkDayDate && lastWorkDayDate.getTime() >= tacticalStartMs && lastWorkDayDate.getTime() <= tacticalEndMs) {
    tacticalPins.push({
      id: "tactical-last-day",
      label: "Last day of work",
      dateLabel: formatDateLabel(lastWorkDayDate)!,
      isoDate: toIsoDate(lastWorkDayDate),
      percent: toTacticalPercent(lastWorkDayDate.getTime()),
      tone: "blush",
      status: "past",
      detail: `Employment with ${employerName ?? "sponsor"} ended.`,
      daysDiff: Math.round((lastWorkDayDate.getTime() - todayMs) / DAY_MS)
    });
  }

  // 3. Effective stay end date
  if (effectiveStayEndDate && effectiveStayEndDate.getTime() >= tacticalStartMs && effectiveStayEndDate.getTime() <= tacticalEndMs) {
    const isPast = effectiveStayEndDate.getTime() < todayMs;
    tacticalPins.push({
      id: "tactical-stay-end",
      label: hasGracePeriod
        ? isGraceCappedByVisa
          ? "Stay ends (I-94 cap)"
          : "60-day grace ends"
        : "Visa expires",
      dateLabel: effectiveStayEndLabel!,
      isoDate: toIsoDate(effectiveStayEndDate),
      percent: toTacticalPercent(effectiveStayEndDate.getTime()),
      tone: "blush",
      status: isPast ? "past" : "urgent",
      detail: hasGracePeriod
        ? isGraceCappedByVisa
          ? "I-94 expiration caps authorized stay under 8 CFR § 214.1(l)(2)."
          : "60-day grace period expires."
        : "Current visa status expiration date.",
      daysDiff: Math.round((effectiveStayEndDate.getTime() - todayMs) / DAY_MS)
    });
  }

  // 4. Agency deadline if in window
  if (deadlines.agencyDeadlineDate && deadlines.agencyDeadlineType) {
    const agencyDate = parseIsoDate(deadlines.agencyDeadlineDate);
    if (agencyDate && agencyDate.getTime() >= tacticalStartMs && agencyDate.getTime() <= tacticalEndMs) {
      const typeLabels: Record<string, string> = {
        rfe: "RFE response due",
        interview: "Agency interview",
        biometrics: "Biometrics appointment",
        other: "Agency deadline"
      };
      tacticalPins.push({
        id: "tactical-agency-deadline",
        label: typeLabels[deadlines.agencyDeadlineType] ?? "Agency deadline",
        dateLabel: formatDateLabel(agencyDate)!,
        isoDate: toIsoDate(agencyDate),
        percent: toTacticalPercent(agencyDate.getTime()),
        tone: "blush",
        status: agencyDate.getTime() < todayMs ? "past" : "urgent",
        detail: "Upcoming agency appointment or filing response deadline.",
        daysDiff: Math.round((agencyDate.getTime() - todayMs) / DAY_MS)
      });
    }
  }

  // 5. AC21 180-day milestone if in window
  if (effectiveI140ApprovalDate) {
    const ac21Date = new Date(effectiveI140ApprovalDate.getTime() + 180 * DAY_MS);
    if (ac21Date.getTime() >= tacticalStartMs && ac21Date.getTime() <= tacticalEndMs) {
      tacticalPins.push({
        id: "tactical-ac21",
        label: "AC21 180-day lock-in",
        dateLabel: formatDateLabel(ac21Date)!,
        isoDate: toIsoDate(ac21Date),
        percent: toTacticalPercent(ac21Date.getTime()),
        tone: "sage",
        status: ac21Date.getTime() <= todayMs ? "past" : "upcoming",
        detail: "180 days post I-140 approval locks in priority date retention.",
        daysDiff: Math.round((ac21Date.getTime() - todayMs) / DAY_MS)
      });
    }
  }

  // 6. Renewal window opening date if in window (when not in grace period)
  if (!hasGracePeriod && visaExpiryDate) {
    const renewalDate = new Date(visaExpiryDate.getTime() - 180 * DAY_MS);
    if (renewalDate.getTime() >= tacticalStartMs && renewalDate.getTime() <= tacticalEndMs) {
      tacticalPins.push({
        id: "tactical-renewal-open",
        label: "Renewal window opens",
        dateLabel: formatDateLabel(renewalDate)!,
        isoDate: toIsoDate(renewalDate),
        percent: toTacticalPercent(renewalDate.getTime()),
        tone: "sky",
        status: renewalDate.getTime() <= todayMs ? "past" : "upcoming",
        detail: "Earliest date (6 months prior to expiry) to file an extension.",
        daysDiff: Math.round((renewalDate.getTime() - todayMs) / DAY_MS)
      });
    }
  }

  tacticalPins.sort((a, b) => a.percent - b.percent);

  const tacticalTicks = [
    { label: `${formatMonthYear(new Date(tacticalStartMs))} (–45d)`, percent: 4 },
    { label: "–22d", percent: 27 },
    { label: "Today", percent: 50 },
    { label: "+23d", percent: 73 },
    { label: `${formatMonthYear(new Date(tacticalEndMs))} (+45d)`, percent: 96 }
  ];

  const tacticalWindow: TacticalTimelineView = {
    startIso: toIsoDate(new Date(tacticalStartMs)),
    endIso: toIsoDate(new Date(tacticalEndMs)),
    startLabel: formatDateLabel(new Date(tacticalStartMs))!,
    endLabel: formatDateLabel(new Date(tacticalEndMs))!,
    todayPercent: 50,
    pins: tacticalPins,
    ticks: tacticalTicks
  };

  const macroBracket = {
    startPercent: toPercent(tacticalStartMs),
    endPercent: toPercent(tacticalEndMs),
    label: "90-day focus zone"
  };

  const urgentDeadlineDaysRemaining =
    effectiveStayDaysRemaining !== null
      ? effectiveStayDaysRemaining
      : isLaidOff && daysUntilExpiry !== null
        ? daysUntilExpiry
        : null;

  const urgentDeadlineLabel =
    effectiveStayEndLabel !== null
      ? effectiveStayEndLabel
      : isLaidOff && visaExpiryDate
        ? formatDateLabel(visaExpiryDate)
        : null;

  const protection: JourneyProtectionStatus = {
    isAc21PortabilityUnlocked,
    hasI140Approval,
    isRevocationProtected,
    isGraceCappedByVisa,
    protectingSponsor,
    retainedPriorityDate: isRetainedPriorityDate && priorityDate ? toIsoDate(priorityDate) : null,
    effectiveStayEndDate: effectiveStayEndDate ? toIsoDate(effectiveStayEndDate) : null,
    effectiveStayEndLabel,
    effectiveStayDaysRemaining,
    urgentDeadlineDaysRemaining,
    urgentDeadlineLabel,
    reconciliationNotice,
    portabilitySummary
  };

  // =========================================================================
  // CROSS-TRACK OVERLAY INSIGHTS
  // =========================================================================
  const overlayInsights: OverlayInsight[] = [];

  if (isLaidOff && isGraceCappedByVisa) {
    overlayInsights.push({
      id: "grace-capped-by-i94",
      title: "I-94 caps your 60-day grace period",
      body: `Under 8 CFR § 214.1(l)(2), your authorized stay ends on ${effectiveStayEndLabel} (${effectiveStayDaysRemaining} days remaining) because your I-94 expires before day 60. You must file a change of status, transfer, or depart before this date.`,
      tone: "blush"
    });
  } else if (isLaidOff && graceDaysRemaining !== null) {
    overlayInsights.push({
      id: "grace-vs-gc",
      title: "60-day grace period vs. Green Card portability",
      body: hasI140Approval
        ? `Your employment ended with ${Math.max(0, graceDaysRemaining)} days left in your 60-day grace window, and your approved I-140 preserves your ${formatDateLabel(priorityDate) ?? "priority date"} and unlocks H-1B extensions with a new sponsor.`
        : `Your 60-day grace window has ${Math.max(0, graceDaysRemaining)} days remaining. Because an I-140 is not yet approved, focus first on an H-1B transfer or change of status before ${formatDateLabel(graceEndDate)}.`,
      tone: "blush"
    });
  }

  if (isLaidOff && hasI140Approval) {
    overlayInsights.push({
      id: "ac21-bridge-protection",
      title: "I-140 protects your priority date & extensions",
      body: isRevocationProtected
        ? `Even though employment ended, your approved I-140 passed the 180-day mark, permanently preserving your priority date (${formatDateLabel(priorityDate) ?? "locked"}) and allowing a new employer to sponsor 3-year H-1B extensions beyond the 6-year cap.`
        : `Your approved I-140 preserves your priority date (${formatDateLabel(priorityDate) ?? "locked"}) and allows a new employer to sponsor AC21 3-year extensions. Once 180 days elapse from approval, it cannot be revoked by your prior sponsor.`,
      tone: "sage"
    });
  }

  if (isRetainedPriorityDate && priorityDate) {
    overlayInsights.push({
      id: "retained-pd-recapture",
      title: `Priority date ${formatDateLabel(priorityDate)} locked from ${retainedSponsorName ?? "prior sponsor"}`,
      body: `Under 8 CFR § 204.5(e), your priority date is permanently retained. While ${employerName ?? "your current employer"} completes PERM and files Form I-140, your position in the ${categoryLabel} Visa Bulletin queue remains anchored to ${formatDateLabel(priorityDate)}. Additionally, your prior I-140 unlocks 3-year H-1B extensions under AC21 § 104(c).`,
      tone: "sage"
    });
  }

  if (profile.visaType === "H1B" && capDate) {
    const daysToCap = Math.ceil((capDate.getTime() - todayMs) / DAY_MS);
    if (hasI140Approval) {
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

  if (!isLaidOff && visaExpiryDate && daysUntilExpiry !== null && daysUntilExpiry <= 180 && daysUntilExpiry >= 0) {
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
      body: hasI140Approval
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
      ticks,
      macroBracket
    },
    tacticalWindow,
    protection,
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
      effectiveStayEndDate: effectiveStayEndDate ? toIsoDate(effectiveStayEndDate) : null,
      effectiveStayEndLabel,
      effectiveStayDaysRemaining,
      isGraceCappedByVisa,
      reconciliationNotice,
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
      effectiveStayEndDate: effectiveStayEndDate ? toIsoDate(effectiveStayEndDate) : null,
      effectiveStayEndLabel,
      effectiveStayDaysRemaining,
      isGraceCappedByVisa,
      reconciliationNotice,
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
      retainedPriorityDate: isRetainedPriorityDate && priorityDate ? toIsoDate(priorityDate) : null,
      retainedPriorityDateLabel: isRetainedPriorityDate && priorityDate ? formatDateLabel(priorityDate) : null,
      retainedSponsorName,
      isPriorityDateRecaptured,
      activePetitionSponsor: employerName ?? null,
      activePetitionStageLabel: STAGE_BADGE_LABELS[gcStage],
      petitions,
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

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
import { isPetitionEnded } from "@/types/domain";
import { activePetitions, ENDED_REASON_LABELS, isApprovedStage, providesI140Protection, sponsorMatches, STAGE_ORDER, usesI140, usesPerm } from "@/lib/petitions";
import { firstPetitionForm } from "@/lib/green-card-forms";

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
  daysDiff?: number;
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
  key: "perm" | "priority_date" | "i140" | "bulletin_queue" | "i485" | "petition";
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

export type PetitionTrackStage = {
  /** "petition" is the first petition of a non-I-140 green card (I-130, I-526…). */
  key: "perm" | "priority_date" | "i140" | "bulletin_queue" | "i485" | "petition";
  label: string;
  status: "completed" | "current" | "upcoming" | "stopped";
};

/** One green card (one petition) drawn as its own milestone row. */
export type PetitionTrack = {
  id: string;
  sponsorName: string;
  categoryLabel: string;
  tone: "active" | "protected" | "ended";
  isPrimary: boolean;
  statusLine: string;
  stages: PetitionTrackStage[];
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
  /** One row per green card. Empty when the user has no petition records. */
  tracks: PetitionTrack[];
  /** Who the shown priority date comes from. */
  priorityDateSourceName?: string | null;
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

export type IntakeCapturedField = {
  id: string;
  category: "identity" | "visa" | "employment" | "green_card" | "deadlines";
  label: string;
  value: string;
  sourceLabel: string;
  mapsToTrack: string;
  verifiedByDocument: boolean;
};

export type IntakeMissingItem = {
  id: string;
  category: "document" | "intake_field" | "verification";
  badge: string;
  tone: "blush" | "sand" | "sky";
  title: string;
  detail: string;
  impact: string;
  actionLabel: string;
  actionHref: string;
};

export type ClientRiskWarning = {
  id: string;
  severity: "critical" | "high" | "medium";
  badge: string;
  title: string;
  ruleCitation: string;
  body: string;
  clientGuidance: string;
  actionLabel: string;
  actionHref: string;
};

export type IntakeAuditSummary = {
  completenessPercent: number;
  capturedCount: number;
  missingCount: number;
  warningCount: number;
  criticalWarningCount: number;
  uploadedDocumentCount: number;
  requiredDocumentCount: number;
  fulfilledRequiredDocumentCount: number;
  pendingEmailIngestCount: number;
  capturedFields: IntakeCapturedField[];
  missingItems: IntakeMissingItem[];
  clientWarnings: ClientRiskWarning[];
};

export type JourneyDocumentContext = {
  uploadedDocumentKinds?: string[];
  uploadedDocumentLabels?: string[];
  requiredDocumentKeys?: { key: string; label: string }[];
  /** Counts with sponsor documents asked per sponsor. Used instead of counting keys when given. */
  requiredDocumentCounts?: { requested: number; uploaded: number };
  pendingEmailSubjects?: string[];
  hasBaseVisaExpiryOnProfile?: boolean;
  resumeContext?: {
    phone?: string | null;
    location?: string | null;
    priorEmployers?: string[];
    concurrentRoles?: string[];
  };
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
  intakeAudit: IntakeAuditSummary;
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

export type FocusScaleAnchor = { ms: number; pct: number };

export function projectFocusScalePercent(
  ms: number,
  anchors: FocusScaleAnchor[]
): number {
  if (anchors.length === 0) return 50;
  if (ms <= anchors[0].ms) {
    return Math.max(2, anchors[0].pct);
  }
  const last = anchors[anchors.length - 1];
  if (ms >= last.ms) {
    return Math.min(98, last.pct);
  }

  for (let i = 0; i < anchors.length - 1; i++) {
    const a1 = anchors[i];
    const a2 = anchors[i + 1];
    if (ms >= a1.ms && ms <= a2.ms) {
      const span = a2.ms - a1.ms;
      if (span <= 0) return a1.pct;
      const frac = (ms - a1.ms) / span;
      const raw = a1.pct + frac * (a2.pct - a1.pct);
      return Math.round(Math.min(98, Math.max(2, raw)) * 10) / 10;
    }
  }

  return Math.round(Math.min(98, Math.max(2, last.pct)) * 10) / 10;
}

export function invertPercentToMs(
  targetPct: number,
  anchors: FocusScaleAnchor[]
): number {
  if (anchors.length === 0) return Date.now();
  if (targetPct <= anchors[0].pct) return anchors[0].ms;
  const last = anchors[anchors.length - 1];
  if (targetPct >= last.pct) return last.ms;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a1 = anchors[i];
    const a2 = anchors[i + 1];
    if (targetPct >= a1.pct && targetPct <= a2.pct) {
      const pctSpan = a2.pct - a1.pct;
      if (pctSpan <= 0) return a1.ms;
      const frac = (targetPct - a1.pct) / pctSpan;
      return a1.ms + frac * (a2.ms - a1.ms);
    }
  }
  return last.ms;
}

export function findActivePetition(profile: ImmigrationProfile): ImmigrantPetition | null {
  if (!profile.immigrantPetitions || profile.immigrantPetitions.length === 0) {
    return null;
  }
  // Ended petitions never set the current stage.
  const moving = activePetitions(profile.immigrantPetitions);
  if (moving.length === 0) return null;

  const isEmployerType = (type: string) =>
    type === "employer_sponsored" || type === "concurrent_employer";

  if (profile.employerName && profile.employmentStatus !== "laid_off") {
    const currentEmployerPetition = moving.find(
      p => isEmployerType(p.petitionType) && sponsorMatches(p.sponsorName, profile.employerName)
    );
    if (currentEmployerPetition) return currentEmployerPetition;
  }

  const inProgressEmployer = moving.find(
    p => isEmployerType(p.petitionType) && !isApprovedStage(p.stage)
  );
  if (inProgressEmployer) return inProgressEmployer;

  const anyEmployer = moving.find(p => isEmployerType(p.petitionType));
  if (anyEmployer) return anyEmployer;

  return moving[0];
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
    // Family, investor and other paths keep their own steps (I-130, consular processing…).
    if (["i130_filed", "i130_approved", "consular_processing", "conditional_resident"].includes(activePetition.stage)) {
      return activePetition.stage;
    }
  }

  if (profile.i140Approved) return "i140_approved";
  if (profile.i140Filed) return "i140_filed";
  if (profile.permStage === "certified") return "perm_certified";
  if (profile.permStage === "in_progress") return "perm_in_progress";
  // A step saved in Settings with no green card record (I-130 filed, consular processing…).
  if (profile.greenCardStage && NON_I140_STAGES.has(profile.greenCardStage)) return profile.greenCardStage;
  return "not_started";
}

/** Steps that belong to family, investor, humanitarian and lottery green cards, not PERM or I-140. */
const NON_I140_STAGES = new Set(["i130_filed", "i130_approved", "consular_processing", "conditional_resident"]);

/**
 * Whether a green card goes through I-140 (employer or self-petition). Family,
 * investor, humanitarian and lottery green cards get their own milestones.
 */
function isI140Path(petitionType: string | undefined, stage: string): boolean {
  if (NON_I140_STAGES.has(stage)) return false;
  return usesI140(petitionType);
}

export function resolveEffectivePriorityDate(profile: ImmigrationProfile): {
  effectiveDate: Date | null;
  isRetained: boolean;
  retainedSponsorName: string | null;
  retainedCategory: PreferenceCategory | null;
  isRecaptured: boolean;
  /** Who the effective priority date comes from, whether or not it was retained. */
  sourceSponsorName?: string | null;
} {
  // 1. Earliest priority date among approved I-140s, including ones from
  // jobs that have ended (the date belongs to the person once approved).
  if (profile.immigrantPetitions && profile.immigrantPetitions.length > 0) {
    const activePetition = findActivePetition(profile);
    const approvedPetitions = profile.immigrantPetitions.filter(
      p => providesI140Protection(p) && p.priorityDate
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
        const activeSponsor =
          activePetition?.sponsorName ?? (profile.employmentStatus === "laid_off" ? null : profile.employerName);
        const isFromPriorSponsor = Boolean(
          earliestApproved.petitionType !== "self_petition_niw" &&
          earliestApproved.petitionType !== "self_petition_eb1a" &&
          earliestApproved.sponsorName &&
          (!activeSponsor || !sponsorMatches(earliestApproved.sponsorName, activeSponsor))
        );
        return {
          effectiveDate: parsed,
          isRetained: isFromPriorSponsor,
          retainedSponsorName: isFromPriorSponsor ? earliestApproved.sponsorName : null,
          sourceSponsorName: earliestApproved.sponsorName,
          retainedCategory: earliestApproved.preferenceCategory,
          isRecaptured: Boolean(activePetition && activePetition.id !== earliestApproved.id && activePetition.isPriorityDateRecaptured) ||
            (earliestApproved.isPriorityDateRecaptured ?? false)
        };
      }
    }
  }

  // 2. Retained priority date entered directly
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
        sourceSponsorName: profile.retainedPriorityDateSponsor ?? null,
        retainedCategory: profile.retainedPriorityDateCategory ?? profile.preferenceCategory,
        isRecaptured: hasRecaptured
      };
    }
  }

  // 3. Legacy profile.priorityDate
  if (profile.priorityDate) {
    const parsed = parseIsoDate(profile.priorityDate);
    if (parsed) {
      const isRetained = Boolean(profile.retainedPriorityDate);
      return {
        effectiveDate: parsed,
        isRetained,
        retainedSponsorName: isRetained ? (profile.retainedPriorityDateSponsor ?? null) : null,
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
    const qualifyingPetitions = profile.immigrantPetitions.filter(providesI140Protection);

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
    const isNewPermInProgress = Boolean(
      profile.permStage &&
      profile.permStage !== "not_started" &&
      profile.permStage !== "certified" &&
      !profile.i485Filed
    );
    const protectingSponsor = isNewPermInProgress
      ? (profile.retainedPriorityDateSponsor ?? null)
      : (profile.greenCardSponsor ?? profile.retainedPriorityDateSponsor ?? null);

    const approvalDate = parseIsoDate(profile.i140ApprovalDate ?? null);
    if (approvalDate) {
      const lockInDate = new Date(approvalDate.getTime() + 180 * DAY_MS);
      const isRevocationProtected = lockInDate.getTime() <= nowMs;
      const sponsorSuffix = protectingSponsor ? ` with ${protectingSponsor}` : "";
      return {
        hasApprovedI140: true,
        isAc21PortabilityUnlocked: true,
        isRevocationProtected,
        protectingSponsor,
        i140ApprovalDate: approvalDate,
        portabilitySummary: isRevocationProtected
          ? `I-140 approval${sponsorSuffix} reached the 180-day portability mark on ${formatDateLabel(lockInDate)}. Your priority date is permanently protected, and a new sponsor can file an H-1B transfer with AC21 3-year extensions.`
          : `I-140 approval${sponsorSuffix} unlocks AC21 3-year extensions. Revocation protection under 8 CFR § 205.1 locks in on ${formatDateLabel(lockInDate)}.`
      };
    }
    const sponsorSuffix = protectingSponsor ? ` with ${protectingSponsor}` : "";
    return {
      hasApprovedI140: true,
      isAc21PortabilityUnlocked: true,
      isRevocationProtected: false,
      protectingSponsor,
      i140ApprovalDate: null,
      portabilitySummary:
        `Approved I-140 on file${sponsorSuffix} protects priority date retention and unlocks AC21 extensions beyond the 6-year limit.`
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

const PETITION_TRACK_STAGES: { key: PetitionTrackStage["key"]; label: string }[] = [
  { key: "perm", label: "PERM" },
  { key: "priority_date", label: "Priority date" },
  { key: "i140", label: "I-140" },
  { key: "bulletin_queue", label: "Wait in line" },
  { key: "i485", label: "I-485" }
];

function monthYearLabel(value: string | undefined): string | null {
  const d = parseIsoDate(value ?? null);
  return d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
}

/** Builds one milestone row per green card. Ended ones stop where they ended. */
export function buildPetitionTracks(profile: ImmigrationProfile, nowUtc: Date = new Date()): PetitionTrack[] {
  const list = profile.immigrantPetitions ?? [];
  if (list.length === 0) return [];
  const primary = findActivePetition(profile) ?? list.find(providesI140Protection) ?? list[0];
  const nowMs = nowUtc.getTime();

  const tracks = list.map((p): PetitionTrack => {
    const ended = isPetitionEnded(p);
    const protects = providesI140Protection(p);
    const order = STAGE_ORDER[p.stage];
    const hasOwnPd = Boolean(p.permFilingDate) || order >= STAGE_ORDER.perm_certified;
    const done: Record<string, boolean> = {
      perm: order >= STAGE_ORDER.perm_certified,
      priority_date: hasOwnPd || Boolean(p.isPriorityDateRecaptured && p.priorityDate),
      i140: order >= STAGE_ORDER.i140_approved || (p.stage === "withdrawn" && Boolean(p.i140ApprovalDate)),
      bulletin_queue: order >= STAGE_ORDER.i485_filed,
      i485: p.stage === "i485_approved"
    };
    let currentAssigned = false;
    if (!isI140Path(p.petitionType, p.stage)) {
      // First petition (I-130, I-526…), then the visa queue, then the green card.
      done.petition = order >= STAGE_ORDER.i130_approved;
      done.bulletin_queue = order >= STAGE_ORDER.i485_filed || p.stage === "consular_processing";
      done.i485 = p.stage === "i485_approved" || p.stage === "conditional_resident";
    }
    const trackStages = isI140Path(p.petitionType, p.stage)
      ? usesPerm(p.petitionType)
        ? PETITION_TRACK_STAGES
        : PETITION_TRACK_STAGES.filter((st) => st.key !== "perm")
      : [
          ...(firstPetitionForm(p.petitionType) ? [{ key: "petition" as const, label: firstPetitionForm(p.petitionType)! }] : []),
          { key: "bulletin_queue" as const, label: "Wait in line" },
          { key: "i485" as const, label: "Green card" }
        ];
    const stages = trackStages.map(({ key, label }): PetitionTrackStage => {
      if (done[key]) return { key, label, status: "completed" };
      if (ended) return { key, label, status: "stopped" };
      if (!currentAssigned) {
        currentAssigned = true;
        return { key, label, status: "current" };
      }
      return { key, label, status: "upcoming" };
    });

    const approvalLabel = formatDateLabel(p.i140ApprovalDate ?? null);
    const lockedIn =
      Boolean(p.isRevocationProtected) ||
      Boolean(parseIsoDate(p.i140ApprovalDate ?? null) && parseIsoDate(p.i140ApprovalDate ?? null)!.getTime() + 180 * DAY_MS <= nowMs);
    const endedLabel = p.endedReason ? ENDED_REASON_LABELS[p.endedReason] : "Ended";
    const endedWhen = monthYearLabel(p.endedDate);

    let tone: PetitionTrack["tone"];
    let statusLine: string;
    if (protects) {
      tone = "protected";
      statusLine = `${lockedIn ? "Protected" : "Approved"} · I-140 approved${approvalLabel ? ` ${approvalLabel}` : ""}${
        ended ? ` · ${endedLabel.toLowerCase()}${endedWhen ? `, ${endedWhen}` : ""}, priority date kept` : ""
      }`;
    } else if (ended) {
      tone = "ended";
      statusLine = `${endedLabel}${endedWhen ? `, ${endedWhen}` : ""}`;
    } else {
      tone = "active";
      const current = stages.find((st) => st.status === "current");
      statusLine = current ? `In progress · ${current.label}` : "In progress";
    }

    return {
      id: p.id,
      sponsorName: p.sponsorName,
      categoryLabel: p.preferenceCategory,
      tone,
      isPrimary: p.id === primary.id,
      statusLine,
      stages,
      notes: p.notes
    };
  });

  // Primary first, then active, protected, ended.
  const rank = (t: PetitionTrack) => (t.isPrimary ? 0 : t.tone === "active" ? 1 : t.tone === "protected" ? 2 : 3);
  return tracks.sort((a, b) => rank(a) - rank(b));
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
        : isEmployer && !isPetitionEnded(p);

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

  if (profile.retainedPriorityDate) {
    summaries.push({
      id: "prior-retained-i140",
      sponsorName: profile.retainedPriorityDateSponsor ?? "Prior Sponsoring Employer",
      petitionType: "employer_sponsored",
      preferenceCategory: profile.retainedPriorityDateCategory ?? profile.preferenceCategory,
      stage: "i140_approved",
      stageLabel: "I-140 Approved (Retained)",
      priorityDateLabel: formatDateLabel(profile.retainedPriorityDate),
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
    const isRevocationProtected =
      (activeStage === "i140_approved" || activeStage === "i485_filed") &&
      Boolean(approvalDate && approvalDate.getTime() + 180 * DAY_MS <= nowUtc.getTime());

    summaries.push({
      id: "current-active-petition",
      sponsorName: profile.greenCardSponsor ?? "Unconfirmed Sponsor",
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
  documentContext?: JourneyDocumentContext | null;
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
  const activePetitionForTrack = findActivePetition(profile);
  // The green card track names the green card's sponsor, not whoever employs
  // the user today (they can differ after a layoff or job change).
  const gcSponsorName =
    activePetitionForTrack?.sponsorName ??
    (profile.employmentStatus === "laid_off" ? null : profile.employerName?.trim() || null);

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

  // Focus window around today: -90 days to +180 days (270 days total)
  const focusPastMs = todayMs - 90 * DAY_MS;
  const focusFutureMs = todayMs + 180 * DAY_MS;

  const isMultiYear = (maxEndMs - minStartMs) > 270 * DAY_MS;
  const hasPastEra = isMultiYear && (minStartMs < focusPastMs - 30 * DAY_MS);
  const hasFutureEra = isMultiYear && (maxEndMs > focusFutureMs + 30 * DAY_MS);

  const anchors: FocusScaleAnchor[] = [];
  anchors.push({ ms: minStartMs, pct: 4 });
  if (hasPastEra) {
    anchors.push({ ms: focusPastMs, pct: 28 });
  }
  anchors.push({ ms: todayMs, pct: 50 });
  if (hasFutureEra) {
    anchors.push({ ms: focusFutureMs, pct: 72 });
  }
  anchors.push({ ms: maxEndMs, pct: 96 });

  const toPercent = (ms: number) => projectFocusScalePercent(ms, anchors);

  const todayPercent = toPercent(todayMs);

  // Build 5 clean axis ticks aligned with piecewise boundaries
  const ticks: { label: string; percent: number }[] = [];
  if (anchors.length === 5) {
    ticks.push({
      label: formatMonthYear(new Date(anchors[0].ms)),
      percent: 4
    });
    ticks.push({
      label: formatMonthYear(new Date(anchors[1].ms)),
      percent: 28
    });
    ticks.push({
      label: `${formatMonthYear(todayUtc)} (Today)`,
      percent: 50
    });
    ticks.push({
      label: formatMonthYear(new Date(anchors[3].ms)),
      percent: 72
    });
    ticks.push({
      label: formatMonthYear(new Date(anchors[4].ms)),
      percent: 96
    });
  } else {
    const tickPercents = [4, 27, 50, 73, 96];
    for (const targetPct of tickPercents) {
      const ms = invertPercentToMs(targetPct, anchors);
      const isTodayTick = targetPct === 50;
      ticks.push({
        label: isTodayTick ? `${formatMonthYear(todayUtc)} (Today)` : formatMonthYear(new Date(ms)),
        percent: targetPct
      });
    }
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
      detail: `Initial ${profile.visaType} start date on file.`,
      daysDiff: Math.round((visaStartDate.getTime() - todayMs) / DAY_MS)
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
        detail: "Earliest standard window (6 months before expiry) to file an extension.",
        daysDiff: Math.round((renewalDate.getTime() - todayMs) / DAY_MS)
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
          : "Current status expiration date has passed.",
      daysDiff: daysUntilExpiry ?? Math.round((visaExpiryDate.getTime() - todayMs) / DAY_MS)
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
        : "Authorized stay ends upon expiration of the 60-day grace period.",
      daysDiff: effectiveStayDaysRemaining ?? Math.round((effectiveStayEndDate.getTime() - todayMs) / DAY_MS)
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
        : "6-year statutory H-1B limit unless PERM/I-140 qualifies for AC21 extension.",
      daysDiff: Math.round((capDate.getTime() - todayMs) / DAY_MS)
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
      detail: `Employment with ${employerName ?? "sponsor"} ended.`,
      daysDiff: Math.round((lastWorkDayDate.getTime() - todayMs) / DAY_MS)
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
        : "File transfer, change of status, or departure before this date.",
      daysDiff: effectiveStayDaysRemaining ?? graceDaysRemaining ?? Math.round((graceTargetDate.getTime() - todayMs) / DAY_MS)
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
        detail: "180 days post I-140 approval protects priority date and job portability.",
        daysDiff: Math.round((ac21Date.getTime() - todayMs) / DAY_MS)
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
        detail:
          deadlines.agencyDeadlineType === "interview" && !profile.i485Filed
            ? "Scheduled interview on record, though Form I-485 is marked not filed. Confirm interview notice type with counsel."
            : "Upcoming agency deadline from your case record.",
        daysDiff: Math.round((agencyDate.getTime() - todayMs) / DAY_MS)
      });
    }
  }

  const travelPlannedDate =
    deadlines.travelPlanned === "yes" && deadlines.travelDate
      ? parseIsoDate(deadlines.travelDate)
      : null;

  if (travelPlannedDate) {
    const isTravelRisky =
      isLaidOff ||
      (effectiveStayEndDate !== null && travelPlannedDate.getTime() >= effectiveStayEndDate.getTime()) ||
      (visaExpiryDate !== null && travelPlannedDate.getTime() >= visaExpiryDate.getTime());
    jobPins.push({
      id: "job-travel-planned",
      label: isTravelRisky ? "Planned travel (abandonment / re-entry risk)" : "Planned international travel",
      dateLabel: formatDateLabel(travelPlannedDate)!,
      isoDate: toIsoDate(travelPlannedDate),
      percent: toPercent(travelPlannedDate.getTime()),
      tone: isTravelRisky ? "blush" : "sand",
      status: isTravelRisky ? "urgent" : travelPlannedDate.getTime() < todayMs ? "past" : "upcoming",
      detail: isTravelRisky
        ? "Departing during a grace period or after I-94 expiry ends grace status, abandons pending change-of-status filings (8 CFR § 248.1(b)), and requires a new approved petition and visa stamp to re-enter."
        : "Planned international departure date from your intake.",
      daysDiff: Math.round((travelPlannedDate.getTime() - todayMs) / DAY_MS)
    });
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

  const STAGE_ORDER: Record<string, number> = {
    not_started: 0,
    perm_in_progress: 1,
    perm_certified: 2,
    i140_filed: 3,
    i140_approved: 4,
    i130_filed: 3,
    i130_approved: 4,
    consular_processing: 4,
    i485_filed: 5,
    conditional_resident: 5
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

  const employmentGcNodes: GreenCardStageNode[] = [
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
        : gcSponsorName
          ? `With ${gcSponsorName}`
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
              ? `Recapturing at ${gcSponsorName ?? "new sponsor"}`
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

  // Family, investor, humanitarian and lottery green cards have no PERM or I-140.
  const gcPathType = findActivePetition(profile)?.petitionType ?? profile.greenCardPathway;
  const firstForm = firstPetitionForm(gcPathType ?? "") ?? "Petition";
  const petitionRank = gcStage === "i130_filed" ? 1 : ["i130_approved", "consular_processing", "i485_filed", "conditional_resident", "i485_approved"].includes(gcStage) ? 2 : 0;
  const isConsular = gcStage === "consular_processing";
  const nonI140GcNodes: GreenCardStageNode[] = [
    {
      key: "petition",
      label: firstForm === "Petition" ? "First petition" : `${firstForm} petition`,
      shortLabel: firstForm,
      status: isGcComplete || petitionRank === 2 ? "completed" : petitionRank === 1 ? "current" : "upcoming",
      badgeText: isGcComplete || petitionRank === 2 ? "Approved" : petitionRank === 1 ? "Filed / Pending" : "Not filed",
      dateOrMeta: gcSponsorName ? `Petitioner: ${gcSponsorName}` : "Step 1",
      detail: "The petition that starts this green card, filed with USCIS."
    },
    employmentGcNodes.find((n) => n.key === "priority_date")!,
    {
      ...employmentGcNodes.find((n) => n.key === "bulletin_queue")!,
      status:
        isGcComplete || ["i485_filed", "conditional_resident", "i485_approved"].includes(gcStage) || isConsular || priorityDateIntelligence?.isCurrent
          ? "completed"
          : petitionRank === 2 || Boolean(priorityDate)
            ? "current"
            : "upcoming"
    },
    {
      key: "i485",
      label: isConsular ? "Consular processing / Green card" : "I-485 / Green card",
      shortLabel: "Green card",
      status: isGcComplete || gcStage === "i485_approved" ? "completed" : ["i485_filed", "conditional_resident"].includes(gcStage) || isConsular ? "current" : "upcoming",
      badgeText:
        isGcComplete || gcStage === "i485_approved"
          ? "Approved"
          : gcStage === "conditional_resident"
            ? "Conditional (2-year)"
            : gcStage === "i485_filed" || isConsular
              ? "Pending"
              : "Upcoming",
      dateOrMeta: estimatedRangeLabel ?? "Final step to permanent residency",
      detail: isConsular
        ? "National Visa Center, the consular interview abroad, then entry as a permanent resident."
        : "Adjustment of status: biometrics, interview if scheduled, and the green card decision."
    }
  ];
  const gcNodes = isI140Path(gcPathType, gcStage) ? employmentGcNodes : nonI140GcNodes;

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
      detail: `${categoryLabel} priority date locked.`,
      daysDiff: Math.round((priorityDate.getTime() - todayMs) / DAY_MS)
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
      detail: protectingSponsor ? `Immigrant petition approved (${protectingSponsor}).` : "Immigrant petition approved.",
      daysDiff: Math.round((effectiveI140ApprovalDate.getTime() - todayMs) / DAY_MS)
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
        "Estimated window based on current Visa Bulletin queue position.",
      daysDiff: Math.round((projectedGcDate.getTime() - todayMs) / DAY_MS)
    });
  }

  const STAGE_BADGE_LABELS: Record<string, string> = {
    not_started: "Not started",
    perm_in_progress: "PERM in progress",
    perm_certified: "PERM certified",
    i140_filed: "I-140 filed",
    i140_approved: "I-140 approved",
    i130_filed: "I-130 filed",
    i130_approved: "I-130 approved",
    consular_processing: "Consular processing",
    conditional_resident: "Conditional resident",
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
    startPercent: toPercent(focusPastMs),
    endPercent: toPercent(focusFutureMs),
    label: "Immediate focus zone"
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

  // =========================================================================
  // INTAKE COMPLETENESS, MISSING INFORMATION & CLIENT RISK WARNINGS AUDIT
  // =========================================================================
  const docContext = input.documentContext ?? null;
  const uploadedKinds = new Set(docContext?.uploadedDocumentKinds ?? []);
  const requiredDocs = docContext?.requiredDocumentKeys ?? [
    { key: "passport_biographic_page", label: "Passport biographic page" },
    { key: "i94_record", label: "Most recent I-94" },
    { key: "uscis_notice", label: "I-797 approval / receipt notice" },
    { key: "h1b_petition", label: "H-1B petition packet" }
  ];
  const fulfilledRequiredCount =
    docContext?.requiredDocumentCounts?.uploaded ?? requiredDocs.filter((r) => uploadedKinds.has(r.key)).length;
  const requestedRequiredCount = docContext?.requiredDocumentCounts?.requested ?? requiredDocs.length;
  const uploadedDocumentCount = docContext?.uploadedDocumentKinds?.length ?? 0;
  const pendingEmailSubjects = docContext?.pendingEmailSubjects ?? [];

  const hasI94Doc = uploadedKinds.has("i94_record");
  const hasI797Doc = uploadedKinds.has("uscis_notice") || uploadedKinds.has("h1b_petition");
  const hasI140Doc = uploadedKinds.has("i140_notice");
  const hasPermDoc = uploadedKinds.has("perm_certification");
  const hasPassportDoc = uploadedKinds.has("passport_biographic_page") || uploadedKinds.has("visa_stamp");
  const hasPaystubDoc = uploadedKinds.has("paystub");

  const capturedFields: IntakeCapturedField[] = [];
  if (profile.fullName) {
    capturedFields.push({
      id: "cap-name",
      category: "identity",
      label: "Full Name & Country of Birth",
      value: `${profile.fullName}${profile.countryOfBirth ? ` · Born in ${profile.countryOfBirth}` : ""}`,
      sourceLabel: "Onboarding Step 1 & Auth Profile",
      mapsToTrack: "Case Header & Chargeability Queue",
      verifiedByDocument: hasPassportDoc
    });
  }
  if (docContext?.resumeContext?.phone || docContext?.resumeContext?.location) {
    capturedFields.push({
      id: "cap-contact-resume",
      category: "identity",
      label: "Contact & Location (Extracted from Resume)",
      value: [docContext.resumeContext.phone, docContext.resumeContext.location].filter(Boolean).join(" · "),
      sourceLabel: "Document Vault Resume Extraction",
      mapsToTrack: "Law Firm Client Record & Contact Quick-Actions",
      verifiedByDocument: true
    });
  }
  if (profile.visaType) {
    capturedFields.push({
      id: "cap-visa",
      category: "visa",
      label: "Visa Classification & Initial Start Date",
      value: `${profile.visaType}${visaStartDate ? ` · Started ${formatDateLabel(visaStartDate)}` : ""}${capDate ? ` (6-yr cap ${formatDateLabel(capDate)})` : ""}`,
      sourceLabel: "Onboarding Step 1 & Step 2",
      mapsToTrack: "Track 1 · Visa Validity & 6-Year Statutory Cap",
      verifiedByDocument: hasI797Doc
    });
  }
  if (visaExpiryDate) {
    capturedFields.push({
      id: "cap-expiry",
      category: "visa",
      label: "Current I-94 / Status Expiration Date",
      value: `${formatDateLabel(visaExpiryDate)} (${daysUntilExpiry !== null ? (daysUntilExpiry >= 0 ? `${daysUntilExpiry}d left` : `${Math.abs(daysUntilExpiry)}d ago`) : "tracked"})`,
      sourceLabel: deadlines.statusEndDate ? "Setup Step 5 · Your Deadlines (statusEndDate)" : "Profile Visa Expiry",
      mapsToTrack: "Track 1 & Urgent Stay Window (8 CFR § 214.1(l)(2))",
      verifiedByDocument: hasI94Doc
    });
  }
  if (employerName || jobTitle) {
    capturedFields.push({
      id: "cap-employer",
      category: "employment",
      label: "Most Recent Sponsoring Employer & Role",
      value: `${[jobTitle, employerName].filter(Boolean).join(" @ ")}${profile.employerSize ? ` (${profile.employerSize})` : ""}`,
      sourceLabel: "Onboarding Step 2 & Resume Context",
      mapsToTrack: "Track 1 · Sponsoring Employment Swimlane",
      verifiedByDocument: hasI797Doc || hasPaystubDoc
    });
  }
  if (isLaidOff) {
    capturedFields.push({
      id: "cap-layoff",
      category: "employment",
      label: "Employment Termination & Grace Window",
      value: lastWorkDayDate
        ? `Job ended ${formatDateLabel(lastWorkDayDate)} · 60d ceiling ${formatDateLabel(graceEndDate)}${isGraceCappedByVisa ? ` (Capped by I-94 at ${effectiveStayEndLabel})` : ""}`
        : "Marked laid off (last day of work missing)",
      sourceLabel: "Setup Step 5 (jobEnded / lastWorkDay) & Crisis Mode",
      mapsToTrack: "Track 1 Grace Window, Top Crisis Banner & War Room",
      verifiedByDocument: hasPaystubDoc
    });
  }
  if (profile.preferenceCategory || priorityDate || hasI140Approval) {
    capturedFields.push({
      id: "cap-gc",
      category: "green_card",
      label: "Green Card Category, Priority Date & I-140",
      value: `${categoryLabel}${priorityDate ? ` · PD ${formatDateLabel(priorityDate)}` : ""}${hasI140Approval ? ` · I-140 Approved${effectiveI140ApprovalDate ? ` (${formatDateLabel(effectiveI140ApprovalDate)})` : ""}` : ""}`,
      sourceLabel: "Onboarding Step 3 & Multi-Employer Petition Record",
      mapsToTrack: "Track 2 · Green Card Swimlane, 5-Stage Nodes & AC21 Lock",
      verifiedByDocument: hasI140Doc
    });
  }
  const gcSponsor = profile.greenCardSponsor || profile.retainedPriorityDateSponsor;
  if (gcSponsor) {
    capturedFields.push({
      id: "cap-gc-sponsor",
      category: "green_card",
      label: "Green Card Sponsoring Entity",
      value: gcSponsor,
      sourceLabel: "Settings / Onboarding Step 3",
      mapsToTrack: "Track 2 Sponsoring Petitioner & Priority Date Recapture",
      verifiedByDocument: false
    });
  }
  if (deadlines.agencyDeadlineType && deadlines.agencyDeadlineDate) {
    const agencyParsed = parseIsoDate(deadlines.agencyDeadlineDate);
    capturedFields.push({
      id: "cap-agency",
      category: "deadlines",
      label: "Upcoming USCIS / Consular Deadline",
      value: `${deadlines.agencyDeadlineType.toUpperCase()} on ${formatDateLabel(agencyParsed) ?? deadlines.agencyDeadlineDate}`,
      sourceLabel: "Setup Step 5 · Your Deadlines",
      mapsToTrack: "Track 1 Pin & 90-Day Tactical Ruler",
      verifiedByDocument: false
    });
  }
  if (deadlines.travelPlanned === "yes" && deadlines.travelDate) {
    capturedFields.push({
      id: "cap-travel",
      category: "deadlines",
      label: "Planned International Travel",
      value: `Departure planned ${formatDateLabel(travelPlannedDate) ?? deadlines.travelDate}`,
      sourceLabel: "Setup Step 5 · Your Deadlines",
      mapsToTrack: "Track 1 Travel Pin & Client Travel Risk Warning",
      verifiedByDocument: hasPassportDoc
    });
  }

  const missingItems: IntakeMissingItem[] = [];

  // 1. Missing required / verification documents
  if (docContext !== null) {
    if (!hasI94Doc && profile.visaType !== "GC" && profile.visaType !== "Citizen") {
      missingItems.push({
        id: "missing-doc-i94",
        category: "document",
        badge: "Missing Required Document",
        tone: "blush",
        title: "Most recent Form I-94 arrival/departure record not uploaded",
        detail: visaExpiryDate
          ? `Your intake lists ${formatDateLabel(visaExpiryDate)} as your status end date, which caps your post-layoff grace period. However, no Form I-94 record is in your Document Vault to verify whether ${formatDateLabel(visaExpiryDate)} is your CBP admit-until date or petition end date.`
          : "No Form I-94 is uploaded in your Document Vault to verify your lawful admission and authorized stay expiration.",
        impact: "Blocks attorney verification of your exact 8 CFR § 214.1(l)(2) authorized stay deadline.",
        actionLabel: "Upload I-94 in Vault",
        actionHref: "/documents"
      });
    }

    if (!hasI797Doc && isWorkVisa) {
      const docLabels = docContext.uploadedDocumentLabels ?? [];
      const docLabelsText = docLabels.length > 0 ? ` (${docLabels.join(", ")})` : "";
      missingItems.push({
        id: "missing-doc-i797",
        category: "document",
        badge: "Missing Required Document",
        tone: "blush",
        title: "H-1B Form I-797 approval notice & petition packet not uploaded",
        detail: `Required by your sponsoring law firm checklist. Only ${uploadedDocumentCount} non-notice file${uploadedDocumentCount === 1 ? "" : "s"}${docLabelsText} currently stored in your vault.`,
        impact: `Needed to verify your H-1B validity dates with ${employerName ?? "your sponsoring employer"} and prepare any transfer or change-of-status filing.`,
        actionLabel: "Upload I-797 & H-1B packet",
        actionHref: "/documents"
      });
    }

    if (!hasI140Doc && hasI140Approval) {
      missingItems.push({
        id: "missing-doc-i140",
        category: "document",
        badge: "Missing Crisis-Critical Document",
        tone: "blush",
        title: "Form I-140 Immigrant Petition Approval Notice not uploaded",
        detail: `Your profile records an approved ${profile.preferenceCategory} I-140${effectiveI140ApprovalDate ? ` (${formatDateLabel(effectiveI140ApprovalDate)})` : ""} with a ${formatDateLabel(priorityDate) ?? "locked"} priority date${retainedSponsorName ? ` from ${retainedSponsorName}` : ""}, but the I-140 approval notice is missing from your Document Vault.`,
        impact:
          capDate && capDate.getTime() <= todayMs
            ? `Critical: Because your 6-year H-1B cap (${formatDateLabel(capDate)}) has already passed, a new employer cannot file an AC21 § 104(c) H-1B extension without your I-140 approval notice or receipt number.`
            : "Required to prove priority date retention under 8 CFR § 204.5(e) and unlock post-6th-year H-1B extensions.",
        actionLabel: "Upload I-140 notice",
        actionHref: "/documents"
      });
    } else if (!hasI140Doc && priorityDate) {
      missingItems.push({
        id: "missing-doc-i140",
        category: "document",
        badge: "Missing Required Document",
        tone: "blush",
        title: "Form I-140 receipt notice or petition record not uploaded",
        detail: `Your profile records a ${profile.preferenceCategory} priority date of ${formatDateLabel(priorityDate)}, but the supporting Form I-797 notice is missing from your Document Vault.`,
        impact: "Required to substantiate your priority date under 8 CFR § 204.5(e).",
        actionLabel: "Upload I-140 notice",
        actionHref: "/documents"
      });
    }

    if (!hasPassportDoc) {
      missingItems.push({
        id: "missing-doc-passport",
        category: "document",
        badge: "Missing Required Document",
        tone: "sand",
        title: "Passport biographic page & visa foil stamp not uploaded",
        detail: "Part of the standard 4-document law firm intake checklist and required to check passport validity and visa stamp expiration.",
        impact: travelPlannedDate
          ? `Essential before your planned ${formatDateLabel(travelPlannedDate)} international travel to verify whether consular visa stamping is required for re-entry.`
          : "Required by your law firm before completing the Document Upload milestone.",
        actionLabel: "Upload Passport page",
        actionHref: "/documents"
      });
    }

    if (isLaidOff && !hasPaystubDoc) {
      missingItems.push({
        id: "missing-doc-paystubs",
        category: "document",
        badge: "Missing Proof of Status",
        tone: "sand",
        title: "Recent pay stubs & termination confirmation not uploaded",
        detail: lastWorkDayDate
          ? `Employment with ${employerName ?? "your sponsor"} ended on ${formatDateLabel(lastWorkDayDate)}. USCIS requires recent pay stubs up to ${formatDateLabel(lastWorkDayDate)} to prove maintenance of H-1B status prior to the grace period.`
          : "Recent pay stubs are needed to prove maintenance of status for any H-1B transfer or change of status.",
        impact: "Without pay stubs through your last day of work, USCIS may issue an RFE questioning maintenance of status.",
        actionLabel: "Upload pay stubs",
        actionHref: "/documents"
      });
    }
  }

  // 2. Missing or ambiguous intake / profile fields
  if (hasI140Approval && profile.permStage === "not_started") {
    missingItems.push({
      id: "missing-multi-employer-perm",
      category: "intake_field",
      badge: "Multi-Employer Intake Gap",
      tone: "blush",
      title: `Prior-sponsor I-140 (${formatDateLabel(priorityDate) ?? "PD"}) vs. ${employerName ?? "recent employer"} PERM status`,
      detail: retainedSponsorName
        ? `Your ${formatDateLabel(priorityDate) ?? "EB-2"} priority date originated during your tenure at ${retainedSponsorName}, whereas PERM at ${employerName ?? "your most recent sponsor"} is marked "not_started" and perm_filing_date is blank.`
        : `Your profile marks I-140 as Approved (${formatDateLabel(priorityDate) ?? "PD on file"}), but PERM stage is still set to "not_started" and perm_filing_date is empty.`,
      impact: "Clarify whether your approved I-140 is held by a prior employer (requiring a new PERM + I-140 with priority date recapture at your next sponsor) or your most recent employer.",
      actionLabel: "Verify Green Card stage",
      actionHref: "/settings"
    });
  }

  if (profile.spouseVisaStatus === "other") {
    missingItems.push({
      id: "missing-spouse-status-detail",
      category: "intake_field",
      badge: "Incomplete Intake Field",
      tone: "blush",
      title: "Spouse or partner visa status is set to 'Other' without specific classification",
      detail: "Your intake records spouseVisaStatus as 'other' rather than specifying their exact status (e.g., U.S. Citizen, F-1, O-1, L-1, J-1, TN, or foreign national abroad).",
      impact: isLaidOff
        ? "Critical during a grace period: if your spouse holds an independent work/student visa or U.S. citizenship, filing a dependent change of status (Form I-539) or marriage-based adjustment could immediately protect your authorized stay."
        : "Prevents Haven and your attorney from evaluating dependent visa fallback or cross-chargeability options.",
      actionLabel: "Update spouse status",
      actionHref: "/settings"
    });
  }

  const hasStartedGreenCardStage =
    hasI140Approval ||
    Boolean(priorityDate) ||
    Boolean(profile.i140Filed) ||
    Boolean(profile.i485Filed) ||
    (Boolean(profile.permStage) && profile.permStage !== "not_started");

  if (
    hasStartedGreenCardStage &&
    !profile.greenCardSponsor &&
    !profile.retainedPriorityDateSponsor &&
    (!profile.immigrantPetitions || profile.immigrantPetitions.length === 0)
  ) {
    missingItems.push({
      id: "missing-gc-sponsor-attribution",
      category: "intake_field",
      badge: "Sponsorship Attribution",
      tone: "sand",
      title: "Green card sponsoring company not confirmed",
      detail: `Your profile records a green card case${priorityDate ? ` with priority date ${formatDateLabel(priorityDate)}` : ""}, but does not specify which company sponsored it. Never assume a green card is tied to your current employer (${profile.employerName ?? "Current"}).`,
      impact:
        "Knowing whether this petition was filed by a prior employer, your current employer, or self-petitioned (e.g. EB-2 NIW) determines your priority date retention rights, whether a new PERM is required, and post-6th-year H-1B extension eligibility.",
      actionLabel: "Set sponsor in Settings",
      actionHref: "/settings"
    });
  }

  if (deadlines.agencyDeadlineType === "interview" && deadlines.agencyDeadlineDate && !profile.i485Filed) {
    missingItems.push({
      id: "missing-interview-context",
      category: "verification",
      badge: "Contradictory Intake Data",
      tone: "blush",
      title: `Agency interview recorded for ${formatDateLabel(parseIsoDate(deadlines.agencyDeadlineDate)) ?? deadlines.agencyDeadlineDate}, but Form I-485 is marked 'Not Filed'`,
      detail: `Your deadline intake lists an upcoming agency 'Interview' on ${formatDateLabel(parseIsoDate(deadlines.agencyDeadlineDate)) ?? deadlines.agencyDeadlineDate}, while i485_filed is false and ${categoryLabel} (${formatDateLabel(priorityDate) ?? "PD"}) is not current in the Visa Bulletin.`,
      impact: "An attorney needs to know immediately whether this is a consular visa interview, a marriage/spillover I-485 interview, a B-2/other appointment, or a test entry.",
      actionLabel: "Review deadline details",
      actionHref: "/onboarding?step=5"
    });
  }

  if (docContext?.resumeContext?.concurrentRoles && docContext.resumeContext.concurrentRoles.length > 0) {
    missingItems.push({
      id: "missing-concurrent-role-auth",
      category: "verification",
      badge: "Resume vs. Intake Check",
      tone: "sand",
      title: `Concurrent founder/leadership role on resume (${docContext.resumeContext.concurrentRoles.join(", ")}) not captured in intake`,
      detail: `Your uploaded resume lists ${docContext.resumeContext.concurrentRoles.join(" and ")} overlapping with your H-1B employment timeline, which the standard 1-employer intake form does not capture.`,
      impact: "On H-1B status, active work for a startup or second entity requires a concurrent H-1B or O-1 petition (passive equity ownership is permitted, active unauthorized work is not). Flagged so counsel can review before I-485 filing.",
      actionLabel: "Ask Advisor / Counsel",
      actionHref: "/advisor"
    });
  }

  if (pendingEmailSubjects.length > 0) {
    missingItems.push({
      id: "missing-email-ingest-confirm",
      category: "verification",
      badge: "Pending Email Ingest",
      tone: "sky",
      title: `${pendingEmailSubjects.length} forwarded email${pendingEmailSubjects.length === 1 ? "" : "s"} awaiting confirmation (${pendingEmailSubjects.join(", ")})`,
      detail: `You forwarded "${pendingEmailSubjects[0]}" to your Haven ingest address, but its extracted fields have not been confirmed into your profile yet.`,
      impact: "Confirming or uploading the underlying PERM / USCIS notice keeps your PERM filing date and case timeline synchronized.",
      actionLabel: "Review in Inbox",
      actionHref: "/inbox"
    });
  }

  if (!profile.employerIndustry && isWorkVisa) {
    missingItems.push({
      id: "missing-employer-industry",
      category: "intake_field",
      badge: "Missing Profile Field",
      tone: "sky",
      title: "Employer industry & cap-exempt status not recorded on profile",
      detail: `employer_industry is null on your profile record for ${employerName ?? "your sponsoring employer"}.`,
      impact: "Used to benchmark layoff readiness, prevailing wage tiers, and cap-exempt transfer eligibility.",
      actionLabel: "Complete in Settings",
      actionHref: "/settings"
    });
  }

  for (const field of missingFields) {
    missingItems.push({
      id: `missing-core-${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      category: "intake_field",
      badge: "Missing Core Date",
      tone: "blush",
      title: `${field} is missing`,
      detail: `Add your ${field.toLowerCase()} so Haven can plot your exact timeline bars and statutory deadlines.`,
      impact: "Required for accurate timeline projection.",
      actionLabel: "Add date",
      actionHref: "/dashboard"
    });
  }

  // 3. Client Risk Warnings (How warnings are given to potential clients)
  const clientWarnings: ClientRiskWarning[] = [];

  if (isLaidOff && isGraceCappedByVisa && effectiveStayEndDate && effectiveStayDaysRemaining !== null) {
    const graceEndLabel = formatDateLabel(graceEndDate);
    clientWarnings.push({
      id: "warn-i94-caps-grace",
      severity: "critical",
      badge: effectiveStayDaysRemaining >= 0 ? `Critical · ${effectiveStayDaysRemaining}d left` : `Critical · Expired ${Math.abs(effectiveStayDaysRemaining)}d ago`,
      title: `I-94 expiration (${effectiveStayEndLabel}) cuts short your 60-day grace period`,
      ruleCitation: "8 CFR § 214.1(l)(2)",
      body: `Although 60 days from your ${formatDateLabel(lastWorkDayDate)} last day of work would run until ${graceEndLabel}, federal regulation limits the post-termination grace period to 60 days OR your existing I-94 validity end date (${effectiveStayEndLabel}), whichever is shorter.`,
      clientGuidance:
        `Potential client warning: You do not have until ${graceEndLabel}. To avoid accruing unlawful presence or falling out of status after ${effectiveStayEndLabel}, a non-frivolous H-1B change-of-employer petition (I-129), a bridge Change of Status application (Form I-539, such as B-2 or dependent status), or departure from the U.S. must occur on or before ${effectiveStayEndLabel}.`,
      actionLabel: "Consult attorney immediately",
      actionHref: "/advisor"
    });
  } else if (isLaidOff && graceDaysRemaining !== null && graceDaysRemaining <= 60) {
    clientWarnings.push({
      id: "warn-grace-countdown",
      severity: graceDaysRemaining <= 15 ? "critical" : "high",
      badge: graceDaysRemaining >= 0 ? `Urgent · ${graceDaysRemaining}d left` : "Expired",
      title: `60-day post-termination grace period ends ${formatDateLabel(graceEndDate)}`,
      ruleCitation: "8 CFR § 214.1(l)(2)",
      body: `Employment with ${employerName ?? "your sponsor"} ended on ${formatDateLabel(lastWorkDayDate)}. USCIS must receive a new H-1B transfer petition or Change of Status filing before ${formatDateLabel(graceEndDate)}.`,
      clientGuidance:
        "Potential client warning: Because LCA certification with the Department of Labor takes 7 calendar days before an H-1B transfer can be filed, a new employer must initiate LCA filing at least 10–14 days before your grace period expires.",
      actionLabel: "Open Layoff War Room",
      actionHref: "/planner"
    });
  }

  if (deadlines.agencyDeadlineType && deadlines.agencyDeadlineDate) {
    const agencyParsed = parseIsoDate(deadlines.agencyDeadlineDate);
    if (agencyParsed) {
      const agencyDays = Math.ceil((agencyParsed.getTime() - todayMs) / DAY_MS);
      const isAfterStayEnd = effectiveStayEndDate !== null && agencyParsed.getTime() > effectiveStayEndDate.getTime();
      const diffDays = effectiveStayEndDate
        ? Math.round((agencyParsed.getTime() - effectiveStayEndDate.getTime()) / DAY_MS)
        : null;
      const diffText =
        diffDays !== null
          ? diffDays > 0
            ? `, which is ${diffDays} day${diffDays === 1 ? "" : "s"} after your ${effectiveStayEndLabel ?? "recorded"} status expiration date,`
            : diffDays === 0
              ? `, which coincides with your ${effectiveStayEndLabel ?? "recorded"} status expiration date,`
              : `, which falls before your ${effectiveStayEndLabel ?? "recorded"} status expiration date,`
          : "";

      clientWarnings.push({
        id: "warn-agency-deadline",
        severity: agencyDays <= 14 ? "critical" : "high",
        badge: agencyDays >= 0 ? `Critical · In ${agencyDays}d (${formatDateLabel(agencyParsed)})` : `Passed ${Math.abs(agencyDays)}d ago`,
        title: `Scheduled agency ${deadlines.agencyDeadlineType} on ${formatDateLabel(agencyParsed)}${isAfterStayEnd ? ` falls after your ${effectiveStayEndLabel} status end date` : ""}`,
        ruleCitation: "USCIS Appointment & Status Verification",
        body: !profile.i485Filed && deadlines.agencyDeadlineType === "interview"
          ? `Your intake shows an agency interview on ${formatDateLabel(agencyParsed)}${diffText} while Form I-485 is marked not filed.`
          : `You have a recorded ${deadlines.agencyDeadlineType} deadline on ${formatDateLabel(agencyParsed)}.`,
        clientGuidance:
          "Potential client warning: Never miss a scheduled USCIS or consular interview, and never attend without verifying your underlying status and receipt notice (Form I-797C) with legal counsel first.",
        actionLabel: "Upload notice for counsel",
        actionHref: "/documents"
      });
    }
  }

  if (travelPlannedDate) {
    const travelDays = Math.ceil((travelPlannedDate.getTime() - todayMs) / DAY_MS);
    const isTravelDuringRiskWindow =
      isLaidOff ||
      (effectiveStayEndDate !== null && travelPlannedDate.getTime() >= effectiveStayEndDate.getTime()) ||
      (visaExpiryDate !== null && travelPlannedDate.getTime() >= visaExpiryDate.getTime());

    if (isTravelDuringRiskWindow) {
      clientWarnings.push({
        id: "warn-travel-abandonment",
        severity: "high",
        badge: `High Risk · Travel ${formatDateLabel(travelPlannedDate)} (${travelDays}d)`,
        title: `Planned international travel (${formatDateLabel(travelPlannedDate)}) risks status abandonment & inability to re-enter`,
        ruleCitation: "8 CFR § 248.1(b) & 8 CFR § 214.1(l)(2)",
        body: `You indicated planned international travel on ${formatDateLabel(travelPlannedDate)} while in a post-layoff window with an I-94 expiring ${formatDateLabel(visaExpiryDate) ?? "soon"}.`,
        clientGuidance:
          "Potential client warning: (1) Departing the U.S. immediately terminates any remaining 60-day grace period; (2) Departing while a Form I-539 Change of Status (e.g., to B-2 or H-4) is pending automatically abandons that application; (3) Re-entering in H-1B status requires a new approved Form I-797 from a new employer and an unexpired H-1B visa stamp.",
        actionLabel: "Review travel gate in Ask",
        actionHref: "/advisor"
      });
    }
  }

  if (profile.visaType === "H1B" && capDate && capDate.getTime() <= todayMs) {
    const hasApproval = Boolean(hasI140Approval);

    clientWarnings.push({
      id: "warn-post-6yr-cap-ac21",
      severity: hasApproval && hasI140Doc ? "medium" : "high",
      badge: "AC21 Post-6th-Year Dependency",
      title: hasApproval
        ? `6-year H-1B statutory limit (${formatDateLabel(capDate)}) has passed — extensions require I-140 proof`
        : `6-year H-1B statutory limit (${formatDateLabel(capDate)}) has passed without approved I-140`,
      ruleCitation: "AC21 § 104(c) & 8 CFR § 205.1(a)(3)(iii)(C)",
      body: hasApproval
        ? `With an initial H-1B start date of ${formatDateLabel(visaStartDate)}, your 6-year statutory clock maxed out on ${formatDateLabel(capDate)}. Your eligibility for new H-1B transfers and 3-year extensions depends entirely on your approved ${profile.preferenceCategory} Form I-140 (${formatDateLabel(priorityDate) ?? "PD"})${retainedSponsorName ? ` from ${retainedSponsorName}` : ""}.`
        : `With an initial H-1B start date of ${formatDateLabel(visaStartDate)}, your 6-year statutory clock maxed out on ${formatDateLabel(capDate)}. Under AC21 § 104(c), extensions beyond 6 years require an approved Form I-140 subject to per-country visa backlogs.`,
      clientGuidance: hasApproval
        ? isRevocationProtected
          ? "Potential client warning: Because your I-140 was approved more than 180 days ago, your prior employer cannot revoke your priority date or AC21 extension eligibility. However, any new employer's immigration counsel must include copy/receipt evidence of that approved I-140 with your H-1B transfer filing."
          : "Potential client warning: Your approved I-140 supports post-6-year extensions, but has not yet reached the 180-day mark where it is protected from petitioner withdrawal under 8 CFR § 205.1(a)(3)(iii)(C). Ensure your new petition is filed promptly."
        : "Potential client warning: Without an approved Form I-140 on file, you do not qualify for AC21 § 104(c) 3-year extensions beyond the 6-year limit unless you qualify under AC21 § 106(a) with a PERM or I-140 pending for 365+ days. Review with counsel immediately.",
      actionLabel: hasApproval ? "Upload I-140 approval notice" : "Consult attorney in Ask",
      actionHref: hasApproval ? "/documents" : "/advisor"
    });
  }

  const totalAuditCheckpoints = capturedFields.length + missingItems.length;
  const completenessPercent =
    totalAuditCheckpoints > 0
      ? Math.max(15, Math.min(100, Math.round((capturedFields.length / totalAuditCheckpoints) * 100)))
      : 100;

  const intakeAudit: IntakeAuditSummary = {
    completenessPercent,
    capturedCount: capturedFields.length,
    missingCount: missingItems.length,
    warningCount: clientWarnings.length,
    criticalWarningCount: clientWarnings.filter((w) => w.severity === "critical").length,
    uploadedDocumentCount,
    requiredDocumentCount: requestedRequiredCount,
    fulfilledRequiredDocumentCount: fulfilledRequiredCount,
    pendingEmailIngestCount: pendingEmailSubjects.length,
    capturedFields,
    missingItems,
    clientWarnings
  };

  return {
    axis: {
      startIso: toIsoDate(new Date(minStartMs)),
      endIso: toIsoDate(new Date(maxEndMs)),
      startLabel: formatMonthYear(new Date(minStartMs)),
      endLabel: formatMonthYear(new Date(maxEndMs)),
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
      activePetitionSponsor: gcSponsorName,
      activePetitionStageLabel: STAGE_BADGE_LABELS[gcStage],
      petitions,
      tracks: buildPetitionTracks(profile, todayUtc),
      priorityDateSourceName: pdResolution.sourceSponsorName ?? retainedSponsorName ?? null,
      estimatedRangeLabel,
      bulletinCutoffLabel,
      nodes: gcNodes,
      segments: gcSegments,
      pins: gcPins
    },
    overlayInsights,
    missingFields,
    intakeAudit
  };
}

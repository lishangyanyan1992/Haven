import type { FirmClientEngagementState, FirmEngagementStageKey } from "@/lib/firms/types";

export const FIRM_ENGAGEMENT_STAGES: readonly {
  key: FirmEngagementStageKey;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    key: "intake_completed",
    label: "Intake completed",
    shortLabel: "Intake",
    description: "Share your visa background, employment details, and key dates with your sponsoring firm."
  },
  {
    key: "documents_uploaded",
    label: "Documents uploaded",
    shortLabel: "Documents",
    description: "Upload requested immigration records to your Document Vault for attorney review."
  },
  {
    key: "initial_consultation",
    label: "Initial consultation call",
    shortLabel: "Consultation",
    description: "Walk through your timeline, filing options, and strategy on an initial call with your attorney."
  },
  {
    key: "contract_signed",
    label: "Contract signed",
    shortLabel: "Contract",
    description: "Review and sign the engagement agreement to formally kick off legal representation."
  },
  {
    key: "case_prep",
    label: "Case preparation",
    shortLabel: "Case prep",
    description: "Your legal team drafts forms, support letters, and assembles your petition packet."
  },
  {
    key: "petition_filed",
    label: "Petition filed",
    shortLabel: "Filed",
    description: "Your petition is submitted to USCIS or DOL and receipt notices are tracked."
  }
] as const;

const STAGE_INDEX: Record<FirmEngagementStageKey, number> = {
  intake_completed: 0,
  documents_uploaded: 1,
  initial_consultation: 2,
  contract_signed: 3,
  case_prep: 4,
  petition_filed: 5
};

export type FirmEngagementStepStatus = "completed" | "current" | "upcoming";

export type FirmEngagementStepView = {
  key: FirmEngagementStageKey;
  index: number;
  label: string;
  shortLabel: string;
  description: string;
  status: FirmEngagementStepStatus;
  badgeText: string;
  metaText: string | null;
  actionHref?: string;
  actionLabel?: string;
};

export type FirmEngagementOverview = {
  firmName: string;
  isConnectedToFirm: boolean;
  steps: FirmEngagementStepView[];
  completedCount: number;
  totalSteps: number;
  progressPercent: number;
  currentStep: FirmEngagementStepView;
  nextStep: FirmEngagementStepView | null;
  scheduledDate: string | null;
  attorneyNote: string | null;
  headline: string;
  summary: string;
};

function formatShortDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00Z` : trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function isStageKey(value: unknown): value is FirmEngagementStageKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STAGE_INDEX, value);
}

export function cleanEngagementState(raw: unknown): FirmClientEngagementState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const out: FirmClientEngagementState = {};

  if (isStageKey(record.stage)) {
    out.stage = record.stage;
  }

  if (
    record.stageStatus === "in_progress" ||
    record.stageStatus === "scheduled" ||
    record.stageStatus === "completed"
  ) {
    out.stageStatus = record.stageStatus;
  }

  if (typeof record.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(record.scheduledDate.trim())) {
    out.scheduledDate = record.scheduledDate.trim();
  }

  if (typeof record.note === "string") {
    const trimmedNote = record.note.trim().slice(0, 280);
    if (trimmedNote) out.note = trimmedNote;
  }

  if (typeof record.updatedAt === "string" && record.updatedAt.trim()) {
    out.updatedAt = record.updatedAt.trim();
  }

  return out;
}

export function validateEngagementUpdate(
  raw: unknown
): { ok: true; state: FirmClientEngagementState } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid engagement update payload." };
  }
  const record = raw as Record<string, unknown>;
  if (record.stage !== undefined && record.stage !== "" && !isStageKey(record.stage)) {
    return { ok: false, error: "Invalid engagement stage selected." };
  }
  if (
    record.scheduledDate !== undefined &&
    record.scheduledDate !== "" &&
    (typeof record.scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.scheduledDate.trim()))
  ) {
    return { ok: false, error: "Scheduled date must be a valid YYYY-MM-DD date." };
  }
  const cleaned = cleanEngagementState({
    ...record,
    updatedAt: new Date().toISOString()
  });
  return { ok: true, state: cleaned };
}

export function buildFirmEngagementOverview(input: {
  firmName?: string | null;
  isConnectedToFirm: boolean;
  joinedAt?: string | null;
  completedAt?: string | null;
  reviewedAt?: string | null;
  hasProfileSetup?: boolean;
  uploadedDocumentCount: number;
  requiredDocumentCount: number;
  fulfilledRequiredCount: number;
  engagementState?: FirmClientEngagementState | null;
}): FirmEngagementOverview {
  const firmName = input.firmName?.trim() || "Sponsoring Law Firm";
  const state = cleanEngagementState(input.engagementState);

  const lawyerStageIdx = state.stage !== undefined ? STAGE_INDEX[state.stage] : -1;
  const lawyerStageCompleted = state.stageStatus === "completed";

  // Step 0: Intake completed
  const intakeDone =
    Boolean(input.completedAt) ||
    Boolean(!input.isConnectedToFirm && input.hasProfileSetup) ||
    lawyerStageIdx > 0 ||
    (lawyerStageIdx === 0 && lawyerStageCompleted);

  // Step 1: Documents uploaded
  const docsSatisfiedByUploads =
    input.requiredDocumentCount > 0
      ? input.fulfilledRequiredCount >= input.requiredDocumentCount
      : input.uploadedDocumentCount > 0;
  const docsDone =
    docsSatisfiedByUploads ||
    lawyerStageIdx > 1 ||
    (lawyerStageIdx === 1 && lawyerStageCompleted);

  // Determine highest completed index and active index
  let activeIndex = 0;
  if (!intakeDone) {
    activeIndex = 0;
  } else if (!docsDone && lawyerStageIdx < 2) {
    activeIndex = 1;
  } else if (lawyerStageIdx >= 2) {
    if (lawyerStageCompleted) {
      activeIndex = Math.min(lawyerStageIdx + 1, FIRM_ENGAGEMENT_STAGES.length - 1);
    } else {
      activeIndex = lawyerStageIdx;
    }
  } else {
    // Intake & docs are done (or intake is done and lawyer hasn't set a later stage yet):
    // When intake is done, if docs aren't uploaded yet, docs is step 1 and consultation is step 2.
    // Once intake & docs are done, Initial Consultation Call is the active step!
    activeIndex = 2;
  }

  const allCompleted = lawyerStageIdx === FIRM_ENGAGEMENT_STAGES.length - 1 && lawyerStageCompleted;
  const scheduledFormatted = formatShortDate(state.scheduledDate);

  const steps: FirmEngagementStepView[] = FIRM_ENGAGEMENT_STAGES.map((stage, idx) => {
    let status: FirmEngagementStepStatus = "upcoming";
    if (allCompleted) {
      status = "completed";
    } else if (idx === 0) {
      status = intakeDone ? "completed" : activeIndex === 0 ? "current" : "upcoming";
    } else if (idx === 1) {
      if (docsDone) {
        status = "completed";
      } else if (activeIndex === 1) {
        status = "current";
      } else {
        status = "upcoming";
      }
    } else if (idx < activeIndex) {
      status = "completed";
    } else if (idx === activeIndex) {
      status = "current";
    } else {
      status = "upcoming";
    }

    let badgeText = status === "completed" ? "Completed" : status === "current" ? "Current step" : "Upcoming";
    let metaText: string | null = null;
    let actionHref: string | undefined;
    let actionLabel: string | undefined;

    if (stage.key === "intake_completed") {
      const completedDate = formatShortDate(input.completedAt);
      if (status === "completed") {
        badgeText = "Completed";
        metaText = completedDate ? `Completed ${completedDate}` : "Profile & intake saved";
      } else {
        badgeText = "Action needed";
        metaText = input.joinedAt ? `Joined ${formatShortDate(input.joinedAt)}` : "Finish intake questions";
        actionHref = "/onboarding";
        actionLabel = "Complete intake";
      }
    } else if (stage.key === "documents_uploaded") {
      if (input.requiredDocumentCount > 0) {
        metaText = `${input.fulfilledRequiredCount} of ${input.requiredDocumentCount} required uploaded`;
      } else if (input.uploadedDocumentCount > 0) {
        metaText = `${input.uploadedDocumentCount} document${input.uploadedDocumentCount === 1 ? "" : "s"} in vault`;
      } else {
        metaText = "No documents uploaded yet";
      }

      if (status === "completed") {
        badgeText = "Completed";
      } else if (status === "current") {
        badgeText = input.fulfilledRequiredCount > 0 || input.uploadedDocumentCount > 0 ? "In progress" : "Action needed";
        actionHref = "/documents";
        actionLabel = "Upload documents";
      } else if (input.requiredDocumentCount > input.fulfilledRequiredCount) {
        actionHref = "/documents";
        actionLabel = "View checklist";
      }
    } else if (stage.key === "initial_consultation") {
      if (status === "completed") {
        badgeText = "Completed";
        metaText = idx === lawyerStageIdx && scheduledFormatted ? `Held ${scheduledFormatted}` : "Call completed";
      } else if (status === "current") {
        if (state.stageStatus === "scheduled" || scheduledFormatted) {
          badgeText = "Scheduled";
          metaText = scheduledFormatted ? `Scheduled for ${scheduledFormatted}` : "Call scheduled with firm";
        } else {
          badgeText = "Next step";
          metaText = input.reviewedAt
            ? `Attorney reviewed intake ${formatShortDate(input.reviewedAt)}`
            : "Ready to schedule after intake review";
        }
      } else {
        metaText = "Follows intake & document review";
      }
    } else if (stage.key === "contract_signed") {
      if (status === "completed") {
        badgeText = "Signed";
        metaText = idx === lawyerStageIdx && scheduledFormatted ? `Signed ${scheduledFormatted}` : "Retainer signed";
      } else if (status === "current") {
        badgeText = "Next step";
        metaText = scheduledFormatted ? `Target ${scheduledFormatted}` : "Awaiting retainer signature";
      } else {
        metaText = "Follows initial consultation call";
      }
    } else if (stage.key === "case_prep") {
      if (status === "completed") {
        badgeText = "Completed";
        metaText = "Filing packet finalized";
      } else if (status === "current") {
        badgeText = "In progress";
        metaText = scheduledFormatted ? `Target filing ${scheduledFormatted}` : "Attorney drafting forms & letters";
      } else {
        metaText = "Starts once contract is signed";
      }
    } else if (stage.key === "petition_filed") {
      if (status === "completed") {
        badgeText = "Filed";
        metaText = scheduledFormatted ? `Filed ${scheduledFormatted}` : "Submitted to agency";
      } else if (status === "current") {
        badgeText = "Filing window";
        metaText = scheduledFormatted ? `Target ${scheduledFormatted}` : "Final review before submission";
      } else {
        metaText = "Final submission & receipt tracking";
      }
    }

    return {
      key: stage.key,
      index: idx,
      label: stage.label,
      shortLabel: stage.shortLabel,
      description: stage.description,
      status,
      badgeText,
      metaText,
      actionHref,
      actionLabel
    };
  });

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);
  const currentStep = steps.find((s) => s.status === "current") ?? steps[steps.length - 1];
  const currentIdx = currentStep.index;
  const nextStep =
    allCompleted
      ? null
      : currentIdx + 1 < steps.length
        ? steps[currentIdx + 1]
        : null;

  let headline = `${currentStep.label}`;
  let summary = currentStep.description;

  if (allCompleted) {
    headline = "Petition filed with agency";
    summary = `All engagement stages with ${firmName} are complete. Keep your receipt notice and approval updates in your Document Vault.`;
  } else if (currentStep.key === "intake_completed") {
    headline = "Complete your intake questionnaire";
    summary = `Finish sharing your visa and employment details so ${firmName} can prepare for your initial consultation call.`;
  } else if (currentStep.key === "documents_uploaded") {
    headline = "Upload your required documents";
    summary = `Your intake is complete. Upload your requested documents next so ${firmName} can review your file before your initial consultation call.`;
  } else if (currentStep.key === "initial_consultation") {
    headline =
      state.stageStatus === "scheduled" && scheduledFormatted
        ? `Initial consultation call scheduled for ${scheduledFormatted}`
        : "Next step: Initial consultation call";
    summary =
      "Your intake is completed. Next is your initial consultation call with the sponsoring law firm, followed by signing the engagement contract.";
  } else if (currentStep.key === "contract_signed") {
    headline = "Next step: Sign engagement contract";
    summary =
      "Your initial consultation call is complete. Once the retainer agreement is signed, your legal team begins case preparation.";
  } else if (currentStep.key === "case_prep") {
    headline = "Case strategy & preparation in progress";
    summary = `${firmName} is preparing your petition forms and supporting documentation for filing.`;
  }

  return {
    firmName,
    isConnectedToFirm: input.isConnectedToFirm,
    steps,
    completedCount,
    totalSteps,
    progressPercent,
    currentStep,
    nextStep,
    scheduledDate: scheduledFormatted,
    attorneyNote: state.note ?? null,
    headline,
    summary
  };
}

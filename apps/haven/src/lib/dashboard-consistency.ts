import { isApprovedStage, providesI140Protection, sponsorMatches } from "@/lib/petitions";
import { isPetitionEnded, type ImmigrantPetition, type ImmigrationProfile, type PermStage } from "@/types/domain";

// Finds answers that contradict each other. Each rule is small and pure. A
// conflict is always shown to the user ("Check this"); the dashboard never
// quietly picks one side.

export type DashboardConflictQuickFix = {
  kind: "end_petition";
  petitionId: string;
  reason: "layoff";
  date: string;
  label: string;
};

export type DashboardConflict = {
  id: string;
  /** Lower shows first. */
  priority: number;
  message: string;
  fields: string[];
  fixHref: string;
  quickFix?: DashboardConflictQuickFix;
};

export type ConsistencyInput = {
  profile: ImmigrationProfile;
  /** Saved deadline answers (statusEndDate, jobEnded, lastWorkDay, ...). */
  deadlines?: Record<string, unknown> | null;
  /** Layoff date from the active layoff plan, if any. */
  layoffDate?: string | null;
};

const GREEN_CARDS_HREF = "/settings#green-cards";
const PROFILE_HREF = "/settings#case-details";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function petitions(profile: ImmigrationProfile): ImmigrantPetition[] {
  return profile.immigrantPetitions ?? [];
}

function layoffDateOf(input: ConsistencyInput): string | null {
  return str(input.layoffDate) ?? (input.deadlines?.jobEnded === "yes" ? str(input.deadlines?.lastWorkDay) : null);
}

function isLaidOff(input: ConsistencyInput): boolean {
  return (
    input.profile.employmentStatus === "laid_off" ||
    input.deadlines?.jobEnded === "yes" ||
    Boolean(str(input.layoffDate))
  );
}

function expectedPermStage(p: ImmigrantPetition): PermStage {
  if (p.stage === "pwd_recruitment" || p.stage === "perm_in_progress") return "in_progress";
  return "certified";
}

const PERM_STAGE_LABEL: Record<PermStage, string> = {
  not_started: "not started",
  in_progress: "in progress",
  certified: "approved",
  denied: "denied"
};

type Rule = (input: ConsistencyInput) => DashboardConflict | null;

/** The I-140 "approved" answer disagrees with the green card records. */
const i140FlagVsPetitions: Rule = ({ profile }) => {
  const list = petitions(profile);
  if (list.length === 0) return null;
  const anyApproved = list.some(providesI140Protection);
  if (profile.i140Approved === anyApproved) return null;
  return {
    id: "i140-flag-vs-petitions",
    priority: 1,
    message: profile.i140Approved
      ? "Your profile says an I-140 was approved, but none of your green cards is marked approved."
      : "One of your green cards has an approved I-140, but your profile says no I-140 is approved.",
    fields: ["i140Approved", "immigrantPetitions"],
    fixHref: GREEN_CARDS_HREF
  };
};

/** A green card is still marked in progress for the employer the user was laid off from. */
const activeAfterLayoff: Rule = (input) => {
  if (!isLaidOff(input)) return null;
  const employer = input.profile.employerName;
  const stale = petitions(input.profile).find(
    (p) =>
      !isPetitionEnded(p) &&
      !isApprovedStage(p.stage) &&
      (p.petitionType === "employer_sponsored" || p.petitionType === "concurrent_employer") &&
      sponsorMatches(p.sponsorName, employer)
  );
  if (!stale) return null;
  const date = layoffDateOf(input);
  return {
    id: "petition-active-after-layoff",
    priority: 0,
    message: `You were laid off from ${employer}, but the ${stale.sponsorName} green card is still marked in progress. Did it end?`,
    fields: ["employmentStatus", "immigrantPetitions"],
    fixHref: GREEN_CARDS_HREF,
    quickFix: date
      ? {
          kind: "end_petition",
          petitionId: stale.id,
          reason: "layoff",
          date,
          label: `Mark it ended on ${dateLabel(date)}`
        }
      : undefined
  };
};

/** The profile's PERM stage disagrees with the current employer's green card. */
const permStageVsCurrentPetition: Rule = (input) => {
  const { profile } = input;
  if (isLaidOff(input) || !profile.employerName) return null;
  const current = petitions(profile).find(
    (p) =>
      !isPetitionEnded(p) &&
      (p.petitionType === "employer_sponsored" || p.petitionType === "concurrent_employer") &&
      sponsorMatches(p.sponsorName, profile.employerName)
  );
  if (!current || !profile.permStage) return null;
  const expected = expectedPermStage(current);
  if (profile.permStage === expected) return null;
  return {
    id: "perm-stage-vs-current-petition",
    priority: 2,
    message: `Your profile says PERM is ${PERM_STAGE_LABEL[profile.permStage]}, but your ${current.sponsorName} green card says ${PERM_STAGE_LABEL[expected]}.`,
    fields: ["permStage", "immigrantPetitions"],
    fixHref: GREEN_CARDS_HREF
  };
};

/** A green card has its own priority date before PERM was filed. */
const priorityDateBeforePerm: Rule = ({ profile }) => {
  const p = petitions(profile).find(
    (x) =>
      !isPetitionEnded(x) &&
      (x.stage === "pwd_recruitment" || x.stage === "perm_in_progress") &&
      !x.permFilingDate &&
      Boolean(x.priorityDate) &&
      !x.isPriorityDateRecaptured
  );
  if (!p) return null;
  return {
    id: "priority-date-before-perm",
    priority: 3,
    message: `Your ${p.sponsorName} green card shows a priority date, but PERM hasn't been filed yet. Is that date carried over from an earlier green card?`,
    fields: ["priorityDate", "permFilingDate"],
    fixHref: GREEN_CARDS_HREF
  };
};

/** I-140 approval is dated before PERM was filed. */
const approvalBeforePermFiling: Rule = ({ profile }) => {
  const p = petitions(profile).find(
    (x) => x.i140ApprovalDate && x.permFilingDate && x.i140ApprovalDate < x.permFilingDate
  );
  if (p) {
    return {
      id: "i140-approval-before-perm",
      priority: 3,
      message: `Your ${p.sponsorName} green card has the I-140 approved before PERM was filed. One of those dates is likely wrong.`,
      fields: ["i140ApprovalDate", "permFilingDate"],
      fixHref: GREEN_CARDS_HREF
    };
  }
  if (
    petitions(profile).length === 0 &&
    profile.i140ApprovalDate &&
    profile.permFilingDate &&
    profile.i140ApprovalDate < profile.permFilingDate
  ) {
    return {
      id: "i140-approval-before-perm",
      priority: 3,
      message: "Your I-140 approval date is before your PERM filing date. One of those dates is likely wrong.",
      fields: ["i140ApprovalDate", "permFilingDate"],
      fixHref: PROFILE_HREF
    };
  }
  return null;
};

/** Status end date is before the layoff date. */
const statusEndBeforeLayoff: Rule = (input) => {
  const layoff = layoffDateOf(input);
  const statusEnd = str(input.deadlines?.statusEndDate) ?? str(input.profile.currentVisaExpiryDate);
  if (!layoff || !statusEnd || statusEnd >= layoff) return null;
  return {
    id: "status-end-before-layoff",
    priority: 1,
    message: `Your status end date (${dateLabel(statusEnd)}) is before your last day of work (${dateLabel(layoff)}). Please check both dates.`,
    fields: ["statusEndDate", "lastWorkDay"],
    fixHref: PROFILE_HREF
  };
};

export const CONSISTENCY_RULES: Rule[] = [
  activeAfterLayoff,
  i140FlagVsPetitions,
  statusEndBeforeLayoff,
  permStageVsCurrentPetition,
  priorityDateBeforePerm,
  approvalBeforePermFiling
];

export function findDashboardConflicts(input: ConsistencyInput): DashboardConflict[] {
  return CONSISTENCY_RULES.map((rule) => rule(input))
    .filter((c): c is DashboardConflict => c !== null)
    .sort((a, b) => a.priority - b.priority);
}

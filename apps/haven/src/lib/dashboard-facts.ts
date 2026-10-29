import { findDashboardConflicts, type DashboardConflict } from "@/lib/dashboard-consistency";
import {
  evaluateI140Protections,
  findActivePetition,
  inferProfileGreenCardStage,
  resolveEffectivePriorityDate
} from "@/lib/immigration-journey";
import type {
  DerivedProfileSignals,
  GreenCardStage,
  ImmigrationProfile,
  PreferenceCategory
} from "@/types/domain";

// The single place each dashboard fact is decided. The stored signals, the
// overview, the timeline, the planner and the advisor all read from here (or
// from the same three helpers in immigration-journey that this wraps), so two
// cards can't disagree about the same fact.

const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardFactsInput = {
  profile: ImmigrationProfile;
  deadlines?: Record<string, unknown> | null;
  layoffDate?: string | null;
  /** Bulletin-based figures when the feed is available. */
  bulletin?: Pick<DerivedProfileSignals, "visaBulletinPosition" | "estimatedGreenCardDateRange"> | null;
  now?: Date;
};

export type DashboardFacts = {
  stage: GreenCardStage;
  activePetitionId: string | null;
  priorityDate: {
    iso: string | null;
    sourceSponsorName: string | null;
    isRetained: boolean;
    category: PreferenceCategory | null;
  };
  protection: {
    hasApprovedI140: boolean;
    isAc21PortabilityUnlocked: boolean;
    isRevocationProtected: boolean;
    protectingSponsor: string | null;
    approvalDateIso: string | null;
    /** 180 days after I-140 approval. */
    lockInDateIso: string | null;
    /** Short status, e.g. "Unlocked since Jul 19, 2026" or "Available after Jul 19, 2026". */
    statusLabel: string | undefined;
  };
  readiness: {
    score: DerivedProfileSignals["layoffReadinessScore"];
    reasoning: string[];
  };
  waitEstimate: string | undefined;
  visaBulletinPosition: string | undefined;
  statusEndDate: string | null;
  conflicts: DashboardConflict[];
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function label(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function resolveDashboardFacts(input: DashboardFactsInput): DashboardFacts {
  const { profile } = input;
  const now = input.now ?? new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const protections = evaluateI140Protections(profile, todayUtc);
  const lockIn = protections.i140ApprovalDate
    ? new Date(protections.i140ApprovalDate.getTime() + 180 * DAY_MS)
    : null;
  const isProtectedNow = protections.isRevocationProtected || Boolean(lockIn && lockIn <= todayUtc);
  const statusLabel = !protections.hasApprovedI140
    ? undefined
    : lockIn
      ? isProtectedNow
        ? `Unlocked since ${label(lockIn)}`
        : `Available after ${label(lockIn)}`
      : "Unlocked";

  const pd = resolveEffectivePriorityDate(profile);
  const pdIso = iso(pd.effectiveDate);
  const category = pd.retainedCategory ?? profile.preferenceCategory ?? null;
  const backlogCategory =
    category === "EB-1" || category === "EB-2" || category === "EB-2 NIW" || category === "EB-3";

  // Readiness: same rules as before, but based on whether any approved I-140
  // protects the user, not just the single "I-140 approved" answer.
  const hasProtection = protections.hasApprovedI140;
  let score: DerivedProfileSignals["layoffReadinessScore"] = hasProtection ? "medium" : "low";
  const reasoning: string[] = [];
  if (hasProtection) {
    reasoning.push(
      protections.protectingSponsor
        ? `Approved I-140 with ${protections.protectingSponsor} improves portability and long-term leverage.`
        : "Approved I-140 improves portability and long-term leverage."
    );
  } else {
    reasoning.push("No approved I-140 means fewer employer-independent protections.");
  }
  if (
    profile.spouseVisaStatus === "H1B" ||
    profile.spouseVisaStatus === "H4" ||
    profile.spouseVisaStatus === "H4 EAD"
  ) {
    reasoning.push("Spousal status may create fallback options.");
    if (score === "low") score = "medium";
  }
  const laidOff =
    profile.employmentStatus === "laid_off" || input.deadlines?.jobEnded === "yes" || Boolean(str(input.layoffDate));
  if (laidOff) {
    score = hasProtection ? "medium" : "low";
    reasoning.unshift("You are already in an active layoff scenario.");
  }

  return {
    stage: inferProfileGreenCardStage(profile),
    activePetitionId: findActivePetition(profile)?.id ?? null,
    priorityDate: {
      iso: pdIso,
      sourceSponsorName: pd.sourceSponsorName ?? pd.retainedSponsorName ?? null,
      isRetained: pd.isRetained,
      category
    },
    protection: {
      hasApprovedI140: protections.hasApprovedI140,
      isAc21PortabilityUnlocked: protections.isAc21PortabilityUnlocked,
      isRevocationProtected: isProtectedNow,
      protectingSponsor: protections.protectingSponsor,
      approvalDateIso: iso(protections.i140ApprovalDate),
      lockInDateIso: iso(lockIn),
      statusLabel
    },
    readiness: { score, reasoning },
    // A bulletin with no estimate (for example, the date is current) stays empty;
    // "pending" only means the bulletin itself is missing.
    waitEstimate: input.bulletin
      ? input.bulletin.estimatedGreenCardDateRange
      : pdIso
        ? "Estimate pending bulletin sync"
        : undefined,
    visaBulletinPosition:
      input.bulletin?.visaBulletinPosition ??
      (pdIso && backlogCategory
        ? `Backlogged. Monitor ${category} movement for ${profile.countryOfBirth}.`
        : undefined),
    statusEndDate: str(input.deadlines?.statusEndDate) ?? str(profile.currentVisaExpiryDate),
    conflicts: findDashboardConflicts({
      profile,
      deadlines: input.deadlines,
      layoffDate: input.layoffDate
    })
  };
}

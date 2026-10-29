import { resolveDashboardFacts, type DashboardFactsInput } from "@/lib/dashboard-facts";
import type { Concern, DerivedProfileSignals, HavenWorkspaceSnapshot, ImmigrationProfile, TimelineEvent } from "@/types/domain";

type PriorityDateSignalOverrides = Pick<DerivedProfileSignals, "visaBulletinPosition" | "estimatedGreenCardDateRange">;

export function computeDerivedSignals(
  profile: ImmigrationProfile,
  priorityDateSignals?: PriorityDateSignalOverrides | null,
  context?: Pick<DashboardFactsInput, "deadlines" | "layoffDate" | "now">
): DerivedProfileSignals {
  const today = context?.now ?? new Date();
  const expiry = profile.currentVisaExpiryDate ? new Date(profile.currentVisaExpiryDate) : undefined;
  const h1bStart = profile.h1bStartDate ? new Date(profile.h1bStartDate) : undefined;

  const h1bCapDate = h1bStart
    ? new Date(h1bStart.getFullYear() + 6, h1bStart.getMonth(), h1bStart.getDate()).toISOString().slice(0, 10)
    : undefined;

  const daysUntilVisaExpiry = expiry ? Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : undefined;

  // Protection, readiness, priority date and wait come from the shared resolver.
  const facts = resolveDashboardFacts({
    profile,
    bulletin: priorityDateSignals ?? null,
    deadlines: context?.deadlines,
    layoffDate: context?.layoffDate,
    now: today
  });

  return {
    h1bCapDate,
    daysUntilVisaExpiry,
    visaBulletinPosition: facts.visaBulletinPosition,
    estimatedGreenCardDateRange: facts.waitEstimate,
    ac21PortabilityStatus: facts.protection.statusLabel,
    layoffReadinessScore: facts.readiness.score,
    layoffReadinessReasoning: facts.readiness.reasoning
  };
}

export function buildTimeline(profile: ImmigrationProfile, signals: DerivedProfileSignals): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (signals.h1bCapDate) {
    events.push({
      id: "h1b-cap",
      kind: "h1b_cap",
      group: "future",
      title: "Estimated H1B 6-year cap date",
      dateLabel: new Date(signals.h1bCapDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      nextAction: "Back-plan extensions and employer filing conversations from this date.",
      explanation: "Derived from your H1B start date."
    });
  }

  if (profile.currentVisaExpiryDate) {
    const expiry = new Date(profile.currentVisaExpiryDate);
    const renewal = new Date(expiry);
    renewal.setMonth(renewal.getMonth() - 6);
    events.push({
      id: "renewal-window",
      kind: "renewal_window",
      group: "upcoming",
      title: "Renewal window opens",
      dateLabel: renewal.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      nextAction: "Check with your employer before this date if renewal prep has not started.",
      explanation: "Haven recommends starting 6 months before visa expiry."
    });
  }

  if (signals.ac21PortabilityStatus) {
    events.push({
      id: "ac21",
      kind: "ac21_unlock",
      group: signals.ac21PortabilityStatus.startsWith("Available after") ? "upcoming" : "past",
      title: "AC21 portability milestone",
      dateLabel: signals.ac21PortabilityStatus.replace(/^(Available after|Unlocked since) /, ""),
      nextAction: "If a layoff or job change happens after this point, review same-or-similar role rules.",
      explanation: "180 days after I-140 approval."
    });
  }

  if (resolveDashboardFacts({ profile }).priorityDate.iso) {
    events.push({
      id: "bulletin",
      kind: "visa_bulletin_update",
      group: "now",
      title: "Monthly visa bulletin check",
      dateLabel: "Next bulletin release",
      nextAction: "Recalculate your filing position when the bulletin updates.",
      explanation: "Haven should refresh this monthly from your bulletin ingestion source."
    });
  }

  return events;
}

export function defaultNextActions(profile: ImmigrationProfile, signals: DerivedProfileSignals): string[] {
  const actions: string[] = [];

  if (profile.topConcerns.includes("layoffs")) {
    actions.push("Run the layoff scenario planner and save your 60-day checklist.");
  }
  if (signals.ac21PortabilityStatus) {
    actions.push(
      signals.ac21PortabilityStatus.startsWith("Available after")
        ? `Track AC21 portability: ${signals.ac21PortabilityStatus.toLowerCase()}.`
        : `AC21 portability: ${signals.ac21PortabilityStatus.toLowerCase()}. Use it when planning a job change.`
    );
  }
  if (resolveDashboardFacts({ profile }).priorityDate.iso) {
    actions.push("Monitor the next visa bulletin update and confirm whether your category moved.");
  } else {
    actions.push("Add your priority date to unlock timeline and bulletin tracking.");
  }

  return actions;
}

export function concernLabels(concerns: Concern[]) {
  return concerns.map((concern) => concern.replaceAll("_", " "));
}

function buildPlannerSituationSummary(profile: ImmigrationProfile): string {
  const parts: string[] = [];
  const facts = resolveDashboardFacts({ profile });
  const category = facts.priorityDate.category;

  if (facts.protection.hasApprovedI140) {
    parts.push(
      facts.protection.protectingSponsor
        ? `an approved I-140 with ${facts.protection.protectingSponsor}`
        : "an approved I-140"
    );
  }

  if (facts.priorityDate.iso && category && category !== "Not sure") {
    parts.push(`an ${category} ${profile.countryOfBirth} priority date`);
  }

  if (!profile.i485Filed) parts.push("no current I-485");

  const situation =
    parts.length > 0
      ? `You are on ${profile.visaType} with ${parts.join(", ")}.`
      : `You are on ${profile.visaType}.`;

  const portability = facts.protection.hasApprovedI140
    ? " preserving long-term green card progress through AC21 portability after the 180-day threshold"
    : " keeping your immigration options open";

  return `${situation} If a layoff happened today, your strongest path is likely an H1B transfer while${portability}.`;
}

function buildPlannerRankedOptions(base: HavenWorkspaceSnapshot["planner"]["rankedOptions"], profile: ImmigrationProfile) {
  return base.map((option) => {
    if (option.id !== "option-2") return option;

    const hasSpouseStatus = profile.spouseVisaStatus === "H4" || profile.spouseVisaStatus === "H4 EAD";
    return {
      ...option,
      whyItFits: hasSpouseStatus
        ? option.whyItFits
        : ["A spousal fallback may be available depending on your spouse's visa status.", "This can reduce immediate out-of-status risk in some cases."]
    };
  });
}

export function mergeSnapshotProfile(
  base: HavenWorkspaceSnapshot,
  profile: ImmigrationProfile,
  priorityDateSignals?: PriorityDateSignalOverrides | null
): HavenWorkspaceSnapshot {
  const signals = computeDerivedSignals(profile, priorityDateSignals);
  const timelineEvents = buildTimeline(profile, signals);

  const cohortName =
    profile.preferenceCategory && profile.preferenceCategory !== "Not sure" && profile.countryOfBirth
      ? `${profile.preferenceCategory} ${profile.countryOfBirth} | ${resolveDashboardFacts({ profile }).protection.hasApprovedI140 ? "Approved I-140" : "Green card track"} | Layoff watch`
      : base.cohorts[0]?.name ?? "H1B Layoff watch";

  return {
    ...base,
    profile,
    dashboard: {
      nextActions: defaultNextActions(profile, signals),
      communityMatchesLabel: `Haven members match your ${profile.visaType} + ${profile.preferenceCategory} ${profile.countryOfBirth} profile`,
      timelineHighlights: timelineEvents.slice(0, 2),
      signals
    },
    timelineEvents,
    planner: {
      ...base.planner,
      situationSummary: buildPlannerSituationSummary(profile),
      rankedOptions: buildPlannerRankedOptions(base.planner.rankedOptions, profile)
    },
    cohorts: base.cohorts.map((cohort, i) => (i === 0 ? { ...cohort, name: cohortName } : cohort))
  };
}

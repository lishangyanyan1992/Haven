import type { Concern, DerivedProfileSignals, HavenWorkspaceSnapshot, ImmigrationProfile, TimelineEvent } from "@/types/domain";

export function computeDerivedSignals(profile: ImmigrationProfile): DerivedProfileSignals {
  const today = new Date();
  const expiry = profile.currentVisaExpiryDate ? new Date(profile.currentVisaExpiryDate) : undefined;
  const h1bStart = profile.h1bStartDate ? new Date(profile.h1bStartDate) : undefined;
  const i140Approval = profile.i140ApprovalDate ? new Date(profile.i140ApprovalDate) : undefined;

  const h1bCapDate = h1bStart
    ? new Date(h1bStart.getFullYear() + 6, h1bStart.getMonth(), h1bStart.getDate()).toISOString().slice(0, 10)
    : undefined;

  const daysUntilVisaExpiry = expiry ? Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) : undefined;

  let layoffReadinessScore: DerivedProfileSignals["layoffReadinessScore"] = "low";
  const layoffReadinessReasoning: string[] = [];

  if (profile.i140Approved) {
    layoffReadinessScore = "medium";
    layoffReadinessReasoning.push("Approved I-140 improves portability and long-term leverage.");
  } else {
    layoffReadinessReasoning.push("No approved I-140 means fewer employer-independent protections.");
  }

  if (profile.spouseVisaStatus === "H1B" || profile.spouseVisaStatus === "H4" || profile.spouseVisaStatus === "H4 EAD") {
    layoffReadinessReasoning.push("Spousal status may create fallback options.");
    if (layoffReadinessScore === "low") layoffReadinessScore = "medium";
  }

  if (profile.employmentStatus === "laid_off") {
    layoffReadinessScore = profile.i140Approved ? "medium" : "low";
    layoffReadinessReasoning.unshift("You are already in an active layoff scenario.");
  }

  const ac21PortabilityStatus =
    i140Approval
      ? `Available after ${new Date(i140Approval.getTime() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })}`
      : undefined;

  return {
    h1bCapDate,
    daysUntilVisaExpiry,
    visaBulletinPosition:
      profile.priorityDate && (profile.preferenceCategory === "EB-2" || profile.preferenceCategory === "EB-3")
        ? `Backlogged. Monitor ${profile.preferenceCategory} movement for ${profile.countryOfBirth}.`
        : undefined,
    estimatedGreenCardDateRange: profile.priorityDate ? "Estimate pending bulletin + community data" : undefined,
    ac21PortabilityStatus,
    layoffReadinessScore,
    layoffReadinessReasoning
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
      group: "upcoming",
      title: "AC21 portability milestone",
      dateLabel: signals.ac21PortabilityStatus.replace("Available after ", ""),
      nextAction: "If a layoff or job change happens after this point, review same-or-similar role rules.",
      explanation: "180 days after I-140 approval."
    });
  }

  if (profile.priorityDate) {
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
    actions.push(`Track ${signals.ac21PortabilityStatus.toLowerCase()} for portability planning.`);
  }
  if (profile.priorityDate) {
    actions.push("Monitor the next visa bulletin update and confirm whether your category moved.");
  } else {
    actions.push("Add your priority date to unlock timeline and bulletin tracking.");
  }

  return actions;
}

export function concernLabels(concerns: Concern[]) {
  return concerns.map((concern) => concern.replaceAll("_", " "));
}

export function mergeSnapshotProfile(base: HavenWorkspaceSnapshot, profile: ImmigrationProfile): HavenWorkspaceSnapshot {
  const signals = computeDerivedSignals(profile);
  const timelineEvents = buildTimeline(profile, signals);

  return {
    ...base,
    profile,
    dashboard: {
      nextActions: defaultNextActions(profile, signals),
      communityMatchesLabel: base.dashboard.communityMatchesLabel,
      timelineHighlights: timelineEvents.slice(0, 2),
      signals
    },
    timelineEvents
  };
}

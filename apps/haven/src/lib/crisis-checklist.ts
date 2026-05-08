import type { ImmigrationProfile } from "@/types/domain";

export interface ChecklistItem {
  key: string;
  window: string;
  title: string;
  detail: string;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function buildChecklist(profile: ImmigrationProfile): ChecklistItem[] {
  const priorityDateLabel =
    profile.preferenceCategory && profile.preferenceCategory !== "Not sure"
      ? `${profile.preferenceCategory} priority date`
      : "employment-based priority date";

  const items: ChecklistItem[] = [
    {
      key: "document-copies",
      window: "Day 1–3",
      title: "Gather all immigration documents",
      detail:
        "Locate your I-797 H-1B approval notices, I-140 approval (if applicable), last 3 pay stubs, employment verification letter, passport biographic page, and all visa stamps. Store digital copies somewhere accessible.",
    },
    {
      key: "contact-attorney",
      window: "Day 1–3",
      title: "Contact your immigration attorney",
      detail:
        "Alert your attorney immediately. They need to confirm your exact grace period start date (typically the last day of employment) and advise on your best path given your current status.",
    },
    {
      key: "understand-grace-period",
      window: "Day 1–7",
      title: "Confirm your exact grace period start date",
      detail:
        "The 60-day H-1B grace period (per 8 CFR 214.1(l)(2)) begins on your last day of employment — not the day you were notified. Confirm this date in writing with HR and your attorney.",
    },
    {
      key: "explore-options",
      window: "Day 7–21",
      title: "Evaluate your transfer vs. change-of-status options",
      detail:
        "Your primary paths are: (1) H-1B transfer to a new employer, (2) change to another visa status (O-1, F-1, B-2 bridge), or (3) self-petition (if eligible). Rank these with your attorney based on speed and your situation.",
    },
    {
      key: "begin-job-search",
      window: "Day 7–21",
      title: "Begin active job search with visa-friendly employers",
      detail:
        "Focus on companies with established H-1B sponsorship history. Large tech, consulting, and finance firms typically move faster on transfers. Document all applications and responses.",
    },
    {
      key: "file-or-transfer",
      window: "Day 21–45",
      title: "File H-1B transfer or change-of-status petition",
      detail:
        "Filing must happen before day 60. Premium processing ($2,805 as of 2024) guarantees a 15-business-day response — worth considering given the time pressure. Your attorney files Form I-129 on your behalf.",
    },
    {
      key: "confirm-receipt",
      window: "Day 45–60",
      title: "Confirm USCIS receipt notice with your attorney",
      detail:
        "Once a transfer or change-of-status is filed, you are in a period of authorized stay. Your attorney should have the receipt notice (Form I-797C) — keep a copy with you at all times.",
    },
    {
      key: "contingency-plan",
      window: "Day 45–60",
      title: "Prepare contingency if no status is secured",
      detail:
        "If no petition has been filed and day 60 is approaching, discuss B-2 tourist visa as a bridge with your attorney. Departure and reentry on a valid visa is another option. Do not remain beyond authorized stay.",
    },
  ];

  // Profile-conditional additions

  if (
    profile.i140Approved &&
    profile.i140ApprovalDate &&
    daysSince(profile.i140ApprovalDate) >= 180
  ) {
    items.splice(3, 0, {
      key: "ac21-portability-check",
      window: "Day 7–21",
      title: "Verify AC-21 portability for your I-140",
      detail:
        "Because your I-140 has been approved for 180+ days, it may be portable under INA § 204(j). This means you can transfer to a same or similar job without losing your priority date. Confirm with your attorney whether your I-140 qualifies.",
    });
  }

  if (profile.spouseVisaStatus === "H4 EAD") {
    items.push({
      key: "spouse-h4-ead-impact",
      window: "Day 1–7",
      title: "Your spouse's H-4 EAD is also at risk",
      detail:
        "H-4 EAD authorization is tied to your H-1B status and your I-140 approval. If your status lapses, your spouse's work authorization lapses with it. They should also consult an attorney immediately about next steps.",
    });
  } else if (profile.spouseVisaStatus === "H4") {
    items.push({
      key: "spouse-h4-status",
      window: "Day 1–7",
      title: "Understand how your status change affects your spouse's H-4",
      detail:
        "Your spouse's H-4 status is derivative of your H-1B. A change to your status (e.g., filing for B-2 or F-1) will affect their status. Consult an attorney to plan both transitions together.",
    });
  }

  if (profile.primaryGoal === "get_gc") {
    items.push({
      key: "preserve-priority-date",
      window: "Day 7–21",
      title: "Confirm your EB priority date is preserved",
      detail:
        `Your ${priorityDateLabel} is your place in line for a green card. Under AC-21, if you transfer to a same or similar role, your priority date carries over. Your attorney must confirm how that applies to your case before you accept any new offer.`,
    });
  }

  if (profile.preferenceCategory && profile.preferenceCategory !== "Not sure") {
    items.push({
      key: "eb-portability-attorney",
      window: "Day 7–21",
      title: "Discuss EB portability with your attorney before accepting an offer",
      detail:
        `A new offer can affect your ${profile.preferenceCategory} green card strategy. Confirm how the role, job family, and timing interact with portability rules before you commit.`,
    });
  }

  return items;
}

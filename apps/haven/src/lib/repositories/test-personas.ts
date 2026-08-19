/**
 * People to test the Advisor as.
 *
 * WHY THIS EXISTS
 *
 * There was one test identity — Priya Shah — and she is employed. Every layoff
 * question in every eval was therefore answered for somebody who still has a
 * job. That is not a small mismatch: the layoff topic is one of the two the
 * product committed to, and its answers turn almost entirely on where the person
 * is in their 60 days. Asking "when can I start the new job?" as somebody who was
 * never laid off produces an answer that looks reasonable and proves nothing, and
 * a failure could not be attributed — bad answer, or wrong test subject?
 *
 * The three added here are the three shapes the real corpus actually contains.
 * They come from 161 Reddit and RedNote posts, not from imagination:
 *
 *   day 5        the largest single cluster. Just laid off, nothing filed, the
 *                whole decision still open. Strongest possible position — approved
 *                I-140, certified PERM — so a bad answer here cannot be blamed on
 *                a hard case.
 *   day 42       offer signed, transfer filed with premium, no receipt yet. The
 *                most common *dangerous* moment in the corpus, because "can I
 *                start?" has a real answer that people get wrong in both
 *                directions.
 *   day 89       the grace period already ran out; a B-2 filed inside it is
 *                pending. The case the product most needs to not make worse, and
 *                the one Priya could never test at all.
 *
 * Between them they also vary the things that change an answer: country (India,
 * China, Brazil), whether an I-140 exists, and whether a spouse offers a bridge.
 * Two personas having the same answer to a question is a finding; with one
 * persona it was not observable.
 *
 * SAFETY
 *
 * A persona only ever replaces the *mock* snapshot, which is used exactly when
 * Supabase is absent. It cannot overwrite, mask, or be confused with a real
 * account's data, and it requires ADVISOR_TEST_PERSONA to be set on top of that.
 *
 * WHAT THESE CANNOT TEST
 *
 * There is no layoff date on the profile. `layoff_events.layoff_date` exists in
 * the database and the Advisor does not read it, so the bot cannot say "you are
 * on day 42 of 60" even for a real user — it only knows `employmentStatus:
 * laid_off`. The dates below are carried in the timeline entries, which do reach
 * the model, so these personas test the best case the product can currently
 * reach. If an answer here is vague about the deadline, that is the missing field
 * showing, not the model.
 */

import { havenSnapshot } from "@/lib/repositories/mock-data";
import type { HavenWorkspaceSnapshot, ImmigrationProfile, TimelineEvent } from "@/types/domain";

export type TestPersona = {
  id: string;
  /** One line, for the runner to print above the answers. */
  situation: string;
  /** What this persona exists to catch that the others do not. */
  tests: string;
  snapshot: HavenWorkspaceSnapshot;
};

/**
 * Timeline entries are the only place a date reaches the model.
 *
 * `buildAdvisorContext` takes the first four `timelineEvents` and renders title,
 * date and next action. `kind` is not surfaced anywhere, so the closest existing
 * value is used rather than widening the union for fixtures.
 */
function timeline(entries: Array<Pick<TimelineEvent, "title" | "dateLabel" | "nextAction" | "explanation">>): TimelineEvent[] {
  return entries.map((entry, index) => ({
    id: `persona-timeline-${index + 1}`,
    kind: "renewal_window",
    group: index === 0 ? "now" : "upcoming",
    ...entry
  }));
}

function persona(
  id: string,
  situation: string,
  tests: string,
  profile: Partial<ImmigrationProfile>,
  entries: Parameters<typeof timeline>[0],
  signals: Partial<HavenWorkspaceSnapshot["dashboard"]["signals"]>,
  nextActions: string[]
): TestPersona {
  return {
    id,
    situation,
    tests,
    snapshot: {
      ...havenSnapshot,
      profile: { ...havenSnapshot.profile, id, ...profile },
      timelineEvents: timeline(entries),
      dashboard: {
        ...havenSnapshot.dashboard,
        nextActions,
        signals: { ...havenSnapshot.dashboard.signals, ...signals }
      }
    }
  };
}

/**
 * Dates are fixed, not relative to today.
 *
 * A persona whose layoff date is computed as "eleven days ago" changes meaning
 * every time it runs, so two runs a fortnight apart are not comparable and a
 * regression cannot be separated from the calendar moving. Written against
 * 2026-08-19; re-date them deliberately when they go stale rather than making
 * them drift on their own.
 */
export const TEST_PERSONAS: TestPersona[] = [
  persona(
    "day-5",
    "Arjun Menon — laid off five days ago, 60-day grace period ends Oct 13, 2026. Nothing filed yet.",
    "The open decision. Approved I-140 and certified PERM, so nothing here is a hard case — a weak answer is the product's fault, not the situation's.",
    {
      fullName: "Arjun Menon",
      email: "arjun@example.com",
      visaType: "H1B",
      countryOfBirth: "India",
      currentVisaExpiryDate: "2027-03-31",
      h1bStartDate: "2021-10-01",
      permStage: "certified",
      permFilingDate: "2023-02-14",
      i140Approved: true,
      i140ApprovalDate: "2024-01-22",
      priorityDate: "2021-11-03",
      preferenceCategory: "EB-2",
      i485Filed: false,
      employerName: "Northwind Systems",
      employerSize: "enterprise",
      employerIndustry: "Software",
      jobTitle: "Staff Engineer",
      employmentStatus: "laid_off",
      spouseVisaStatus: "H4",
      primaryGoal: "get_gc",
      topConcerns: ["layoffs", "visa_expiry", "gc_timeline"]
    },
    [
      {
        title: "Last day of employment",
        dateLabel: "Aug 14, 2026",
        nextAction: "Confirm the date your employer reported to USCIS, which may differ from your last paid day.",
        explanation: "Reported by you when your employment status changed."
      },
      {
        title: "60-day grace period ends",
        dateLabel: "Oct 13, 2026",
        nextAction: "A new petition generally needs to be filed before this date.",
        explanation: "60 days from the last day of employment on file."
      },
      {
        title: "I-140 approved",
        dateLabel: "Jan 22, 2024",
        nextAction: "Your priority date is retained from this approval.",
        explanation: "From your Haven profile."
      },
      {
        title: "H-1B six-year cap date",
        dateLabel: "Sep 30, 2027",
        nextAction: "Certified PERM filed more than a year ago may support extensions past this date.",
        explanation: "Derived from your H-1B start date."
      }
    ],
    {
      h1bCapDate: "2027-09-30",
      daysUntilVisaExpiry: 224,
      visaBulletinPosition: "Backlogged. EB-2 India.",
      ac21PortabilityStatus: "Available — I-140 approved more than 180 days ago",
      layoffReadinessScore: "high",
      layoffReadinessReasoning: [
        "Your I-140 is approved, so your priority date is retained.",
        "Your PERM is certified and was filed more than a year ago.",
        "Your spouse is on H-4, which may or may not be an option depending on their status."
      ]
    },
    [
      "Confirm the last-day-of-employment date your employer reported to USCIS.",
      "Gather your I-797 approval notices, recent paystubs and I-140 approval.",
      "Note that your 60-day grace period ends Oct 13, 2026."
    ]
  ),

  persona(
    "day-42",
    "Wei Chen — laid off 42 days ago, grace period ends Sep 6, 2026. New employer filed an H-1B transfer with premium processing on Aug 12; no decision yet.",
    "The most dangerous moment in the corpus: 'can I start?' has a real answer, and people get it wrong in both directions. Also the only persona whose spouse is on their own H-1B.",
    {
      fullName: "Wei Chen",
      email: "wei@example.com",
      visaType: "H1B",
      countryOfBirth: "China",
      currentVisaExpiryDate: "2026-11-30",
      h1bStartDate: "2022-10-01",
      permStage: "not_started",
      permFilingDate: undefined,
      i140Approved: true,
      i140ApprovalDate: "2025-03-04",
      priorityDate: "2022-05-19",
      preferenceCategory: "EB-3",
      i485Filed: false,
      employerName: "Kestrel Robotics",
      employerSize: "mid-size",
      employerIndustry: "Hardware",
      jobTitle: "Mechanical Engineer",
      employmentStatus: "laid_off",
      spouseVisaStatus: "H1B",
      primaryGoal: "job_stability",
      topConcerns: ["layoffs", "job_change", "visa_expiry"]
    },
    [
      {
        title: "H-1B transfer filed by new employer, premium processing",
        dateLabel: "Aug 12, 2026",
        nextAction: "Do not assume a filing date is a start date; confirm what has actually been received.",
        explanation: "Reported by you."
      },
      {
        title: "60-day grace period ends",
        dateLabel: "Sep 6, 2026",
        nextAction: "The petition was filed before this date.",
        explanation: "60 days from the last day of employment on file."
      },
      {
        title: "Last day of employment",
        dateLabel: "Jul 8, 2026",
        nextAction: "Confirm this matches what your employer reported.",
        explanation: "Reported by you when your employment status changed."
      },
      {
        title: "Current I-797 validity ends",
        dateLabel: "Nov 30, 2026",
        nextAction: "The pending transfer, if approved, would replace this.",
        explanation: "From your Haven profile."
      }
    ],
    {
      h1bCapDate: "2028-09-30",
      daysUntilVisaExpiry: 103,
      visaBulletinPosition: "Backlogged. EB-3 China.",
      ac21PortabilityStatus: "Available — I-140 approved more than 180 days ago",
      layoffReadinessScore: "medium",
      layoffReadinessReasoning: [
        "A petition was filed inside your grace period.",
        "No decision has been received, and a filing is not the same as an approval.",
        "Your spouse holds their own H-1B, which may open options yours does not."
      ]
    },
    [
      "Confirm exactly what the new employer has received — receipt notice, approval, or neither.",
      "Do not start work on an assumption about what has been filed.",
      "Note that your grace period ends Sep 6, 2026."
    ]
  ),

  persona(
    "day-89",
    "Rafael Souza — laid off 89 days ago. The 60-day grace period ended Jul 21, 2026. An I-539 change of status to B-2 was filed Jul 18, inside the grace period, and is still pending.",
    "The case the product most needs to not make worse, and the one Priya could never reach. No I-140, PERM died with the job, no spouse to bridge through — every easy answer is unavailable.",
    {
      fullName: "Rafael Souza",
      email: "rafael@example.com",
      visaType: "H1B",
      countryOfBirth: "Brazil",
      currentVisaExpiryDate: "2028-06-30",
      h1bStartDate: "2023-10-01",
      permStage: "in_progress",
      permFilingDate: "2026-01-09",
      i140Approved: false,
      i140ApprovalDate: undefined,
      priorityDate: undefined,
      preferenceCategory: "EB-2",
      i485Filed: false,
      employerName: "Halcyon Health",
      employerSize: "startup",
      employerIndustry: "Healthcare",
      jobTitle: "Data Scientist",
      employmentStatus: "laid_off",
      spouseVisaStatus: "none",
      primaryGoal: "explore_options",
      topConcerns: ["layoffs", "visa_expiry", "other"]
    },
    [
      {
        title: "I-539 change of status to B-2 filed",
        dateLabel: "Jul 18, 2026",
        nextAction: "Still pending. Filing inside the grace period is what matters here.",
        explanation: "Reported by you."
      },
      {
        title: "60-day grace period ended",
        dateLabel: "Jul 21, 2026",
        nextAction: "This date has passed.",
        explanation: "60 days from the last day of employment on file."
      },
      {
        title: "Last day of employment",
        dateLabel: "May 22, 2026",
        nextAction: "Confirm this matches what your employer reported to USCIS.",
        explanation: "Reported by you when your employment status changed."
      },
      {
        title: "PERM filed by former employer",
        dateLabel: "Jan 9, 2026",
        nextAction: "PERM belongs to the employer that filed it.",
        explanation: "From your Haven profile."
      }
    ],
    {
      h1bCapDate: "2029-09-30",
      daysUntilVisaExpiry: 681,
      visaBulletinPosition: "No priority date on file.",
      estimatedGreenCardDateRange: "Not available — no approved I-140",
      ac21PortabilityStatus: "Not available — no approved I-140",
      layoffReadinessScore: "low",
      layoffReadinessReasoning: [
        "Your 60-day grace period has passed.",
        "A change of status filed inside the grace period is pending.",
        "You have no approved I-140, so no priority date is retained."
      ]
    },
    [
      "Your I-539 is pending; confirm the receipt date and current case status.",
      "Speak with an immigration attorney about your current status.",
      "Keep every notice you have received from USCIS."
    ]
  )
];

/**
 * Which persona this process is running as, if any.
 *
 * Deliberately returns null for an unrecognised value rather than throwing or
 * silently falling back to Priya: a typo'd persona name should be loud in the
 * runner, and a run that quietly used the wrong person is the exact failure this
 * whole file exists to prevent.
 */
export function resolveTestPersona(value: string | undefined = process.env.ADVISOR_TEST_PERSONA): TestPersona | null {
  const wanted = value?.trim();
  if (!wanted) return null;
  return TEST_PERSONAS.find((candidate) => candidate.id === wanted) ?? null;
}

export function testPersonaIds(): string[] {
  return TEST_PERSONAS.map((entry) => entry.id);
}

import type { SharedAnswers } from "@/lib/firms/answers";

/**
 * How urgent a firm client's case looks, from the deadline answers they gave
 * in setup (openspec change add-lead-urgency-ranking).
 *
 * Fixed rules, no AI: the same answers always give the same tier and reason,
 * and evals/firms/urgency.check.ts pins every cutoff. This file must stay a
 * pure function of the firm's shared answers and today's date. It takes no
 * database or network access (check:firm-isolation enforces that), so it can
 * never reveal anything from a client's chats.
 *
 * Day counts are whole calendar days in UTC. It's a heads-up for the lawyer,
 * not a legal calculation, and the dashboard says so.
 */

export type UrgencyTier = "urgent" | "soon" | "later" | "unknown";

export type UrgencyEventKind = "status" | "grace" | "agency" | "travel";

export type UrgencyEvent = {
  kind: UrgencyEventKind;
  date: string;
  daysLeft: number;
  reason: string;
};

export type Urgency = {
  tier: UrgencyTier;
  daysLeft: number | null;
  reason: string;
  events: UrgencyEvent[];
};

export const GRACE_PERIOD_DAYS = 60;

/** Days left at or under which each kind of date makes a client URGENT. */
export const URGENT_CUTOFF_DAYS: Record<UrgencyEventKind, number> = {
  agency: 14,
  travel: 14,
  grace: 15,
  status: 30
};

/** Days left at or under which any date makes a client SOON. */
export const SOON_CUTOFF_DAYS = 90;

export const TIER_LABEL: Record<UrgencyTier, string> = {
  urgent: "Urgent",
  soon: "Soon",
  later: "Later",
  unknown: "Unknown"
};

export const UNKNOWN_REASON = "No dates given, ask about deadlines";

const AGENCY_LABEL: Record<string, string> = {
  rfe: "RFE response due",
  interview: "Interview on",
  biometrics: "Biometrics appointment on",
  other: "USCIS deadline"
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** A YYYY-MM-DD answer as a UTC day number, or null if it isn't a real date. */
export function parseDay(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // Reject dates that roll over, such as 2026-02-31.
  if (new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return Math.round(ms / DAY_MS);
}

function todayDay(today: Date) {
  return Math.floor(today.getTime() / DAY_MS);
}

function dayToIso(day: number) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function formatDay(day: number, today: number) {
  const date = new Date(day * DAY_MS);
  const sameYear = date.getUTCFullYear() === new Date(today * DAY_MS).getUTCFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC"
  });
}

function countdown(daysLeft: number) {
  if (daysLeft === 0) return "today";
  const n = Math.abs(daysLeft);
  const unit = n === 1 ? "day" : "days";
  return daysLeft > 0 ? `${n} ${unit}` : `${n} ${unit} ago`;
}

function answer(answers: SharedAnswers, key: string): string | undefined {
  const value = (answers as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/** Every date in the client's deadline answers, soonest first. */
export function urgencyEvents(answers: SharedAnswers, today: Date): UrgencyEvent[] {
  const now = todayDay(today);
  const events: UrgencyEvent[] = [];

  const statusEnd = parseDay(answer(answers, "statusEndDate"));
  if (statusEnd !== null) {
    const daysLeft = statusEnd - now;
    const verb = daysLeft < 0 ? "Status ended" : "Status ends";
    events.push({ kind: "status", date: dayToIso(statusEnd), daysLeft, reason: `${verb} ${formatDay(statusEnd, now)} (${countdown(daysLeft)})` });
  }

  const lastDay = answer(answers, "jobEnded") === "yes" ? parseDay(answer(answers, "lastWorkDay")) : null;
  if (lastDay !== null) {
    const graceEnd = lastDay + GRACE_PERIOD_DAYS;
    const daysLeft = graceEnd - now;
    const lead = lastDay <= now ? `Laid off ${formatDay(lastDay, now)}` : `Job ends ${formatDay(lastDay, now)}`;
    const verb = daysLeft < 0 ? "grace period ended" : "grace period ends";
    events.push({ kind: "grace", date: dayToIso(graceEnd), daysLeft, reason: `${lead}, ${verb} ${formatDay(graceEnd, now)} (${countdown(daysLeft)})` });
  }

  const agencyType = answer(answers, "agencyDeadlineType");
  const agencyDay = agencyType && AGENCY_LABEL[agencyType] ? parseDay(answer(answers, "agencyDeadlineDate")) : null;
  if (agencyType && agencyDay !== null) {
    const daysLeft = agencyDay - now;
    events.push({ kind: "agency", date: dayToIso(agencyDay), daysLeft, reason: `${AGENCY_LABEL[agencyType]} ${formatDay(agencyDay, now)} (${countdown(daysLeft)})` });
  }

  // A trip that's already happened isn't a deadline any more.
  const travelDay = answer(answers, "travelPlanned") === "yes" ? parseDay(answer(answers, "travelDate")) : null;
  if (travelDay !== null && travelDay >= now) {
    const daysLeft = travelDay - now;
    events.push({ kind: "travel", date: dayToIso(travelDay), daysLeft, reason: `Travel on ${formatDay(travelDay, now)} (${countdown(daysLeft)})` });
  }

  return events.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function rankUrgency(answers: SharedAnswers | null | undefined, today: Date = new Date()): Urgency {
  const events = urgencyEvents(answers ?? {}, today);
  if (events.length === 0) return { tier: "unknown", daysLeft: null, reason: UNKNOWN_REASON, events };

  const soonest = events[0];
  const urgent = events.some((e) => e.daysLeft < 0 || e.daysLeft <= URGENT_CUTOFF_DAYS[e.kind]);
  const tier: UrgencyTier = urgent ? "urgent" : soonest.daysLeft <= SOON_CUTOFF_DAYS ? "soon" : "later";
  // Name the date that made them urgent; otherwise the soonest one.
  const lead = urgent ? events.find((e) => e.daysLeft < 0 || e.daysLeft <= URGENT_CUTOFF_DAYS[e.kind]) ?? soonest : soonest;
  return { tier, daysLeft: lead.daysLeft, reason: lead.reason, events };
}

const TIER_ORDER: Record<UrgencyTier, number> = { urgent: 0, soon: 1, later: 2, unknown: 3 };

/**
 * Dashboard order: by tier, then fewest days left, then newest. Clients
 * still at "email sent" go after everyone else.
 */
export function compareByUrgency(
  a: { emailSent: boolean; urgency: Urgency; createdAt: string },
  b: { emailSent: boolean; urgency: Urgency; createdAt: string }
) {
  if (a.emailSent !== b.emailSent) return a.emailSent ? 1 : -1;
  const tier = TIER_ORDER[a.urgency.tier] - TIER_ORDER[b.urgency.tier];
  if (tier !== 0) return tier;
  const days = (a.urgency.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.urgency.daysLeft ?? Number.MAX_SAFE_INTEGER);
  if (days !== 0) return days;
  return b.createdAt.localeCompare(a.createdAt);
}

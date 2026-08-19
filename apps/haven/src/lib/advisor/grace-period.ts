/**
 * Where the person is in their 60 days, computed rather than guessed.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * The layoff date is the fact that changes more answers than anything else Haven
 * holds, and it was the one fact the Advisor could not see. `layoff_events` has
 * carried a real `layoff_date` since the Layoff War Room shipped — written when
 * somebody activates it — and nothing in the Advisor pipeline read the table. So
 * the bot knew *that* a person was laid off and never *when*, and had to hope they
 * retyped the date in every question.
 *
 * WHY THE ARITHMETIC IS DONE HERE AND NOT BY THE MODEL
 *
 * A language model asked to count 60 days from a date will usually get it right,
 * and "usually" is the problem: a deadline that is wrong by two days in the wrong
 * direction is worse than no deadline, because the person acts on it. This file
 * computes it once, in one place, and the model is handed the answer as a fact
 * rather than a calculation to perform. That is the same reason the visa bulletin
 * is never interpreted by the model either.
 *
 * WHAT THIS DELIBERATELY DOES NOT CLAIM
 *
 * Sixty days from the last day of employment is the *ceiling*, not the deadline.
 * 8 CFR 214.1(l)(2) makes it discretionary and caps it at the earlier of 60 days
 * or the end of the existing petition validity, and USCIS can shorten it. So every
 * rendering here is framed as "60 days from the date on file", which is a
 * statement about our arithmetic, and never as "your status ends on". The
 * shortening caveat is carried by GR_LAYOFF_SAFETY_RULES, which fires on exactly
 * the questions this appears in.
 *
 * The date itself is the user's, from a form they filled in. If it is wrong,
 * everything below is wrong, which is why `renderGracePeriodForPrompt` names the
 * source date so the answer can invite a correction.
 */

/** The statutory ceiling. Not the deadline — see the note above. */
export const GRACE_PERIOD_DAYS = 60;

export interface GracePeriodRead {
  /** The last day of employment, as stored. ISO date, no time. */
  layoffDate: string;
  /** 60 days after it. ISO date. */
  graceEndDate: string;
  /**
   * Which day of the grace period today is, counting the day after the layoff as
   * day 1 — the way people count it to each other, and the way the corpus counts
   * it ("I'm on day 42").
   */
  dayNumber: number;
  /** Days left, inclusive of today. Zero or negative once the ceiling has passed. */
  daysRemaining: number;
  expired: boolean;
}

function toUtcDate(value: string): Date | null {
  // Date-only strings are the stored shape. Parsing them with an explicit UTC
  // midnight avoids the local-timezone shift that turns a layoff on the 1st into
  // the 31st for anybody west of Greenwich, which would move the deadline a day.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Read the grace period from a layoff date.
 *
 * `today` is injectable so the behaviour is testable without the calendar moving
 * underneath the test — the same reason the personas carry fixed dates.
 */
export function readGracePeriod(layoffDate: string | null | undefined, today: Date = new Date()): GracePeriodRead | null {
  if (!layoffDate) return null;

  const start = toUtcDate(layoffDate);
  if (!start) return null;

  const now = toUtcDate(toIsoDate(today));
  if (!now) return null;

  // A layoff date in the future is a data error, not a grace period. Returning
  // null keeps a mistyped year out of the prompt rather than reporting "day
  // -3,000", which reads like a bug in the answer and would be one.
  if (start.getTime() > now.getTime()) return null;

  const end = new Date(start.getTime() + GRACE_PERIOD_DAYS * 86_400_000);
  const elapsed = daysBetween(start, now);

  return {
    layoffDate: toIsoDate(start),
    graceEndDate: toIsoDate(end),
    dayNumber: elapsed,
    daysRemaining: GRACE_PERIOD_DAYS - elapsed,
    expired: elapsed > GRACE_PERIOD_DAYS
  };
}

/** Long-form dates, because "2026-10-13" in an answer reads like a database. */
function humanDate(iso: string): string {
  const parsed = toUtcDate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The block handed to the model.
 *
 * Written as findings rather than instructions, and every line names where the
 * number came from, so the model can attribute it and the user can correct it.
 * The expired case is stated plainly and without a verdict attached: whether
 * somebody is out of status depends on what was filed, which this module does not
 * know and must not imply.
 */
export function renderGracePeriodForPrompt(read: GracePeriodRead | null): string[] {
  if (!read) return [];

  const lines = [
    `Last day of employment on file: ${humanDate(read.layoffDate)}.`,
    `${GRACE_PERIOD_DAYS} days from that date is ${humanDate(read.graceEndDate)}.`
  ];

  if (read.expired) {
    lines.push(
      `That ${GRACE_PERIOD_DAYS}-day point passed ${Math.abs(read.daysRemaining)} day${Math.abs(read.daysRemaining) === 1 ? "" : "s"} ago; today is day ${read.dayNumber}.`,
      "Do not conclude from this alone that they are out of status — that depends on what was filed and when, which is not recorded here."
    );
  } else {
    lines.push(
      `Today is day ${read.dayNumber}, with ${read.daysRemaining} day${read.daysRemaining === 1 ? "" : "s"} remaining.`
    );
  }

  lines.push(
    "These dates are computed from the date on file, not stated by the user in this conversation. Use them, name the last-day date you used, and invite a correction if it looks wrong to them.",
    `The ${GRACE_PERIOD_DAYS} days is a ceiling that DHS may shorten, and it ends earlier if the existing petition validity or I-94 ends first — never present the computed date as a guaranteed deadline.`
  );

  return lines;
}

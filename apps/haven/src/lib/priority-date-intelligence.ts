import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/env";
import type {
  BulletinChargeability,
  BulletinPreferenceCategory,
  DerivedProfileSignals,
  ImmigrationProfile,
  PriorityDateHistoryPoint,
  PriorityDateIntelligence
} from "@/types/domain";
import type { Database } from "@/types/database";

type VisaBulletinRow = Database["public"]["Tables"]["visa_bulletin_entries"]["Row"];

const FALLBACK_VELOCITY_DAYS_PER_MONTH: Record<string, { label: string; days: number }> = {
  "EB-2:India": { label: "~2 weeks/month", days: 14 },
  "EB-3:India": { label: "~3 weeks/month", days: 21 }
};

/**
 * A bulletin older than this can no longer be presented as the current one.
 *
 * The Visa Bulletin is monthly, so anything past ~45 days means at least one
 * newer bulletin exists that we have not ingested.
 *
 * NOTE: the Advisor applies the same 45-day rule in its own bulletin module.
 * These two constants should be unified once PR #43 lands; until then they must
 * be changed together.
 */
export const BULLETIN_STALE_AFTER_DAYS = 45;

/**
 * Age of a bulletin, measured from the first of its month — a bulletin is "for"
 * August, so on August 20 the August bulletin is 19 days old.
 */
function bulletinAgeInDays(year: number, month: number) {
  const start = Date.UTC(year, month - 1, 1);
  return Math.max(Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)), 0);
}

/** Prefix a bulletin claim with its staleness, so the caveat travels with it. */
function withStalenessCaveat(position: string, isStale: boolean, bulletinLabel: string, ageDays: number) {
  if (!isStale) return position;
  return `${position} (Source data is stale: the newest bulletin Haven holds is ${bulletinLabel}, ${ageDays} days old. Treat this as unverified and confirm against the official Visa Bulletin.)`;
}

function mapPreferenceCategory(category: ImmigrationProfile["preferenceCategory"]): BulletinPreferenceCategory | null {
  if (category === "EB-2 NIW") return "EB-2";
  if (category === "EB-1" || category === "EB-2" || category === "EB-3") return category;
  return null;
}

function mapChargeability(countryOfBirth: string): BulletinChargeability {
  const normalized = countryOfBirth.trim().toLowerCase();
  if (normalized === "india") return "India";
  if (normalized === "china") return "China";
  if (normalized === "mexico") return "Mexico";
  if (normalized === "philippines") return "Philippines";
  return "All Chargeability";
}

function formatCutoffDate(input?: string | null) {
  if (!input) return undefined;
  return new Date(`${input}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function differenceInWholeMonths(laterDate: Date, earlierDate: Date) {
  let months =
    (laterDate.getUTCFullYear() - earlierDate.getUTCFullYear()) * 12 +
    (laterDate.getUTCMonth() - earlierDate.getUTCMonth());

  if (laterDate.getUTCDate() < earlierDate.getUTCDate()) {
    months -= 1;
  }

  return Math.max(months, 0);
}

/**
 * How far the person is from being able to act, said so it cannot be misread.
 *
 * This used to read "5 months ahead of cutoff", which sounds like good news and
 * means the opposite: their priority date is *later* than the cutoff, so the queue
 * has to move five more months before it reaches them. On a screen someone is
 * scanning while frightened, "ahead" is the wrong word in the wrong direction.
 */
function formatGapLabel(priorityDate: Date, cutoffDate: Date) {
  const months = differenceInWholeMonths(priorityDate, cutoffDate);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  const duration =
    years === 0
      ? `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`
      : `${years} year${years === 1 ? "" : "s"}, ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;

  return `the cutoff still has to move ${duration} to reach this priority date`;
}

function formatDurationLabel(totalMonths: number) {
  const clampedMonths = Math.max(totalMonths, 0);
  const years = Math.floor(clampedMonths / 12);
  const remainingMonths = clampedMonths % 12;

  if (years === 0) {
    return `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  }

  if (remainingMonths === 0) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }

  return `${years} year${years === 1 ? "" : "s"} and ${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
}

function calculateVelocity(historyRows: VisaBulletinRow[]) {
  const datedRows = historyRows
    .filter((row) => row.cutoff_date)
    .sort((left, right) =>
      left.bulletin_year === right.bulletin_year
        ? left.bulletin_month - right.bulletin_month
        : left.bulletin_year - right.bulletin_year
    );

  if (datedRows.length < 2) {
    return null;
  }

  const advances: number[] = [];

  for (let index = 1; index < datedRows.length; index += 1) {
    const previous = datedRows[index - 1];
    const current = datedRows[index];

    if (!previous.cutoff_date || !current.cutoff_date) continue;

    const previousDate = new Date(`${previous.cutoff_date}T00:00:00Z`);
    const currentDate = new Date(`${current.cutoff_date}T00:00:00Z`);
    const bulletinSpan =
      (current.bulletin_year - previous.bulletin_year) * 12 + (current.bulletin_month - previous.bulletin_month);

    if (bulletinSpan <= 0) continue;

    const dayAdvance = (currentDate.getTime() - previousDate.getTime()) / 86400000;
    if (dayAdvance > 0) {
      advances.push(dayAdvance / bulletinSpan);
    }
  }

  if (advances.length === 0) {
    return null;
  }

  const averageDays = advances.reduce((sum, value) => sum + value, 0) / advances.length;
  const averageWeeks = Math.max(1, Math.round((averageDays / 7) * 10) / 10);

  return {
    daysPerMonth: averageDays,
    label: `~${averageWeeks} week${averageWeeks === 1 ? "" : "s"}/month`
  };
}

function getFallbackVelocity(category: BulletinPreferenceCategory, country: BulletinChargeability) {
  return (
    FALLBACK_VELOCITY_DAYS_PER_MONTH[`${category}:${country}`] ?? {
      label: "~1 month/month",
      days: 30
    }
  );
}

/**
 * A rough window for when the cutoff might reach this priority date.
 *
 * Returns null rather than a number when the projection would not mean anything —
 * which is most of the time, and used not to be.
 *
 * The old version returned `centerYear - 1` to `centerYear + 3` with no floor,
 * which produced ranges like "2025-2029" in August 2026: a five-year window whose
 * first year had already happened. A person reads that as "it might already be my
 * turn", which is both wrong and the most consequential thing you can be wrong
 * about here.
 *
 * Two rules now:
 *
 * - The window never opens in the past. If the projection lands before the end of
 *   this year, the honest answer is that nobody can say, not a range with a
 *   comforting near edge.
 * - It is symmetric and narrower. The old spread was lopsided toward optimism for
 *   no stated reason; a plus-or-minus is at least an honest shape for a guess.
 */
function estimateCurrentRange(
  priorityDate: Date,
  latestBulletinYear: number,
  latestBulletinMonth: number,
  cutoffDate: Date,
  today: Date = new Date()
): string | null {
  const bulletinDate = new Date(Date.UTC(latestBulletinYear, latestBulletinMonth - 1, 1));
  const queueAgeDays = Math.max(0, (bulletinDate.getTime() - cutoffDate.getTime()) / 86400000);
  const projectedCurrentDate = new Date(priorityDate.getTime() + queueAgeDays * 86400000);

  const centerYear = projectedCurrentDate.getUTCFullYear();
  const thisYear = today.getUTCFullYear();

  // The projection has already been overtaken, so it says nothing about the
  // future. Silence is the correct output.
  if (centerYear <= thisYear) return null;

  const from = Math.max(centerYear - 1, thisYear + 1);
  return `${from}\u2013${centerYear + 1}`;
}

function buildHistoryPoints(rows: VisaBulletinRow[]): PriorityDateHistoryPoint[] {
  return rows
    .sort((left, right) =>
      left.bulletin_year === right.bulletin_year
        ? left.bulletin_month - right.bulletin_month
        : left.bulletin_year - right.bulletin_year
    )
    .map((row) => ({
      label: monthLabel(row.bulletin_year, row.bulletin_month),
      cutoffLabel: row.cutoff_label,
      cutoffDate: row.cutoff_date ?? undefined,
      cutoffTimestamp: row.cutoff_date ? new Date(`${row.cutoff_date}T00:00:00Z`).getTime() : undefined
    }));
}

export function getPriorityDateSignalOverrides(
  intelligence: PriorityDateIntelligence | null
): Pick<DerivedProfileSignals, "visaBulletinPosition" | "estimatedGreenCardDateRange"> | null {
  if (!intelligence) return null;

  return {
    visaBulletinPosition: intelligence.visaBulletinPosition,
    estimatedGreenCardDateRange: intelligence.estimatedGreenCardDateRange
  };
}

export async function getPriorityDateIntelligence(
  profile: ImmigrationProfile
): Promise<PriorityDateIntelligence | null> {
  const category = mapPreferenceCategory(profile.preferenceCategory);
  if (!hasSupabaseEnv || !profile.priorityDate || !category) {
    return null;
  }

  const country = mapChargeability(profile.countryOfBirth);
  const admin = createSupabaseAdminClient();

  const { data: rows, error } = await admin
    .from("visa_bulletin_entries")
    .select("*")
    .eq("category", category)
    .eq("country", country)
    .order("bulletin_year", { ascending: false })
    .order("bulletin_month", { ascending: false })
    .limit(12);

  if (error || !rows || rows.length === 0) {
    return null;
  }

  const latest = rows[0];
  const historyPoints = buildHistoryPoints(rows);
  const priorityDate = new Date(`${profile.priorityDate}T00:00:00Z`);
  const latestCutoffDate = latest.cutoff_date ? new Date(`${latest.cutoff_date}T00:00:00Z`) : null;
  const isCurrent = latestCutoffDate ? priorityDate.getTime() <= latestCutoffDate.getTime() : latest.cutoff_label === "C";
  const velocity =
    calculateVelocity(rows) ?? {
      daysPerMonth: getFallbackVelocity(category, country).days,
      label: getFallbackVelocity(category, country).label
    };

  const latestBulletinLabel = monthLabel(latest.bulletin_year, latest.bulletin_month);
  const bulletinAgeDays = bulletinAgeInDays(latest.bulletin_year, latest.bulletin_month);
  const isStale = bulletinAgeDays > BULLETIN_STALE_AFTER_DAYS;
  const latestCutoffLabel =
    latest.cutoff_label === "C"
      ? "Current"
      : latest.cutoff_label === "U"
        ? "Unavailable"
        : formatCutoffDate(latest.cutoff_date) ?? latest.cutoff_label;

  if (isCurrent) {
    return {
      category,
      country,
      latestBulletinLabel,
      latestCutoffLabel,
      latestCutoffDate: latest.cutoff_date ?? undefined,
      sourceUrl: latest.source_url,
      sourcePulledAt: latest.created_at ?? undefined,
      bulletinAgeDays,
      isStale,
      isCurrent: true,
      velocityLabel: velocity.label,
      historyPoints,
      visaBulletinPosition: withStalenessCaveat(
        `${category} ${country} is current under the ${latestBulletinLabel} final action dates bulletin.`,
        isStale,
        latestBulletinLabel,
        bulletinAgeDays
      ),
      estimateLabel: isStale
        ? `Your priority date was current under the ${latestBulletinLabel} bulletin. Confirm against the latest bulletin before acting.`
        : "Your priority date is already current under final action dates.",
      estimateDetails: ["No projection is needed because the latest official cutoff already covers your priority date."]
    };
  }

  if (!latestCutoffDate) {
    return {
      category,
      country,
      latestBulletinLabel,
      latestCutoffLabel,
      sourceUrl: latest.source_url,
      sourcePulledAt: latest.created_at ?? undefined,
      bulletinAgeDays,
      isStale,
      isCurrent: false,
      velocityLabel: velocity.label,
      historyPoints,
      visaBulletinPosition: withStalenessCaveat(
        `Latest ${category} ${country} final action label is ${latestCutoffLabel}. Haven needs a dated cutoff before it can estimate queue depth.`,
        isStale,
        latestBulletinLabel,
        bulletinAgeDays
      )
    };
  }

  const gapLabel = formatGapLabel(priorityDate, latestCutoffDate);
  const bulletinDate = new Date(Date.UTC(latest.bulletin_year, latest.bulletin_month - 1, 1));
  const queueDepthMonths = differenceInWholeMonths(bulletinDate, latestCutoffDate);
  const queueDepthLabel = formatDurationLabel(queueDepthMonths);
  const estimatedGreenCardDateRange = estimateCurrentRange(
    priorityDate,
    latest.bulletin_year,
    latest.bulletin_month,
    latestCutoffDate
  );

  return {
    category,
    country,
    latestBulletinLabel,
    latestCutoffLabel,
    latestCutoffDate: latest.cutoff_date ?? undefined,
    sourceUrl: latest.source_url,
    sourcePulledAt: latest.created_at ?? undefined,
    bulletinAgeDays,
    isStale,
    isCurrent: false,
    gapLabel,
    velocityLabel: velocity.label,
    // The projection is anchored to the newest bulletin we hold. When that anchor
    // is months old the range is measured from the wrong starting point, so the
    // caveat travels with the value — this string is also injected into the
    // Advisor's prompt as a derived signal.
    //
    // And when the projection has already been overtaken by the calendar it is
    // dropped entirely rather than shown with a caveat. A range whose near edge is
    // in the past reads as "it might already be my turn", and no wording placed
    // next to it undoes that.
    estimatedGreenCardDateRange: !estimatedGreenCardDateRange
      ? undefined
      : isStale
        ? `${estimatedGreenCardDateRange} (projected from the ${latestBulletinLabel} bulletin, ${bulletinAgeDays} days old)`
        : estimatedGreenCardDateRange,
    estimateLabel: !estimatedGreenCardDateRange
      ? `Haven cannot project a date from the ${latestBulletinLabel} bulletin — it is ${bulletinAgeDays} days old and the estimate it produces has already been overtaken. Use the current bulletin instead.`
      : isStale
        ? `At ${velocity.label} average pace, current around ${estimatedGreenCardDateRange} — but this projects from the ${latestBulletinLabel} bulletin, which is ${bulletinAgeDays} days old.`
        : `At ${velocity.label} average pace, current around ${estimatedGreenCardDateRange}.`,
    estimateDetails: [
      ...(isStale
        ? [
            `Haven has not ingested a bulletin since ${latestBulletinLabel}. Newer bulletins have been published, so the starting point below is out of date and the projection may be materially wrong.`
          ]
        : []),
      `Haven starts with the ${latestBulletinLabel} final action bulletin and its cutoff of ${latestCutoffLabel}. That places the queue at that time about ${queueDepthLabel} deep.`,
      `It then uses the recent bulletin movement average of ${velocity.label} to project how long it may take for the cutoff to reach your priority date.`,
      ...(estimatedGreenCardDateRange
        ? [
            `The ${estimatedGreenCardDateRange} range is intentionally wide because bulletin movement can speed up, stall, or retrogress from month to month.`
          ]
        : [
            `No range is shown because projecting from a bulletin this old produces a window that has already partly passed, which would be worse than saying nothing.`
          ])
    ],
    visaBulletinPosition: withStalenessCaveat(
      `${category} ${country} cutoff is ${latestCutoffLabel} as of the ${latestBulletinLabel} bulletin. You are ${gapLabel}.`,
      isStale,
      latestBulletinLabel,
      bulletinAgeDays
    ),
    historyPoints
  };
}

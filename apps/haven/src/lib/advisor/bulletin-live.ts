import { hasSupabaseEnv } from "@/lib/env";
import { getPriorityDateIntelligence } from "@/lib/priority-date-intelligence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImmigrationProfile } from "@/types/domain";

/**
 * Live visa bulletin access for the Advisor.
 *
 * The weekly `/api/internal/sync-bulletin` cron scrapes the State Department
 * bulletin into `visa_bulletin_entries`. The dashboard and timeline have always
 * read it; the Advisor did not, and answered from a hardcoded corpus snapshot
 * instead. This module is the bridge.
 *
 * Same rule as case statistics: SQL computes, the model only phrases. Cutoff
 * dates and "is my date current" are read from the table and stated verbatim.
 * The model is never asked to derive, compare, or project a bulletin date.
 */

export interface LiveBulletinSnapshot {
  /** e.g. "August 2026" — the newest bulletin month present in the table. */
  bulletinLabel: string;
  bulletinYear: number;
  bulletinMonth: number;
  /** When the sync job last wrote a row for that bulletin. */
  pulledAt: string | null;
  sourceUrl: string | null;
  /** Age of the bulletin month itself, in days — the real staleness signal. */
  ageDays: number;
}

interface SnapshotCache {
  snapshot: LiveBulletinSnapshot | null;
  checkedAt: number;
}

// The sync runs weekly, so a short cache costs nothing in freshness and keeps
// the Advisor from querying on every turn.
const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

// A bulletin older than this means the weekly sync has failed repeatedly. The
// sync itself only alerts when it runs and fails; if it stops running, or is
// rejected upstream, nothing fires. This is the read-side backstop.
const SYNC_FAILURE_ALERT_DAYS = 60;

let snapshotCache: SnapshotCache | null = null;
let staleSyncReported = false;

/**
 * Alert once per process when the bulletin feed has clearly stopped updating.
 *
 * The April 2026 outage went unnoticed for four months precisely because a
 * silent feed produces no signal — the table still had rows, so every reader
 * looked healthy while serving steadily older data.
 */
async function reportStaleSyncOnce(snapshot: LiveBulletinSnapshot) {
  if (staleSyncReported || snapshot.ageDays <= SYNC_FAILURE_ALERT_DAYS) {
    return;
  }
  staleSyncReported = true;

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureMessage(
      `visa bulletin feed is stale: newest held bulletin is ${snapshot.bulletinLabel} (${snapshot.ageDays} days old). ` +
        "The weekly sync-bulletin cron is not landing new data; Advisor is refusing month-specific bulletin conclusions.",
      "error"
    );
  } catch {
    // Never let observability failure break an answer.
  }
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Newest bulletin we actually hold, independent of any user profile.
 *
 * Returns null when Supabase is unconfigured, the table is empty, or the query
 * fails. Callers must treat null as "no live data" and fall back to the
 * hardcoded corpus date — never as "fresh".
 */
export async function getLiveBulletinSnapshot(): Promise<LiveBulletinSnapshot | null> {
  if (snapshotCache && Date.now() - snapshotCache.checkedAt < SNAPSHOT_TTL_MS) {
    return snapshotCache.snapshot;
  }

  if (!hasSupabaseEnv) {
    return null;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin
      .from("visa_bulletin_entries")
      .select("bulletin_year, bulletin_month, created_at, source_url")
      .order("bulletin_year", { ascending: false })
      .order("bulletin_month", { ascending: false })
      .limit(1);

    if (error || !rows || rows.length === 0) {
      snapshotCache = { snapshot: null, checkedAt: Date.now() };
      return null;
    }

    const latest = rows[0];
    // Age is measured from the first of the bulletin month: a bulletin is
    // "for" August, so on 2026-08-20 the August bulletin is 19 days old.
    const bulletinStart = Date.UTC(latest.bulletin_year, latest.bulletin_month - 1, 1);
    const snapshot: LiveBulletinSnapshot = {
      bulletinLabel: monthLabel(latest.bulletin_year, latest.bulletin_month),
      bulletinYear: latest.bulletin_year,
      bulletinMonth: latest.bulletin_month,
      pulledAt: latest.created_at ?? null,
      sourceUrl: latest.source_url ?? null,
      ageDays: Math.floor((Date.now() - bulletinStart) / (1000 * 60 * 60 * 24))
    };

    snapshotCache = { snapshot, checkedAt: Date.now() };
    void reportStaleSyncOnce(snapshot);
    return snapshot;
  } catch {
    return snapshotCache?.snapshot ?? null;
  }
}

/** Test seam — the module-level cache would otherwise leak across cases. */
export function resetLiveBulletinCache() {
  snapshotCache = null;
  staleSyncReported = false;
}

/**
 * Prompt lines describing what we hold and how current it is.
 *
 * Always emitted for bulletin questions, including when nothing live exists —
 * the absence of data is itself something the model must know about, so it can
 * say so instead of implying its corpus snapshot is current.
 */
export function renderBulletinFreshnessForPrompt(
  snapshot: LiveBulletinSnapshot | null,
  corpusEffectiveDate: string | null
): string[] {
  if (!snapshot) {
    return [
      "No live visa bulletin data is available.",
      corpusEffectiveDate
        ? `The only bulletin material on hand is a static snapshot dated ${corpusEffectiveDate}.`
        : "The only bulletin material on hand is a static snapshot with no stated date.",
      "Say plainly that you cannot confirm the current month's bulletin, and point the user to travel.state.gov."
    ];
  }

  const lines = [
    `Latest bulletin held: ${snapshot.bulletinLabel} (${snapshot.ageDays} days old).`,
    snapshot.pulledAt
      ? `Retrieved from the State Department ${daysSince(snapshot.pulledAt)} day(s) ago.`
      : "Retrieval date unknown."
  ];

  if (snapshot.sourceUrl) {
    lines.push(`Source: ${snapshot.sourceUrl}`);
  }

  lines.push(
    "State this month by name when the answer depends on the bulletin, so the user knows which bulletin you used."
  );

  return lines;
}

/**
 * The user's actual position under the latest bulletin, computed in SQL.
 *
 * Written as sentences addressed to the reader, not as a record about them. The
 * first version was a labelled data sheet — "Category/country: …", "Latest
 * bulletin: …", "This user's priority date is NOT yet current" — carrying the
 * instruction "state them exactly as written". The instruction was meant to stop
 * the model computing its own cutoff dates, which is the one thing it must never
 * do here. The model obeyed it literally and pasted the whole sheet into the
 * answer, third-person label included, so a real user read a paragraph of Haven's
 * internal notes discussing them as "this user".
 *
 * Both goals survive if the block is already in the voice the answer needs: the
 * figures still cannot be recomputed, because there is nothing to recompute from,
 * and quoting the block now produces a sentence rather than a database row.
 *
 * Returns null when the profile lacks a priority date or category, or when no live
 * data covers their category/country.
 */
export async function renderBulletinPositionForPrompt(
  profile: ImmigrationProfile
): Promise<string[] | null> {
  const intelligence = await getPriorityDateIntelligence(profile);
  if (!intelligence) {
    return null;
  }

  const position = intelligence.isCurrent
    ? `Their priority date is current under the ${intelligence.latestBulletinLabel} final action dates for ${intelligence.category} ${intelligence.country}, where the cutoff is ${intelligence.latestCutoffLabel}.`
    : `Their priority date is not current yet. Under the ${intelligence.latestBulletinLabel} final action dates for ${intelligence.category} ${intelligence.country}, the cutoff is ${intelligence.latestCutoffLabel}${intelligence.gapLabel ? ` — ${intelligence.gapLabel}` : ""}.`;

  const lines = [position];

  if (intelligence.estimateLabel) {
    lines.push(`Haven's own rough estimate, which is not official and not a promise: ${intelligence.estimateLabel}`);
  }

  lines.push(
    "Use these numbers as written. Never work out a cutoff date, a gap, or a projection of your own — every figure here came from the official bulletin table and yours would not.",
    "Write them into your answer as ordinary sentences addressed to the person. Do not reproduce these lines as a labelled list, and never refer to them in the third person: they are reading this.",
    "A final action date governs approval, not filing — do not tell them they may file based on this alone."
  );

  return lines;
}

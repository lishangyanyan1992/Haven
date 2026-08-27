import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Weekly answer-health check.
 *
 * Every advisor turn already records what it did: which guardrails fired
 * (`guardrailsFired`, including the post-generation safety addendum), whether
 * the question was understood (`classification`), whether it was a distress
 * disclosure (`moderationDistress`), and how long the answer ran
 * (`answerWords`). All of it lands in Langfuse and, until now, nothing read it
 * back. Recording is not monitoring: the two existing advisor alerts both watch
 * *inputs* going stale (the bulletin feed, the summaries table), and nothing
 * watched answers going wrong.
 *
 * So this reads the week's traces and compares them with the week before. It
 * deliberately alerts on *movement* rather than on absolute levels — the right
 * standing value for the safety-net fire rate is genuinely unknown and depends
 * on the current prompt, but a rate that doubles between two Mondays is a
 * regression whatever the baseline was.
 *
 * Read-only. It changes nothing and can be run by hand safely.
 */

const LOOKBACK_DAYS = 7;
const TRACE_PAGE_LIMIT = 100;
const MAX_PAGES = 10;

// Relative movement that is worth a message. Chosen to be quiet: a weekly job
// that cries wolf gets muted, and a muted alert is worse than no alert.
const RATE_JUMP_RATIO = 1.5;
// Below this many turns the percentages are noise, so comparisons are skipped.
const MIN_SAMPLE = 20;
// Written complaints are read by a person, so the report carries a readable
// number of them rather than the whole week's worth.
const MAX_REPORTED_COMPLAINTS = 10;

type TraceMetadata = {
  guardrailsFired?: unknown;
  classification?: unknown;
  moderationDistress?: unknown;
  answerWords?: unknown;
};

type Window = {
  turns: number;
  patched: number;
  unmatched: number;
  distress: number;
  answerWords: number[];
};

function emptyWindow(): Window {
  return { turns: 0, patched: 0, unmatched: 0, distress: 0, answerWords: [] };
}

function rate(part: number, whole: number) {
  return whole > 0 ? part / whole : 0;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

type FeedbackWindow = {
  total: number;
  down: number;
  complaints: Array<{ at: string; text: string }>;
};

function emptyFeedbackWindow(): FeedbackWindow {
  return { total: 0, down: 0, complaints: [] };
}

/**
 * Read the ratings people left on answers.
 *
 * These are also scored into Langfuse, but a score there is only found by
 * someone who goes looking. A downvote with a written reason is the most
 * actionable signal the Advisor produces, so it belongs in the report that
 * already gets sent when something looks wrong.
 */
async function fetchFeedback(fromISO: string, toISO: string): Promise<FeedbackWindow> {
  const window = emptyFeedbackWindow();

  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin
      .from("advisor_feedback")
      .select("rating, feedback_text, created_at")
      .gte("created_at", fromISO)
      .lt("created_at", toISO)
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) return window;

    for (const row of data as Array<{ rating: number; feedback_text: string | null; created_at: string }>) {
      window.total += 1;
      if (row.rating > 0) continue;

      window.down += 1;
      const text = row.feedback_text?.trim();
      if (text && window.complaints.length < MAX_REPORTED_COMPLAINTS) {
        window.complaints.push({ at: row.created_at, text });
      }
    }
  } catch {
    // A feedback read failing should not take down the rest of the check.
  }

  return window;
}

/**
 * Fetch traces from the Langfuse public API.
 *
 * The SDK client is a writer; reading back is a plain authenticated GET, so this
 * avoids adding a dependency for one query.
 */
async function fetchTraces(fromISO: string, toISO: string) {
  const baseUrl = env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com";
  const auth = Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString("base64");
  const collected: Array<{ metadata?: TraceMetadata }> = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL("/api/public/traces", baseUrl);
    url.searchParams.set("fromTimestamp", fromISO);
    url.searchParams.set("toTimestamp", toISO);
    url.searchParams.set("limit", String(TRACE_PAGE_LIMIT));
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: { authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Langfuse traces API returned ${response.status}`);
    }

    const body = (await response.json()) as { data?: Array<{ metadata?: TraceMetadata }> };
    const batch = body.data ?? [];
    collected.push(...batch);
    if (batch.length < TRACE_PAGE_LIMIT) break;
  }

  return collected;
}

function summarize(traces: Array<{ metadata?: TraceMetadata }>): Window {
  const window = emptyWindow();

  for (const trace of traces) {
    const meta = trace.metadata;
    // Only advisor answer turns carry `classification`; ingestion and other
    // projects' traces are skipped rather than counted as healthy turns.
    if (!meta || typeof meta.classification !== "string") continue;

    window.turns += 1;
    if (Array.isArray(meta.guardrailsFired) && meta.guardrailsFired.length > 0) window.patched += 1;
    if (meta.classification === "unmatched") window.unmatched += 1;
    if (meta.moderationDistress === true) window.distress += 1;
    if (typeof meta.answerWords === "number") window.answerWords.push(meta.answerWords);
  }

  return window;
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const authHeader = request.headers.get("authorization");
    const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!provided || provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
    return NextResponse.json({ ok: false, skipped: "langfuse_not_configured" }, { status: 200 });
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const thisWeekFrom = new Date(now - LOOKBACK_DAYS * day).toISOString();
  const lastWeekFrom = new Date(now - 2 * LOOKBACK_DAYS * day).toISOString();

  try {
    const nowISO = new Date(now).toISOString();
    const [thisWeekTraces, lastWeekTraces, feedbackNow, feedbackPrev] = await Promise.all([
      fetchTraces(thisWeekFrom, nowISO),
      fetchTraces(lastWeekFrom, thisWeekFrom),
      fetchFeedback(thisWeekFrom, nowISO),
      fetchFeedback(lastWeekFrom, thisWeekFrom)
    ]);

    const current = summarize(thisWeekTraces);
    const previous = summarize(lastWeekTraces);

    const report = {
      window: { days: LOOKBACK_DAYS, from: thisWeekFrom },
      current: {
        turns: current.turns,
        safetyNetFireRate: rate(current.patched, current.turns),
        unmatchedRate: rate(current.unmatched, current.turns),
        distressTurns: current.distress,
        medianAnswerWords: median(current.answerWords),
        ratings: feedbackNow.total,
        downvotes: feedbackNow.down,
        downvoteRate: rate(feedbackNow.down, feedbackNow.total),
        complaints: feedbackNow.complaints
      },
      previous: {
        turns: previous.turns,
        safetyNetFireRate: rate(previous.patched, previous.turns),
        unmatchedRate: rate(previous.unmatched, previous.turns),
        distressTurns: previous.distress,
        medianAnswerWords: median(previous.answerWords),
        ratings: feedbackPrev.total,
        downvotes: feedbackPrev.down,
        downvoteRate: rate(feedbackPrev.down, feedbackPrev.total)
      },
      alerts: [] as string[]
    };

    const comparable = current.turns >= MIN_SAMPLE && previous.turns >= MIN_SAMPLE;

    if (comparable) {
      const fireNow = report.current.safetyNetFireRate;
      const firePrev = report.previous.safetyNetFireRate;
      if (firePrev > 0 && fireNow >= firePrev * RATE_JUMP_RATIO) {
        report.alerts.push(
          `Safety-net fire rate rose from ${pct(firePrev)} to ${pct(fireNow)} week over week. ` +
            "Every fire is the prompt failing to produce required safety language on its own, so a jump " +
            "usually means a recent prompt or model change regressed it."
        );
      }

      const missNow = report.current.unmatchedRate;
      const missPrev = report.previous.unmatchedRate;
      if (missPrev > 0 && missNow >= missPrev * RATE_JUMP_RATIO) {
        report.alerts.push(
          `Unrecognised-question rate rose from ${pct(missPrev)} to ${pct(missNow)}. ` +
            "These answers were built on default topics rather than a real match — read the traces to find " +
            "the phrasings or new subjects the classifier is missing."
        );
      }
    }

    // A downvote someone bothered to explain is the one signal here that names
    // its own fix, so it is reported on sight rather than waiting for a trend.
    if (feedbackNow.complaints.length > 0) {
      report.alerts.push(
        `${feedbackNow.complaints.length} explained downvote(s) on Advisor answers this week: ` +
          feedbackNow.complaints.map((item) => `"${item.text}"`).join(" | ")
      );
    } else if (feedbackNow.down > 0) {
      report.alerts.push(
        `${feedbackNow.down} downvote(s) on Advisor answers this week, none with a written reason.`
      );
    }

    // Distress is reported on its own terms, not as a week-over-week ratio: one
    // disclosure is worth knowing about, and it should never be averaged away.
    if (current.distress > 0) {
      report.alerts.push(
        `${current.distress} distress disclosure(s) reached the Advisor this week. ` +
          "Check that the crisis response is still the one qualified review approved."
      );
    }

    if (report.alerts.length > 0) {
      Sentry.captureMessage(`advisor answer health: ${report.alerts.join(" | ")}`, "warning");
      await Sentry.flush(2000);
    }

    return NextResponse.json({ ok: true, ...report }, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    Sentry.captureMessage(`advisor answer health check failed: ${detail}`, "error");
    await Sentry.flush(2000);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}

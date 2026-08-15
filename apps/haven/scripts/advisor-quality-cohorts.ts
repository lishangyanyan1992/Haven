/**
 * Advisor quality → Mixpanel cohorts.
 *
 * Connects the two systems that already know half the story each:
 *
 *   Langfuse  knows whether the Advisor did a good job on each question.
 *   Mixpanel  knows whether the person came back.
 *
 * Both label the same person with the same Supabase auth uid — Langfuse via
 * `trace.userId` (service.ts), Mixpanel via `mixpanel.identify(profile.id)`
 * (app-shell.tsx). So a per-user quality score computed here can be written
 * onto the Mixpanel People profile, and the ordinary Mixpanel Retention report
 * can then be broken down by it.
 *
 * Reads are always safe. Writing to Mixpanel requires an explicit --push;
 * without it the script prints what it would send and stops.
 *
 *   npm run advisor:cohorts              # dry run, prints the summary
 *   npm run advisor:cohorts -- --days 90 # widen the window (default 30)
 *   npm run advisor:cohorts -- --push    # actually write the People profiles
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(appRoot, "../..");

// ── Env ───────────────────────────────────────────────────────────────────────

function loadEnvValue(file: string, key: string): string | null {
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || match[1] !== key) continue;
    return match[2].replace(/^["']|["']$/g, "").trim() || null;
  }
  return null;
}

const ENV_KEYS = [
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_BASE_URL",
  "NEXT_PUBLIC_MIXPANEL_TOKEN",
  "MIXPANEL_API_HOST",
] as const;

for (const key of ENV_KEYS) {
  if (process.env[key]) continue;
  for (const file of [path.join(workspaceRoot, ".env.local"), path.join(appRoot, ".env.local")]) {
    const value = loadEnvValue(file, key);
    if (value) {
      process.env[key] = value;
      break;
    }
  }
}

const LANGFUSE_BASE = (process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com").replace(/\/$/, "");
const MIXPANEL_HOST = (process.env.MIXPANEL_API_HOST ?? "https://api.mixpanel.com").replace(/\/$/, "");

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const shouldPush = args.includes("--push");
const days = Number(args[args.indexOf("--days") + 1]) || 30;
const minQuestions = Number(args[args.indexOf("--min-questions") + 1]) || 1;

// ── Langfuse ──────────────────────────────────────────────────────────────────

type Trace = {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  timestamp: string;
  output?: unknown;
  metadata?: unknown;
};

type Score = { traceId: string; value: number; name: string };

function langfuseAuth(): string {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) {
    throw new Error(
      "Missing LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY (the haven-advisor project keys).\n" +
        "  These are set in Vercel but not in .env.local. Pull them with:\n" +
        "    vercel env pull .env.local\n" +
        "  or copy them from the Langfuse dashboard → haven-advisor → Settings → API Keys."
    );
  }
  return `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;
}

async function fetchAllPages<T>(pathname: string, params: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;

  for (;;) {
    const url = new URL(`${LANGFUSE_BASE}${pathname}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", "100");

    const response = await fetch(url, { headers: { Authorization: langfuseAuth() } });
    if (!response.ok) {
      throw new Error(`Langfuse ${pathname} failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { data: T[]; meta?: { totalPages?: number } };
    rows.push(...body.data);

    const totalPages = body.meta?.totalPages ?? 1;
    if (page >= totalPages) return rows;
    page += 1;
  }
}

/**
 * Langfuse Cloud times out a wide date range on the legacy traces endpoint, so
 * ask for one month at a time and stitch the results together.
 */
async function fetchWindowed<T>(
  pathname: string,
  params: Record<string, string>,
  fromMs: number,
  chunkDays = 30
): Promise<T[]> {
  const CHUNK_MS = chunkDays * 24 * 60 * 60 * 1000;
  const rows: T[] = [];

  for (let start = fromMs; start < Date.now(); start += CHUNK_MS) {
    const end = Math.min(start + CHUNK_MS, Date.now());
    rows.push(
      ...(await fetchAllPages<T>(pathname, {
        ...params,
        fromTimestamp: new Date(start).toISOString(),
        toTimestamp: new Date(end).toISOString(),
      }))
    );
  }

  return rows;
}

/** The scores endpoint moved to /v2 in later Langfuse versions; try it first. */
async function fetchScores(fromMs: number): Promise<Score[]> {
  for (const pathname of ["/api/public/v2/scores", "/api/public/scores"]) {
    try {
      return await fetchWindowed<Score>(pathname, { name: "user-feedback" }, fromMs);
    } catch (error) {
      if (pathname === "/api/public/scores") throw error;
    }
  }
  return [];
}

// ── Scoring ───────────────────────────────────────────────────────────────────

type UserStats = {
  userId: string;
  questions: number;
  badTurns: number;
  fallbacks: number;
  unmatched: number;
  uncited: number;
  thumbsDown: number;
  firstAt: string;
  lastAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * A turn is "bad" if the Advisor visibly failed the person, by any of the
 * signals the trace already records:
 *
 *   fallback              the answer wasn't grounded in retrieved knowledge
 *   classification        "unmatched" — the question wasn't understood at all
 *   citationCount === 0   nothing to cite, which the payload calls low confidence
 *   thumbs down           the person said so themselves
 */
function isBadTurn(trace: Trace, thumbedDown: boolean): boolean {
  const output = asRecord(trace.output);
  const metadata = asRecord(trace.metadata);

  return (
    thumbedDown ||
    output.fallback === true ||
    metadata.classification === "unmatched" ||
    Number(output.citationCount ?? 0) === 0
  );
}

function bucketFor(stats: UserStats): "good" | "mixed" | "bad" {
  const badRate = stats.badTurns / stats.questions;
  if (badRate >= 0.5) return "bad";
  if (badRate > 0.2) return "mixed";
  return "good";
}

// ── Mixpanel ──────────────────────────────────────────────────────────────────

type ProfileUpdate = { $token: string; $distinct_id: string; $set: Record<string, unknown> };

function buildProfileUpdates(stats: UserStats[], token: string): ProfileUpdate[] {
  return stats.map((user) => ({
    $token: token,
    $distinct_id: user.userId,
    $set: {
      advisor_quality: bucketFor(user),
      advisor_questions_total: user.questions,
      advisor_bad_answer_rate: Number((user.badTurns / user.questions).toFixed(2)),
      advisor_thumbs_down: user.thumbsDown,
      advisor_first_question_at: user.firstAt,
      advisor_last_question_at: user.lastAt,
    },
  }));
}

async function pushToMixpanel(updates: ProfileUpdate[]): Promise<void> {
  const BATCH = 200;

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const response = await fetch(`${MIXPANEL_HOST}/engage?verbose=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });

    const body = await response.text();
    if (!response.ok || !body.includes('"status": 1')) {
      throw new Error(`Mixpanel /engage failed on batch ${i / BATCH + 1}: ${response.status} ${body}`);
    }

    console.log(`  pushed ${Math.min(i + BATCH, updates.length)} / ${updates.length}`);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

/**
 * A rough return-rate straight from the Langfuse timestamps, so the split is
 * visible without waiting on Mixpanel. This is NOT the retention number —
 * it only sees people who used the Advisor, and only counts Advisor use as
 * "returning". Mixpanel's Retention report, broken down by `advisor_quality`,
 * is the real measure. Treat this as a smoke test of whether there's a signal
 * worth going to look at.
 */
function previewReturnRates(stats: UserStats[]): void {
  const buckets: Record<string, { total: number; returned: number }> = {
    good: { total: 0, returned: 0 },
    mixed: { total: 0, returned: 0 },
    bad: { total: 0, returned: 0 },
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  for (const user of stats) {
    const bucket = buckets[bucketFor(user)];
    bucket.total += 1;
    const span = new Date(user.lastAt).getTime() - new Date(user.firstAt).getTime();
    if (span >= DAY_MS) bucket.returned += 1;
  }

  console.log("\nRough return rate — came back on a later day to ask again:");
  console.log("(preview only; the real number is Mixpanel Retention split by advisor_quality)\n");
  for (const name of ["good", "mixed", "bad"] as const) {
    const { total, returned } = buckets[name];
    const pct = total > 0 ? Math.round((returned / total) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 4));
    console.log(
      `  ${name.padEnd(6)} ${String(total).padStart(4)} users   ${String(pct).padStart(3)}% ${bar}`
    );
  }

  const thin = stats.filter((user) => user.questions < 3).length;
  if (thin > 0) {
    console.log(
      `\n  Note: ${thin} of ${stats.length} users asked fewer than 3 questions. ` +
        "A bucket built on one or two answers is mostly noise."
    );
  }
}

function writeCsv(stats: UserStats[]): string {
  const dir = path.join(appRoot, "evals", "advisor", "reports");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `advisor-quality-cohorts-${new Date().toISOString().slice(0, 10)}.csv`);

  const header = "user_id,bucket,questions,bad_turns,bad_rate,fallbacks,unmatched,uncited,thumbs_down,first_at,last_at";
  const rows = stats.map((user) =>
    [
      user.userId,
      bucketFor(user),
      user.questions,
      user.badTurns,
      (user.badTurns / user.questions).toFixed(2),
      user.fallbacks,
      user.unmatched,
      user.uncited,
      user.thumbsDown,
      user.firstAt,
      user.lastAt,
    ].join(",")
  );

  fs.writeFileSync(file, [header, ...rows].join("\n"));
  return file;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const fromMs = Date.now() - days * 24 * 60 * 60 * 1000;
  console.log(`Reading advisor traces since ${new Date(fromMs).toISOString().slice(0, 10)} (${days} days)...`);

  const traces = await fetchWindowed<Trace>("/api/public/traces", { name: "advisor-session" }, fromMs);
  const scores = await fetchScores(fromMs);

  const thumbsDownTraces = new Set(scores.filter((score) => score.value === 0).map((score) => score.traceId));
  console.log(`  ${traces.length} traces, ${scores.length} feedback scores.`);

  const byUser = new Map<string, UserStats>();
  let anonymous = 0;

  for (const trace of traces) {
    // Mock identities are deliberately unlabelled in the trace, so they can't be
    // joined to a person and are excluded rather than lumped together.
    if (!trace.userId) {
      anonymous += 1;
      continue;
    }

    const output = asRecord(trace.output);
    const metadata = asRecord(trace.metadata);
    const thumbedDown = thumbsDownTraces.has(trace.id);

    const existing = byUser.get(trace.userId) ?? {
      userId: trace.userId,
      questions: 0,
      badTurns: 0,
      fallbacks: 0,
      unmatched: 0,
      uncited: 0,
      thumbsDown: 0,
      firstAt: trace.timestamp,
      lastAt: trace.timestamp,
    };

    existing.questions += 1;
    if (isBadTurn(trace, thumbedDown)) existing.badTurns += 1;
    if (output.fallback === true) existing.fallbacks += 1;
    if (metadata.classification === "unmatched") existing.unmatched += 1;
    if (Number(output.citationCount ?? 0) === 0) existing.uncited += 1;
    if (thumbedDown) existing.thumbsDown += 1;
    if (trace.timestamp < existing.firstAt) existing.firstAt = trace.timestamp;
    if (trace.timestamp > existing.lastAt) existing.lastAt = trace.timestamp;

    byUser.set(trace.userId, existing);
  }

  const stats = [...byUser.values()]
    .filter((user) => user.questions >= minQuestions)
    .sort((a, b) => b.questions - a.questions);

  if (anonymous > 0) {
    console.log(`  ${anonymous} traces had no userId (mock identities) and were skipped.`);
  }

  if (stats.length === 0) {
    console.log("\nNo identified advisor users in this window. Nothing to tag.");
    return;
  }

  const counts = { good: 0, mixed: 0, bad: 0 };
  for (const user of stats) counts[bucketFor(user)] += 1;

  console.log(`\n${stats.length} users bucketed:`);
  console.log(`  good   ${counts.good}   (bad-answer rate 20% or less)`);
  console.log(`  mixed  ${counts.mixed}   (21-49%)`);
  console.log(`  bad    ${counts.bad}   (50% or more)`);

  previewReturnRates(stats);

  const csv = writeCsv(stats);
  console.log(`\nPer-user detail written to ${path.relative(workspaceRoot, csv)}`);

  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) {
    console.log("\nNEXT_PUBLIC_MIXPANEL_TOKEN not set — skipping the Mixpanel step.");
    return;
  }

  const updates = buildProfileUpdates(stats, token);

  if (!shouldPush) {
    console.log(`\nDry run. Would set 6 properties on ${updates.length} Mixpanel People profiles.`);
    console.log("Example payload:");
    console.log(JSON.stringify({ ...updates[0], $token: "<token>" }, null, 2));
    console.log("\nRe-run with --push to write them.");
    return;
  }

  console.log(`\nPushing ${updates.length} profiles to Mixpanel...`);
  await pushToMixpanel(updates);
  console.log("Done. In Mixpanel: Retention report → Breakdown by advisor_quality.");
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

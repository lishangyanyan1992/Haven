import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// End-of-pipeline completeness checkpoint (daily cron): the July 2026 outage
// baked an empty /community page into the CDN and nothing noticed until a
// manual redeploy. This compares what the database holds against what the
// CDN is actually serving and alerts when they disagree.
//
// The page fetch sends the Haven-SmokeCheck user agent, which a Vercel
// firewall rule exempts from the bot challenge for /community only.
const SMOKE_USER_AGENT = "Haven-SmokeCheck/1.0";
const EMPTY_STATE_MARKER = "No posts match this filter yet";
const POST_MARKER = "Haven_User_";

export async function GET(request: Request) {
  // When CRON_SECRET is configured, Vercel attaches it to cron invocations and
  // we enforce it. Without it we still run: this check is read-only, returns
  // only information visible on the public page anyway, and a health check
  // that 503s until someone configures a secret is exactly the kind of silent
  // failure it exists to catch.
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    const authHeader = request.headers.get("authorization");
    const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const admin = createSupabaseAdminClient();
    const { count, error } = await admin.from("community_posts").select("id", { count: "exact", head: true });

    if (error) {
      // Supabase unreachable is its own (already-known) failure mode; the
      // smoke check only owns the DB-vs-CDN comparison.
      return NextResponse.json({ ok: false, skipped: "supabase_unreachable", detail: error.message }, { status: 200 });
    }

    const dbPosts = count ?? 0;
    const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://haven-h1b.com";
    const response = await fetch(`${siteUrl}/community`, {
      headers: { "user-agent": SMOKE_USER_AGENT },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store"
    });

    if (!response.ok) {
      Sentry.captureMessage(`community smoke check: page fetch returned ${response.status}`, "error");
      await Sentry.flush(2000);
      return NextResponse.json({ ok: false, dbPosts, pageStatus: response.status }, { status: 500 });
    }

    const html = await response.text();
    const pageShowsPosts = html.includes(POST_MARKER);
    const pageShowsEmptyState = html.includes(EMPTY_STATE_MARKER);

    if (dbPosts > 0 && !pageShowsPosts) {
      Sentry.captureMessage(
        `community smoke check FAILED: database has ${dbPosts} posts but /community serves ${
          pageShowsEmptyState ? "the empty state" : "no recognizable posts"
        } — likely a stale prerender; redeploy to fix`,
        "error"
      );
      await Sentry.flush(2000);
      return NextResponse.json({ ok: false, dbPosts, pageShowsPosts, pageShowsEmptyState }, { status: 500 });
    }

    return NextResponse.json({ ok: true, dbPosts, pageShowsPosts, checkedAt: new Date().toISOString() });
  } catch (error) {
    Sentry.captureMessage(
      `community smoke check errored: ${error instanceof Error ? error.message : "unknown"}`,
      "error"
    );
    await Sentry.flush(2000);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unknown" }, { status: 500 });
  }
}

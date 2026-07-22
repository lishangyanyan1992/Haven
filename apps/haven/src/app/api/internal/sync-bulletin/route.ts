import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";
import { sendVisaBulletinStatusUpdateEmails } from "@/lib/email-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchLatestVisaBulletin, type ParsedVisaBulletinResult } from "@/lib/visa-bulletin-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A full employment-based bulletin parses to ~40 rows; well under this floor
// means the State Dept page changed shape and the parser is returning garbage.
const MIN_EXPECTED_ENTRIES = 15;

// ETL quality checkpoints (timeliness + completeness). Returns a list of
// defects; an empty list means the parsed bulletin is safe to load.
function validateBulletin(bulletin: ParsedVisaBulletinResult): { hardFailures: string[]; warnings: string[] } {
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  // Completeness: enough rows, and the categories our users depend on exist.
  if (bulletin.entries.length < MIN_EXPECTED_ENTRIES) {
    hardFailures.push(`only ${bulletin.entries.length} entries parsed (expected >= ${MIN_EXPECTED_ENTRIES})`);
  }
  for (const category of ["EB-1", "EB-2", "EB-3"]) {
    if (!bulletin.entries.some((entry) => entry.category === category)) {
      hardFailures.push(`category ${category} missing from parsed bulletin`);
    }
  }

  // Timeliness: the "latest" bulletin must be the current or an upcoming
  // month. Anything older means the scrape found a stale page.
  const now = new Date();
  const monthDelta =
    bulletin.bulletinYear * 12 + (bulletin.bulletinMonth - 1) - (now.getUTCFullYear() * 12 + now.getUTCMonth());
  if (monthDelta < 0) {
    warnings.push(`parsed bulletin ${bulletin.bulletinLabel} is ${-monthDelta} month(s) behind the current month`);
  }

  return { hardFailures, warnings };
}

export async function GET(request: Request) {
  const expectedSecret = env.VISA_BULLETIN_SYNC_SECRET ?? process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "endpoint_not_configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bulletin = await fetchLatestVisaBulletin();

    const { hardFailures, warnings } = validateBulletin(bulletin);
    if (hardFailures.length > 0) {
      // Do not load defective data; surface loudly instead.
      Sentry.captureMessage(`visa bulletin sync failed quality checks: ${hardFailures.join("; ")}`, "error");
      await Sentry.flush(2000);
      return NextResponse.json(
        { error: "bulletin_failed_quality_checks", failures: hardFailures, sourceUrl: bulletin.sourceUrl },
        { status: 500 }
      );
    }
    if (warnings.length > 0) {
      Sentry.captureMessage(`visa bulletin sync warning: ${warnings.join("; ")}`, "warning");
      await Sentry.flush(2000);
    }

    const admin = createSupabaseAdminClient();

    const { error } = await admin.from("visa_bulletin_entries").upsert(
      bulletin.entries.map((entry) => ({
        bulletin_year: entry.bulletinYear,
        bulletin_month: entry.bulletinMonth,
        category: entry.category,
        country: entry.country,
        cutoff_label: entry.cutoffLabel,
        cutoff_date: entry.cutoffDate,
        source_url: entry.sourceUrl
      })),
      { onConflict: "bulletin_year,bulletin_month,category,country" }
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/timeline");

    const notificationResult = await sendVisaBulletinStatusUpdateEmails(bulletin);

    return NextResponse.json({
      syncedAt: new Date().toISOString(),
      bulletinLabel: bulletin.bulletinLabel,
      sourceUrl: bulletin.sourceUrl,
      entriesUpserted: bulletin.entries.length,
      qualityWarnings: warnings,
      emailNotifications: notificationResult
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync the visa bulletin." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { executeVisaBulletinSync } from "@/lib/visa-bulletin-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const result = await executeVisaBulletinSync();

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error,
        failures: result.hardFailures,
        sourceUrl: result.sourceUrl
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    syncedAt: result.syncedAt,
    bulletinLabel: result.bulletinLabel,
    sourceUrl: result.sourceUrl,
    entriesUpserted: result.entriesUpserted,
    qualityWarnings: result.qualityWarnings,
    emailNotifications: result.emailNotifications
  });
}

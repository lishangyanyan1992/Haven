import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { processReadingQueue } from "@/lib/document-context/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily pass of the document reader.
 *
 * New uploads are read straight after upload (see /api/files/sign). This picks
 * up what that path did not finish: documents deferred by the daily page cap and
 * reads that failed on a provider error.
 *
 * Unlike the read-only jobs next to it, this one spends money on every call, so
 * it refuses to run without CRON_SECRET rather than running open.
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!expectedSecret || provided !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const outcomes = await processReadingQueue();
    return NextResponse.json({ ok: true, outcomes });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

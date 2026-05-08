import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { submitIndexNowUrls } from "@/lib/indexnow";

export async function POST(request: NextRequest) {
  if (!env.INDEXNOW_SECRET) {
    return NextResponse.json({ ok: false, error: "INDEXNOW_SECRET is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken !== env.INDEXNOW_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { urls?: string[] } | null;

  if (!body?.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ ok: false, error: "Provide a non-empty urls array." }, { status: 400 });
  }

  const result = await submitIndexNowUrls(body.urls);
  const status = result.ok ? 200 : "reason" in result ? 400 : 502;

  return NextResponse.json(result, { status });
}

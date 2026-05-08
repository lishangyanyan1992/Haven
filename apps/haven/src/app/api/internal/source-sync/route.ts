import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { syncTrustedSources } from "@/lib/advisor/service";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = env.ADVISOR_SOURCE_SYNC_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncTrustedSources();
    return NextResponse.json({
      syncedAt: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync trusted sources." },
      { status: 500 }
    );
  }
}

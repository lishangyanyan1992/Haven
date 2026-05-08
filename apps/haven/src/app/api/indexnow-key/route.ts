import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export async function GET() {
  if (!env.INDEXNOW_KEY) {
    return new NextResponse("Not configured", { status: 404 });
  }

  return new NextResponse(env.INDEXNOW_KEY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

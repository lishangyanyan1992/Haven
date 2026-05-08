import { NextRequest, NextResponse } from "next/server";

import { signOutAction } from "@/server/auth-actions";

export async function POST(request: NextRequest) {
  const result = await signOutAction();
  return NextResponse.redirect(new URL(result.redirectTo, request.url), 303);
}

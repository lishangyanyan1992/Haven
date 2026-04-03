import { NextResponse } from "next/server";

import { respondToAdvisorMessage } from "@/lib/advisor/service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await respondToAdvisorMessage(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create advisor response." },
      { status: 500 }
    );
  }
}

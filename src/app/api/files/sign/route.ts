import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  label: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json();
  const payload = payloadSchema.parse(body);

  return NextResponse.json({
    message: "Haven V1 defers the full document vault. Use manual email forwarding and parsed-field confirmation instead.",
    requestedLabel: payload.label
  });
}

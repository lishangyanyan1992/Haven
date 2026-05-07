import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";

export const runtime = "nodejs";

interface VaccineItem {
  name: string;
  reason: string;
}

interface RequestBody {
  email: string;
  examDate: string;
  ageLabel: string;
  ageBucket: string;
  required: VaccineItem[];
}

function formatExamDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildEmailText(body: RequestBody): string {
  const { examDate, ageLabel, ageBucket, required } = body;

  const vaccineLines = required.map((v) => {
    const note = v.reason ? `\n     ${v.reason}` : "";
    return `  • ${v.name}${note}`;
  });

  const lines = [
    "Your USCIS I-693 vaccine checklist",
    "=".repeat(40),
    "",
    `Medical exam date: ${formatExamDate(examDate)}`,
    `Age at exam: ${ageLabel} (CDC age band: ${ageBucket})`,
    "",
    `${required.length} vaccine${required.length === 1 ? "" : "s"} required at your exam`,
    "-".repeat(40),
    ...vaccineLines,
    "",
    "Before your appointment",
    "-".repeat(40),
    "  • Bring written vaccine records — documented immunity can satisfy some requirements without another dose.",
    "  • Your civil surgeon reviews records, contraindications, and pregnancy status at the exam.",
    "  • Titer (blood test) results showing immunity are accepted for some vaccines in place of additional doses.",
    "",
    "Source: CDC Vaccination Technical Instructions for Civil Surgeons, Table 1 (effective March 11, 2025)",
    "https://www.cdc.gov/immigrant-refugee-health/hcp/civil-surgeons/vaccination.html",
    "",
    "—",
    "Haven · haven.app",
    "Your dates were calculated locally and are not stored.",
  ];

  return lines.join("\n");
}

async function sendMailgunEmail(to: string, subject: string, text: string) {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_SENDING_DOMAIN || !env.MAILGUN_FROM_EMAIL) {
    return { status: "skipped" as const };
  }

  const fromName = env.MAILGUN_FROM_NAME ?? env.NEXT_PUBLIC_APP_NAME ?? "Haven";
  const from = `${fromName} <${env.MAILGUN_FROM_EMAIL}>`;
  const endpoint = `https://api.mailgun.net/v3/${env.MAILGUN_SENDING_DOMAIN}/messages`;
  const auth = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64");

  const body = new URLSearchParams({ from, to, subject, text });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailgun error: ${response.status} ${errorText}`);
  }

  return { status: "sent" as const };
}

export async function POST(request: NextRequest) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { email, examDate, ageLabel, ageBucket, required } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (!examDate || !Array.isArray(required)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const text = buildEmailText({ email, examDate, ageLabel, ageBucket, required });
  const subject = `Your I-693 vaccine checklist — exam ${formatExamDate(examDate)}`;

  try {
    const result = await sendMailgunEmail(email, subject, text);
    return NextResponse.json({ status: result.status });
  } catch (err) {
    console.error("[vaccine-email] send failed:", err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
}

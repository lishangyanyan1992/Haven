import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { extractEmailFields } from "@/lib/email-extractor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");
  return expected === signature;
}

export async function POST(request: NextRequest) {
  const signingKey = env.MAILGUN_WEBHOOK_SIGNING_KEY;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const timestamp = String(formData.get("timestamp") ?? "");
  const token = String(formData.get("token") ?? "");
  const signature = String(formData.get("signature") ?? "");

  // Verify HMAC signature — 406 tells Mailgun not to retry
  if (signingKey) {
    if (!timestamp || !token || !signature) {
      return NextResponse.json({ error: "missing_signature_fields" }, { status: 406 });
    }
    if (!verifyMailgunSignature(signingKey, timestamp, token, signature)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 406 });
    }
  }

  const recipient = String(formData.get("recipient") ?? "").toLowerCase().trim();
  const sender = String(formData.get("sender") ?? formData.get("from") ?? "");
  const subject = String(formData.get("subject") ?? "");
  // Prefer stripped-text (Mailgun removes quoted replies); fall back to body-plain
  const body = String(
    formData.get("stripped-text") ?? formData.get("body-plain") ?? ""
  );

  if (!recipient) {
    return NextResponse.json({ status: "no_recipient" }, { status: 200 });
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    // Supabase not configured — accept gracefully
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Look up the alias
  const { data: aliasRow } = await (admin as any)
    .from("email_aliases")
    .select("user_id")
    .eq("alias", recipient)
    .maybeSingle();

  if (!aliasRow) {
    // Return 200 so Mailgun doesn't retry unknown aliases
    return NextResponse.json({ status: "unknown_alias" }, { status: 200 });
  }

  const userId: string = aliasRow.user_id;

  // Extract immigration fields with OpenAI
  const extraction = await extractEmailFields({ subject, body, sender });

  // Insert ingest record
  const { data: record, error: insertError } = await (admin as any)
    .from("email_ingest_records")
    .insert({
      user_id: userId,
      alias: recipient,
      source_type: extraction.sourceType,
      subject,
      received_at: new Date().toISOString(),
      status: "pending_confirmation",
    })
    .select("id")
    .single();

  if (insertError || !record) {
    console.error("[email-ingest] insert error", insertError);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Insert extracted fields
  if (extraction.fields.length > 0) {
    await (admin as any).from("email_extracted_fields").insert(
      extraction.fields.map((f) => ({
        record_id: record.id,
        label: f.label,
        value: f.value,
        confidence: f.confidence,
      }))
    );
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

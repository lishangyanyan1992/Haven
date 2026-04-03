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
    console.error("[email-ingest] failed to parse form data");
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const timestamp = String(formData.get("timestamp") ?? "");
  const token = String(formData.get("token") ?? "");
  const signature = String(formData.get("signature") ?? "");

  // Verify HMAC signature — 406 tells Mailgun not to retry
  if (signingKey) {
    if (!timestamp || !token || !signature) {
      console.error("[email-ingest] missing signature fields");
      return NextResponse.json({ error: "missing_signature_fields" }, { status: 406 });
    }
    if (!verifyMailgunSignature(signingKey, timestamp, token, signature)) {
      console.error("[email-ingest] invalid signature — check MAILGUN_WEBHOOK_SIGNING_KEY");
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

  console.log(`[email-ingest] received — recipient: ${recipient}, subject: ${subject}, sender: ${sender}`);

  if (!recipient) {
    console.error("[email-ingest] no recipient in payload");
    return NextResponse.json({ status: "no_recipient" }, { status: 200 });
  }

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    console.error("[email-ingest] Supabase admin not configured:", e);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  // Look up the alias
  const { data: aliasRow, error: aliasError } = await (admin as any)
    .from("email_aliases")
    .select("user_id")
    .eq("alias", recipient)
    .maybeSingle();

  if (aliasError) {
    console.error("[email-ingest] alias lookup error:", aliasError.message);
  }

  if (!aliasRow) {
    console.warn(`[email-ingest] unknown alias: "${recipient}" — no matching row in email_aliases`);
    // Return 200 so Mailgun doesn't retry unknown aliases
    return NextResponse.json({ status: "unknown_alias" }, { status: 200 });
  }

  console.log(`[email-ingest] alias matched user_id: ${aliasRow.user_id}`);

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
    console.error("[email-ingest] insert error:", insertError?.message);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  console.log(`[email-ingest] record saved — id: ${record.id}`);

  // Insert extracted fields
  if (extraction.fields.length > 0) {
    const { error: fieldsError } = await (admin as any).from("email_extracted_fields").insert(
      extraction.fields.map((f) => ({
        record_id: record.id,
        label: f.label,
        value: f.value,
        confidence: f.confidence,
      }))
    );
    if (fieldsError) {
      console.error("[email-ingest] fields insert error:", fieldsError.message);
    } else {
      console.log(`[email-ingest] ${extraction.fields.length} field(s) extracted and saved`);
    }
  } else {
    console.log("[email-ingest] no fields extracted (OpenAI may not be configured)");
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}

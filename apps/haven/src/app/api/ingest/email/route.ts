import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { extractEmailFields } from "@/lib/email-extractor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// In-process rate limiter (per-instance, not distributed).
// Limits abuse from a single IP within a warm Vercel function instance.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
interface RateEntry { count: number; windowStart: number }
const rateLimitStore = new Map<string, RateEntry>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitStore.size > 500) {
    for (const [key, val] of rateLimitStore) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(key);
    }
  }
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

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

/** Parse "Display Name <email@example.com>" or plain "email@example.com" */
function parseSender(raw: string): { email: string; name: string | null } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim().toLowerCase() };
  }
  return { name: null, email: raw.trim().toLowerCase() };
}

/** Strip Re:/Fwd: prefixes and normalise whitespace for thread grouping */
function normaliseSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd?|fw):\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRateLimit(ip)) {
    console.warn(`[email-ingest] rate limit exceeded for IP: ${ip}`);
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

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

  // Verify HMAC signature — 503 tells Mailgun to retry (misconfiguration); 406 = permanent reject
  if (!signingKey) {
    console.error("[email-ingest] MAILGUN_WEBHOOK_SIGNING_KEY is not configured");
    return NextResponse.json({ error: "endpoint_not_configured" }, { status: 503 });
  }
  if (!timestamp || !token || !signature) {
    console.error("[email-ingest] missing signature fields");
    return NextResponse.json({ error: "missing_signature_fields" }, { status: 406 });
  }
  if (!verifyMailgunSignature(signingKey, timestamp, token, signature)) {
    console.error("[email-ingest] invalid signature — check MAILGUN_WEBHOOK_SIGNING_KEY");
    return NextResponse.json({ error: "invalid_signature" }, { status: 406 });
  }

  const recipient = String(formData.get("recipient") ?? "").toLowerCase().trim();
  const rawSender = String(formData.get("sender") ?? formData.get("from") ?? "");
  const subject = String(formData.get("subject") ?? "");
  // Store the full body (stripped-text removes quoted replies; body-plain keeps them)
  const bodyText = String(
    formData.get("body-plain") ?? formData.get("stripped-text") ?? ""
  );

  const { email: senderEmail, name: senderName } = parseSender(rawSender);

  console.log(`[email-ingest] received — recipient: ${recipient}, subject: ${subject}, sender: ${senderEmail}`);

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
    return NextResponse.json({ status: "unknown_alias" }, { status: 200 });
  }

  console.log(`[email-ingest] alias matched user_id: ${aliasRow.user_id}`);
  const userId: string = aliasRow.user_id;
  const now = new Date().toISOString();

  // Upsert contact for this sender
  let contactId: string | null = null;
  if (senderEmail) {
    const { data: contactRow, error: contactError } = await (admin as any)
      .from("email_contacts")
      .upsert(
        { user_id: userId, email: senderEmail, name: senderName, updated_at: now },
        { onConflict: "user_id,email", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (contactError) {
      console.error("[email-ingest] contact upsert error:", contactError.message);
    } else {
      contactId = contactRow?.id ?? null;
    }
  }

  // Find or create thread by normalised subject
  let threadId: string | null = null;
  const threadKey = normaliseSubject(subject);
  if (threadKey) {
    // Try to update last_email_at if thread exists
    const { data: existingThread } = await (admin as any)
      .from("email_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("thread_key", threadKey)
      .maybeSingle();

    if (existingThread) {
      threadId = existingThread.id;
      await (admin as any)
        .from("email_threads")
        .update({ last_email_at: now })
        .eq("id", threadId);
    } else {
      const { data: newThread, error: threadError } = await (admin as any)
        .from("email_threads")
        .insert({ user_id: userId, thread_key: threadKey, subject, last_email_at: now })
        .select("id")
        .single();

      if (threadError) {
        console.error("[email-ingest] thread insert error:", threadError.message);
      } else {
        threadId = newThread?.id ?? null;
      }
    }
  }

  // Extract immigration fields with OpenAI
  const extraction = await extractEmailFields({ subject, body: bodyText, sender: rawSender });

  // Insert ingest record
  const { data: record, error: insertError } = await (admin as any)
    .from("email_ingest_records")
    .insert({
      user_id: userId,
      alias: recipient,
      source_type: extraction.sourceType,
      subject,
      sender_email: senderEmail || null,
      sender_name: senderName || null,
      body_text: bodyText || null,
      thread_id: threadId,
      contact_id: contactId,
      received_at: now,
      status: "pending_confirmation",
    })
    .select("id")
    .single();

  if (insertError || !record) {
    console.error("[email-ingest] insert error:", insertError?.message);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  console.log(`[email-ingest] record saved — id: ${record.id}, thread: ${threadId}, contact: ${contactId}`);

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

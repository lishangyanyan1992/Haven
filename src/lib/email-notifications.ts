import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BulletinChargeability, BulletinPreferenceCategory } from "@/types/domain";
import type { ParsedVisaBulletinResult } from "@/lib/visa-bulletin-parser";

type DeliveryCandidate = {
  userId: string;
  email: string;
  fullName: string;
  priorityDate: string | null;
  category: BulletinPreferenceCategory;
  country: BulletinChargeability;
};

type BulletinDeliveryRow = {
  bulletin_year: number;
  bulletin_month: number;
  category: string;
  country: string;
  cutoff_label: string;
  cutoff_date: string | null;
  source_url: string;
};

function canSendProductEmail() {
  return Boolean(env.MAILGUN_API_KEY && env.MAILGUN_SENDING_DOMAIN && env.MAILGUN_FROM_EMAIL);
}

function mapPreferenceCategory(category: string): BulletinPreferenceCategory | null {
  if (category === "EB-2 NIW") return "EB-2";
  if (category === "EB-1" || category === "EB-2" || category === "EB-3") return category;
  return null;
}

function mapChargeability(countryOfBirth: string): BulletinChargeability {
  const normalized = countryOfBirth.trim().toLowerCase();
  if (normalized === "india") return "India";
  if (normalized === "china") return "China";
  if (normalized === "mexico") return "Mexico";
  if (normalized === "philippines") return "Philippines";
  return "All Chargeability";
}

function formatBulletinCutoff(label: string, cutoffDate: string | null) {
  if (label === "C") return "Current";
  if (label === "U") return "Unavailable";
  if (!cutoffDate) return label;

  return new Date(`${cutoffDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatPriorityDate(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}

function summarizeMovement(current: BulletinDeliveryRow, previous?: BulletinDeliveryRow) {
  const currentCutoff = formatBulletinCutoff(current.cutoff_label, current.cutoff_date);

  if (!previous) {
    return `The new bulletin is live. Current final action cutoff: ${currentCutoff}.`;
  }

  const previousCutoff = formatBulletinCutoff(previous.cutoff_label, previous.cutoff_date);

  if (currentCutoff === previousCutoff) {
    return `The new bulletin is live. Your queue stayed at ${currentCutoff}.`;
  }

  return `The new bulletin is live. Your queue moved from ${previousCutoff} to ${currentCutoff}.`;
}

async function sendMailgunEmail(input: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!canSendProductEmail()) {
    return { status: "skipped" as const, reason: "mail_not_configured" };
  }

  const endpoint = `https://api.mailgun.net/v3/${env.MAILGUN_SENDING_DOMAIN}/messages`;
  const auth = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64");
  const fromName = env.MAILGUN_FROM_NAME ?? env.NEXT_PUBLIC_APP_NAME ?? "Haven";
  const from = `${fromName} <${env.MAILGUN_FROM_EMAIL}>`;

  const body = new URLSearchParams({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailgun request failed: ${response.status} ${errorText}`);
  }

  return { status: "sent" as const };
}

function buildDashboardUrl() {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL("/dashboard", baseUrl).toString();
}

export async function sendVisaBulletinStatusUpdateEmails(bulletin: ParsedVisaBulletinResult) {
  if (!canSendProductEmail()) {
    return { eligible: 0, sent: 0, skipped: 0, failed: 0, reason: "mail_not_configured" as const };
  }

  const admin = createSupabaseAdminClient() as any;
  const bulletinEntries = bulletin.entries.filter(
    (entry): entry is ParsedVisaBulletinResult["entries"][number] & { category: BulletinPreferenceCategory } =>
      entry.category === "EB-1" || entry.category === "EB-2" || entry.category === "EB-3"
  );

  if (bulletinEntries.length === 0) {
    return { eligible: 0, sent: 0, skipped: 0, failed: 0, reason: "no_supported_entries" as const };
  }

  const pairToEntry = new Map(
    bulletinEntries.map((entry) => [`${entry.category}:${entry.country}`, entry] as const)
  );

  const { data: profileRows } = await admin
    .from("user_profiles")
    .select("id, email, full_name, priority_date, preference_category, country_of_birth, status_update_email_notifications")
    .eq("status_update_email_notifications", true)
    .not("priority_date", "is", null);

  const candidates: DeliveryCandidate[] = (profileRows ?? []).flatMap((row: Record<string, unknown>) => {
    const category = mapPreferenceCategory(String(row.preference_category ?? ""));
    if (!category) return [];

    const country = mapChargeability(String(row.country_of_birth ?? ""));
    if (!pairToEntry.has(`${category}:${country}`)) return [];

    return [{
      userId: String(row.id),
      email: String(row.email ?? ""),
      fullName: String(row.full_name ?? "there"),
      priorityDate: (row.priority_date as string | null) ?? null,
      category,
      country
    }];
  });

  if (candidates.length === 0) {
    return { eligible: 0, sent: 0, skipped: 0, failed: 0, reason: "no_opted_in_recipients" as const };
  }

  const categories = Array.from(new Set(candidates.map((candidate) => candidate.category)));
  const countries = Array.from(new Set(candidates.map((candidate) => candidate.country)));
  const { data: latestRows } = await admin
    .from("visa_bulletin_entries")
    .select("bulletin_year, bulletin_month, category, country, cutoff_label, cutoff_date, source_url")
    .in("category", categories)
    .in("country", countries)
    .order("bulletin_year", { ascending: false })
    .order("bulletin_month", { ascending: false });

  const pairHistory = new Map<string, BulletinDeliveryRow[]>();
  for (const row of (latestRows ?? []) as BulletinDeliveryRow[]) {
    const key = `${row.category}:${row.country}`;
    const existing = pairHistory.get(key) ?? [];
    if (existing.length < 2) {
      existing.push(row);
      pairHistory.set(key, existing);
    }
  }

  const dedupeKeys = Array.from(
    new Set(
      candidates.map((candidate) => {
        const entry = pairToEntry.get(`${candidate.category}:${candidate.country}`);
        return `visa-bulletin:${bulletin.bulletinYear}-${bulletin.bulletinMonth}:${entry?.category}:${entry?.country}`;
      })
    )
  );

  const { data: deliveryRows } = await admin
    .from("email_notification_deliveries")
    .select("user_id, dedupe_key")
    .eq("notification_kind", "status_update")
    .in("user_id", candidates.map((candidate) => candidate.userId))
    .in("dedupe_key", dedupeKeys);

  const delivered = new Set(
    ((deliveryRows ?? []) as Array<{ user_id: string; dedupe_key: string }>).map((row) => `${row.user_id}:${row.dedupe_key}`)
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const entry = pairToEntry.get(`${candidate.category}:${candidate.country}`);
    if (!entry) {
      skipped += 1;
      continue;
    }

    const dedupeKey = `visa-bulletin:${bulletin.bulletinYear}-${bulletin.bulletinMonth}:${entry.category}:${entry.country}`;
    if (delivered.has(`${candidate.userId}:${dedupeKey}`)) {
      skipped += 1;
      continue;
    }

    const history = pairHistory.get(`${candidate.category}:${candidate.country}`) ?? [];
    const current = history[0];
    const previous = history[1];
    const dashboardUrl = buildDashboardUrl();
    const greetingName = candidate.fullName.split(" ")[0] ?? "there";
    const currentCutoff = formatBulletinCutoff(current?.cutoff_label ?? entry.cutoffLabel, current?.cutoff_date ?? entry.cutoffDate);
    const priorityDateLabel = formatPriorityDate(candidate.priorityDate);
    const text = [
      `Hi ${greetingName},`,
      "",
      `${bulletin.bulletinLabel} has a new official visa bulletin update for ${candidate.category} ${candidate.country}.`,
      summarizeMovement(
        current ?? {
          bulletin_year: bulletin.bulletinYear,
          bulletin_month: bulletin.bulletinMonth,
          category: entry.category,
          country: entry.country,
          cutoff_label: entry.cutoffLabel,
          cutoff_date: entry.cutoffDate,
          source_url: entry.sourceUrl
        },
        previous
      ),
      priorityDateLabel ? `Your priority date on file: ${priorityDateLabel}.` : null,
      `Current cutoff: ${currentCutoff}.`,
      "",
      `Open your dashboard: ${dashboardUrl}`,
      `Official source: ${entry.sourceUrl}`
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await sendMailgunEmail({
        to: candidate.email,
        subject: `Haven update: ${candidate.category} ${candidate.country} bulletin for ${bulletin.bulletinLabel}`,
        text
      });

      await admin.from("email_notification_deliveries").insert({
        user_id: candidate.userId,
        notification_kind: "status_update",
        dedupe_key: dedupeKey,
        metadata: {
          bulletinLabel: bulletin.bulletinLabel,
          category: candidate.category,
          country: candidate.country,
          sourceUrl: entry.sourceUrl
        }
      });

      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { eligible: candidates.length, sent, skipped, failed, reason: "ok" as const };
}

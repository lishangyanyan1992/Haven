import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Auto-assemble a FIRST-PARTY case data point for a user from data Haven already has:
//   segment  ← user_profiles
//   trigger / path / dates ← layoff_events
//   RFE / NOID / outcome   ← ingested email evidence
// Tagged source='first_party' (counts in public stats) + verification='email_extracted'.
// Idempotent: one row per user (delete + reinsert), so it refreshes as new data arrives.

function mapVisa(visaType: string | null): "h1b" | "f1_opt" | "l1" | "other" {
  const v = (visaType ?? "").toUpperCase();
  if (v === "H1B") return "h1b";
  if (v === "OPT" || v === "STEM OPT") return "f1_opt";
  return "other";
}
function bucketNation(country: string | null): "india" | "china" | "row" | null {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return null;
  if (c.includes("india")) return "india";
  if (c.includes("china")) return "china";
  return "row";
}
function mapCategory(pref: string | null): "eb1" | "eb2" | "eb3" | null {
  const p = (pref ?? "").toUpperCase();
  if (p.includes("EB-1")) return "eb1";
  if (p.includes("EB-2")) return "eb2";
  if (p.includes("EB-3")) return "eb3";
  return null;
}
// layoff_events.resolution_type → what the person did
function pathFromResolution(resolution: string | null): string {
  if (resolution === "new_job") return "h1b_transfer";
  if (resolution === "left_country") return "departed";
  return "undecided"; // change_status (ambiguous), dismissed, or unresolved
}

export async function upsertFirstPartyCase(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<{ ok: boolean; reason?: string }> {
  const admin = adminClient as any;

  const { data: profile } = await admin
    .from("user_profiles")
    .select("visa_type, country_of_birth, i140_approved, preference_category, priority_date")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "no_profile" };

  // Most recent layoff event (active or resolved), if any.
  const { data: layoff } = await admin
    .from("layoff_events")
    .select("layoff_date, resolved_at, resolution_type")
    .eq("user_id", userId)
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Email evidence → RFE/NOID/outcome flags.
  const { data: records } = await admin
    .from("email_ingest_records")
    .select("id, source_type, received_at")
    .eq("user_id", userId)
    .order("received_at", { ascending: false });
  const recordIds = (records ?? []).map((r: any) => r.id);
  const sourceTypes = new Set((records ?? []).map((r: any) => r.source_type));

  let gotRfe: boolean | null = sourceTypes.has("rfe_notice") ? true : null;
  let gotNoid: boolean | null = null;
  let outcome: string | null = sourceTypes.has("rfe_notice") ? "rfe" : null;

  if (recordIds.length > 0) {
    const { data: fields } = await admin
      .from("email_extracted_fields")
      .select("label, value")
      .in("record_id", recordIds);
    const blob = (fields ?? []).map((f: any) => `${f.label ?? ""} ${f.value ?? ""}`).join(" ").toLowerCase();
    if (/\bnoid\b|notice of intent to deny/.test(blob)) { gotNoid = true; outcome = outcome ?? "noid"; }
    if (/\brfe\b|request for evidence/.test(blob)) gotRfe = true;
    if (!outcome && /approv/.test(blob)) outcome = "approved";
    if (!outcome && /(denied|denial)/.test(blob)) outcome = "denied";
  }

  const caseDate =
    [layoff?.layoff_date ?? null, (records?.[0]?.received_at ?? "").slice(0, 10) || null]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;

  const row = {
    current_status: mapVisa(profile.visa_type),
    i140_status: profile.i140_approved ? "approved" : null,
    green_card_stage: profile.i140_approved ? "i140_approved" : null,
    category: mapCategory(profile.preference_category),
    nationality_bucket: bucketNation(profile.country_of_birth),
    priority_date: profile.priority_date ?? null,
    trigger: layoff ? "laid_off" : null,
    path_taken: pathFromResolution(layoff?.resolution_type ?? null),
    outcome,
    got_rfe: gotRfe,
    got_noid: gotNoid,
    premium_processing: null,
    notes: null,
    case_date: caseDate,
    source: "first_party",
    verification: "email_extracted",
    moderation_status: "approved",
    contributor_user_id: userId,
    consented_at: new Date().toISOString()
  };

  // One first-party row per user: clear then reinsert so it always reflects latest known state.
  await admin
    .from("community_case_data_points")
    .delete()
    .eq("contributor_user_id", userId)
    .eq("source", "first_party");
  const { error } = await admin.from("community_case_data_points").insert(row);
  return error ? { ok: false, reason: error.message } : { ok: true };
}

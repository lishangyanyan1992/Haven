import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { FieldSource, ProfileValues } from "./plan";

function admin() {
  return createSupabaseAdminClient() as any;
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function toFieldSource(row: any): FieldSource {
  return {
    fieldKey: row.field_key,
    origin: row.origin,
    value: row.value ?? null,
    documentFactId: row.document_fact_id ?? null,
    documentValue: row.document_value ?? null,
    documentLabel: row.document_label ?? null,
    documentPage: row.document_page ?? null,
    resolution: row.resolution ?? null
  };
}

function toRow(userId: string, source: FieldSource, updatedBy: string | null) {
  return {
    user_id: userId,
    field_key: source.fieldKey,
    origin: source.origin,
    value: source.value,
    document_fact_id: source.documentFactId,
    document_value: source.documentValue,
    document_label: source.documentLabel,
    document_page: source.documentPage,
    resolution: source.resolution,
    updated_by: updatedBy,
    updated_at: new Date().toISOString()
  };
}

/** Every recorded source for a user, by field key. Empty when there are none. */
export async function loadFieldSources(userId: string): Promise<Map<string, FieldSource>> {
  const { data, error } = await admin().from("field_sources").select("*").eq("user_id", userId);
  if (error) {
    console.error("[field-sources] could not load", error.message);
    return new Map();
  }
  return new Map((data ?? []).map((row: any) => [row.field_key as string, toFieldSource(row)]));
}

export async function saveFieldSources(userId: string, sources: FieldSource[], updatedBy: string | null) {
  if (sources.length === 0) return;
  const { error } = await admin()
    .from("field_sources")
    .upsert(sources.map((s) => toRow(userId, s, updatedBy)), { onConflict: "user_id,field_key" });
  if (error) throw new Error(`Could not save where values came from: ${error.message}`);
}


/** The values a document can fill, as they are saved now. */
export function profileValuesFromRow(row: Record<string, any>): ProfileValues {
  const answers = row.deadline_answers && typeof row.deadline_answers === "object" ? row.deadline_answers : {};
  return {
    visaType: row.visa_type ?? null,
    countryOfBirth: row.country_of_birth ?? null,
    employerName: row.employer_name ?? null,
    statusEndDate: (answers.statusEndDate as string | undefined) ?? row.current_visa_expiry_date ?? null
  };
}


/** The current values a document can fill, read fresh. Null when the profile can't be read. */
export async function loadProfileValues(userId: string): Promise<ProfileValues | null> {
  const { data } = await admin().from("user_profiles").select("*").eq("id", userId).maybeSingle();
  return data ? profileValuesFromRow(data) : null;
}

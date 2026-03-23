import { computeDerivedSignals } from "@/lib/haven";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Concern, ImmigrationProfile, PrimaryGoal, PreferenceCategory, SpouseVisaStatus, VisaType } from "@/types/domain";

export const ONBOARDING_OVERRIDE_COOKIE = "haven_onboarding_override";

type ProfileDraft = Partial<{
  visaType: string;
  countryOfBirth: string;
  primaryGoal: string;
  employerName: string;
  jobTitle: string;
  h1bStartDate: string;
  employerSize: string;
  greenCardStage: string;
  priorityDate: string;
  preferenceCategory: string;
  i140Approved: string | boolean;
  spouseVisaStatus: string;
  topConcerns: string[];
}>;

const visaTypes: VisaType[] = ["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"];
const primaryGoals: PrimaryGoal[] = ["get_gc", "job_stability", "explore_options", "stay_flexible", "not_sure"];
const preferenceCategories: PreferenceCategory[] = ["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"];
const spouseVisaStatuses: SpouseVisaStatus[] = ["none", "H1B", "H4", "H4 EAD", "GC", "other"];
const concerns: Concern[] = ["layoffs", "visa_expiry", "gc_timeline", "job_change", "other"];

function asEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asConcerns(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const next = value.filter((item): item is Concern => typeof item === "string" && concerns.includes(item as Concern));
  return next.length > 0 ? next : ["layoffs"];
}

function normalizeDraft(rawDraft: ProfileDraft, existingRow?: Record<string, unknown> | null) {
  const existingConcerns = ((existingRow?.top_concerns as string[] | null) ?? []).filter((item): item is Concern =>
    concerns.includes(item as Concern)
  );
  const i140Approved =
    rawDraft.i140Approved !== undefined
      ? rawDraft.i140Approved === true || rawDraft.i140Approved === "true"
      : Boolean(existingRow?.i140_approved);

  const greenCardStage =
    typeof rawDraft.greenCardStage === "string"
      ? rawDraft.greenCardStage
      : existingRow?.i485_filed
        ? "i485_filed"
        : existingRow?.i140_approved
          ? "i140_approved"
          : existingRow?.perm_stage === "certified"
            ? "perm_certified"
            : existingRow?.perm_stage === "in_progress"
              ? "perm_in_progress"
              : "not_started";
  const permStage =
    greenCardStage === "perm_in_progress"
      ? "in_progress"
      : greenCardStage === "perm_certified"
        ? "certified"
        : "not_started";

  return {
    visa_type: asEnumValue(rawDraft.visaType ?? existingRow?.visa_type, visaTypes, "H1B"),
    country_of_birth:
      typeof rawDraft.countryOfBirth === "string" && rawDraft.countryOfBirth.trim().length > 0
        ? rawDraft.countryOfBirth.trim()
        : String(existingRow?.country_of_birth ?? "India"),
    primary_goal: asEnumValue(rawDraft.primaryGoal ?? existingRow?.primary_goal, primaryGoals, "not_sure"),
    employer_name:
      rawDraft.employerName !== undefined
        ? asOptionalString(rawDraft.employerName)
        : (existingRow?.employer_name as string | null) ?? null,
    job_title:
      rawDraft.jobTitle !== undefined
        ? asOptionalString(rawDraft.jobTitle)
        : (existingRow?.job_title as string | null) ?? null,
    h1b_start_date:
      rawDraft.h1bStartDate !== undefined
        ? asOptionalString(rawDraft.h1bStartDate)
        : (existingRow?.h1b_start_date as string | null) ?? null,
    employer_size:
      rawDraft.employerSize === "startup" || rawDraft.employerSize === "mid-size" || rawDraft.employerSize === "enterprise"
        ? rawDraft.employerSize
        : typeof existingRow?.employer_size === "string"
          ? existingRow.employer_size
          : "enterprise",
    perm_stage: permStage,
    priority_date:
      rawDraft.priorityDate !== undefined
        ? asOptionalString(rawDraft.priorityDate)
        : (existingRow?.priority_date as string | null) ?? null,
    preference_category: asEnumValue(rawDraft.preferenceCategory ?? existingRow?.preference_category, preferenceCategories, "Not sure"),
    i140_approved: i140Approved,
    i140_approval_date:
      i140Approved
        ? ((existingRow?.i140_approval_date as string | null) ?? new Date().toISOString().slice(0, 10))
        : null,
    i485_filed: greenCardStage === "i485_filed",
    spouse_visa_status: asEnumValue(rawDraft.spouseVisaStatus ?? existingRow?.spouse_visa_status, spouseVisaStatuses, "none"),
    top_concerns: asConcerns(rawDraft.topConcerns) ?? (existingConcerns.length > 0 ? existingConcerns : ["layoffs"])
  };
}

function mapProfileRow(row: Record<string, unknown>): ImmigrationProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    visaType: row.visa_type as ImmigrationProfile["visaType"],
    countryOfBirth: String(row.country_of_birth ?? ""),
    currentVisaExpiryDate: (row.current_visa_expiry_date as string | null) ?? undefined,
    h1bStartDate: (row.h1b_start_date as string | null) ?? undefined,
    permStage: row.perm_stage as ImmigrationProfile["permStage"],
    permFilingDate: (row.perm_filing_date as string | null) ?? undefined,
    i140Approved: Boolean(row.i140_approved),
    i140ApprovalDate: (row.i140_approval_date as string | null) ?? undefined,
    priorityDate: (row.priority_date as string | null) ?? undefined,
    preferenceCategory: row.preference_category as ImmigrationProfile["preferenceCategory"],
    i485Filed: Boolean(row.i485_filed),
    employerName: (row.employer_name as string | null) ?? undefined,
    employerSize: (row.employer_size as ImmigrationProfile["employerSize"]) ?? undefined,
    employerIndustry: (row.employer_industry as string | null) ?? undefined,
    jobTitle: (row.job_title as string | null) ?? undefined,
    employmentStatus: row.employment_status as ImmigrationProfile["employmentStatus"],
    spouseVisaStatus: row.spouse_visa_status as ImmigrationProfile["spouseVisaStatus"],
    primaryGoal: row.primary_goal as ImmigrationProfile["primaryGoal"],
    topConcerns: ((row.top_concerns as string[] | null) ?? []) as ImmigrationProfile["topConcerns"]
  };
}

async function persistDerivedSignals(userId: string, profile: ImmigrationProfile) {
  const admin = createSupabaseAdminClient() as any;
  const signals = computeDerivedSignals(profile);

  await admin.from("derived_signals").upsert({
    user_id: userId,
    h1b_cap_date: signals.h1bCapDate ?? null,
    days_until_visa_expiry: signals.daysUntilVisaExpiry ?? null,
    visa_bulletin_position: signals.visaBulletinPosition ?? null,
    estimated_gc_date_range: signals.estimatedGreenCardDateRange ?? null,
    ac21_portability_status: signals.ac21PortabilityStatus ?? null,
    layoff_readiness_score: signals.layoffReadinessScore,
    layoff_readiness_reasoning: signals.layoffReadinessReasoning
  });
}

export async function persistProfileDraft(userId: string, rawDraft: ProfileDraft) {
  const admin = createSupabaseAdminClient() as any;
  const { data: existingRow } = await admin.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  const patch = normalizeDraft(rawDraft, (existingRow as Record<string, unknown> | null) ?? null);

  await admin.from("user_profiles").update(patch).eq("id", userId);

  const { data: row } = await admin.from("user_profiles").select("*").eq("id", userId).single();
  if (!row) return null;

  const profile = mapProfileRow(row as Record<string, unknown>);
  await persistDerivedSignals(userId, profile);
  return profile;
}

export function parseOverrideCookie(value: string | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(decodeURIComponent(value)) as ProfileDraft;
  } catch {
    return null;
  }
}

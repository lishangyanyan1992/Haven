import { computeDerivedSignals } from "@/lib/haven";
import { mapProfileRow } from "@/lib/profile-mapper";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { concernsForHelpNeeded, normalizeHelpNeeded } from "@/lib/firms/help-needed";
import type { Concern, EmploymentStatus, ImmigrationProfile, PrimaryGoal, PreferenceCategory, SpouseVisaStatus, VisaType } from "@/types/domain";

export const ONBOARDING_OVERRIDE_COOKIE = "haven_onboarding_override";

type ProfileDraft = Partial<{
  visaType: string;
  customVisaDetail: string;
  greenCardPathway: string;
  // Added so a correction stated in chat lands in the same record the dashboard
  // writes. It was readable but not writable, which meant "I was laid off" could
  // never reach the profile from anywhere except the form.
  employmentStatus: string;
  permStage: string;
  i485Filed: string | boolean;
  countryOfBirth: string;
  primaryGoal: string;
  employerName: string;
  jobTitle: string;
  h1bStartDate: string;
  currentVisaExpiryDate: string;
  employerSize: string;
  greenCardStage: string;
  greenCardSponsor: string;
  retainedPriorityDateSponsor: string;
  priorityDate: string;
  preferenceCategory: string;
  i140Approved: string | boolean;
  spouseVisaStatus: string;
  topConcerns: string[];
  helpNeeded: string[];
  communityReplyEmailNotifications: string | boolean;
  statusUpdateEmailNotifications: string | boolean;
}>;

const visaTypes: VisaType[] = ["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"];
const primaryGoals: PrimaryGoal[] = ["get_gc", "job_stability", "explore_options", "stay_flexible", "not_sure"];
const preferenceCategories: PreferenceCategory[] = ["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"];
const spouseVisaStatuses: SpouseVisaStatus[] = ["none", "H1B", "H4", "H4 EAD", "GC", "citizen", "other"];
const concerns: Concern[] = ["layoffs", "visa_expiry", "gc_timeline", "job_change", "other"];
const employmentStatuses: EmploymentStatus[] = ["employed", "actively_searching", "laid_off"];

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

/**
 * "What help do you need?" replaced "Main concerns". When a form sends help
 * choices, they are saved and the old concern areas are derived from them
 * (keeping the saved ones when the choices imply none). Forms that still send
 * concerns directly keep working as before.
 */
function helpNeededPatch(rawDraft: ProfileDraft, existingConcerns: Concern[]) {
  const fallback: Concern[] = existingConcerns.length > 0 ? existingConcerns : ["layoffs"];
  if (rawDraft.helpNeeded !== undefined) {
    const helpNeeded = normalizeHelpNeeded(rawDraft.helpNeeded);
    const derived = concernsForHelpNeeded(helpNeeded);
    return { help_needed: helpNeeded, top_concerns: derived.length > 0 ? derived : fallback };
  }
  return { top_concerns: asConcerns(rawDraft.topConcerns) ?? fallback };
}

function normalizeDraft(rawDraft: ProfileDraft, existingRow?: Record<string, unknown> | null) {
  const existingConcerns = ((existingRow?.top_concerns as string[] | null) ?? []).filter((item): item is Concern =>
    concerns.includes(item as Concern)
  );
  const shouldUpdateDeadlineAnswers =
    rawDraft.retainedPriorityDateSponsor !== undefined ||
    rawDraft.greenCardSponsor !== undefined ||
    rawDraft.greenCardPathway !== undefined ||
    rawDraft.customVisaDetail !== undefined ||
    (typeof rawDraft.greenCardStage === "string" && rawDraft.greenCardStage.trim().length > 0);
  let nextDeadlineAnswers: Record<string, unknown> | undefined = undefined;
  if (shouldUpdateDeadlineAnswers) {
    const existingDeadlineAnswers =
      existingRow?.deadline_answers && typeof existingRow.deadline_answers === "object"
        ? (existingRow.deadline_answers as Record<string, unknown>)
        : {};
    nextDeadlineAnswers = {
      ...existingDeadlineAnswers,
      ...(rawDraft.greenCardSponsor !== undefined
        ? { greenCardSponsor: asOptionalString(rawDraft.greenCardSponsor) }
        : {}),
      ...(rawDraft.retainedPriorityDateSponsor !== undefined
        ? { retainedPriorityDateSponsor: asOptionalString(rawDraft.retainedPriorityDateSponsor) }
        : {}),
      ...(rawDraft.greenCardPathway !== undefined
        ? { greenCardPathway: asOptionalString(rawDraft.greenCardPathway) }
        : {}),
      ...(rawDraft.customVisaDetail !== undefined
        ? { customVisaDetail: asOptionalString(rawDraft.customVisaDetail) }
        : {}),
      // The flags below only describe PERM, I-140 and I-485; the step itself is kept so
      // I-130, consular processing and other paths survive a save.
      ...(typeof rawDraft.greenCardStage === "string" && rawDraft.greenCardStage.trim()
        ? { greenCardStage: rawDraft.greenCardStage.trim().slice(0, 40) }
        : {})
    };
  }
  const i140Approved =
    rawDraft.i140Approved !== undefined
      ? rawDraft.i140Approved === true || rawDraft.i140Approved === "true"
      : Boolean(existingRow?.i140_approved);

  const stageSent = typeof rawDraft.greenCardStage === "string" && rawDraft.greenCardStage.trim().length > 0;
  const greenCardStage =
    typeof rawDraft.greenCardStage === "string"
      ? rawDraft.greenCardStage
      : existingRow?.i485_filed
        ? "i485_filed"
        : existingRow?.i140_approved
          ? "i140_approved"
          : existingRow?.i140_filed
            ? "i140_filed"
            : existingRow?.perm_stage === "certified"
              ? "perm_certified"
              : existingRow?.perm_stage === "in_progress"
                ? "perm_in_progress"
                : "not_started";
  const permStage =
    greenCardStage === "perm_in_progress"
      ? "in_progress"
      : greenCardStage === "perm_certified" ||
          greenCardStage === "i140_filed" ||
          greenCardStage === "i140_approved" ||
          greenCardStage === "i485_filed"
        ? "certified"
        : "not_started";

  return {
    visa_type:
      typeof rawDraft.visaType === "string" && rawDraft.visaType.trim().length > 0
        ? rawDraft.visaType.trim()
        : typeof existingRow?.visa_type === "string" && existingRow.visa_type.trim().length > 0
          ? existingRow.visa_type.trim()
          : "H1B",
    country_of_birth:
      typeof rawDraft.countryOfBirth === "string" && rawDraft.countryOfBirth.trim().length > 0
        ? rawDraft.countryOfBirth.trim()
        : String(existingRow?.country_of_birth ?? ""),
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
    current_visa_expiry_date:
      rawDraft.currentVisaExpiryDate !== undefined
        ? asOptionalString(rawDraft.currentVisaExpiryDate)
        : (existingRow?.current_visa_expiry_date as string | null) ?? null,
    employer_size:
      rawDraft.employerSize === "startup" || rawDraft.employerSize === "mid-size" || rawDraft.employerSize === "enterprise"
        ? rawDraft.employerSize
        : typeof existingRow?.employer_size === "string"
          ? existingRow.employer_size
          : "enterprise",
    employment_status: asEnumValue(
      rawDraft.employmentStatus,
      employmentStatuses,
      (existingRow?.employment_status as EmploymentStatus | undefined) ?? "employed"
    ),
    // The stage flags are only rewritten when the form sent a stage or an I-140 answer.
    // With green cards entered, the forms send neither and the green cards keep these in line.
    ...(stageSent ? { perm_stage: permStage } : {}),
    priority_date:
      rawDraft.priorityDate !== undefined
        ? asOptionalString(rawDraft.priorityDate)
        : (existingRow?.priority_date as string | null) ?? null,
    preference_category:
      typeof rawDraft.preferenceCategory === "string" && rawDraft.preferenceCategory.trim().length > 0
        ? rawDraft.preferenceCategory.trim()
        : typeof existingRow?.preference_category === "string" && existingRow.preference_category.trim().length > 0
          ? existingRow.preference_category.trim()
          : "Not sure",
    ...(stageSent || rawDraft.i140Approved !== undefined
      ? {
          i140_approved: i140Approved,
          i140_approval_date: i140Approved
            ? ((existingRow?.i140_approval_date as string | null) ?? new Date().toISOString().slice(0, 10))
            : null
        }
      : {}),
    ...(stageSent ? { i140_filed: greenCardStage === "i140_filed", i485_filed: greenCardStage === "i485_filed" } : {}),
    spouse_visa_status: asEnumValue(rawDraft.spouseVisaStatus ?? existingRow?.spouse_visa_status, spouseVisaStatuses, "none"),
    ...helpNeededPatch(rawDraft, existingConcerns),
    community_reply_email_notifications:
      rawDraft.communityReplyEmailNotifications !== undefined
        ? rawDraft.communityReplyEmailNotifications === true || rawDraft.communityReplyEmailNotifications === "true"
        : Boolean(existingRow?.community_reply_email_notifications),
    status_update_email_notifications:
      rawDraft.statusUpdateEmailNotifications !== undefined
        ? rawDraft.statusUpdateEmailNotifications === true || rawDraft.statusUpdateEmailNotifications === "true"
        : Boolean(existingRow?.status_update_email_notifications),
    ...(nextDeadlineAnswers !== undefined ? { deadline_answers: nextDeadlineAnswers } : {})
  };
}


async function persistDerivedSignals(
  userId: string,
  profile: ImmigrationProfile,
  deadlines?: Record<string, unknown> | null
): Promise<boolean> {
  const admin = createSupabaseAdminClient() as any;
  const signals = computeDerivedSignals(profile, null, { deadlines: deadlines ?? null });

  const { error } = await admin.from("derived_signals").upsert({
    user_id: userId,
    h1b_cap_date: signals.h1bCapDate ?? null,
    days_until_visa_expiry: signals.daysUntilVisaExpiry ?? null,
    visa_bulletin_position: signals.visaBulletinPosition ?? null,
    estimated_gc_date_range: signals.estimatedGreenCardDateRange ?? null,
    ac21_portability_status: signals.ac21PortabilityStatus ?? null,
    layoff_readiness_score: signals.layoffReadinessScore,
    layoff_readiness_reasoning: signals.layoffReadinessReasoning
  });
  return !error;
}

export async function persistProfileDraft(userId: string, rawDraft: ProfileDraft) {
  const admin = createSupabaseAdminClient() as any;
  const { data: existingRow } = await admin.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  const patch = normalizeDraft(rawDraft, (existingRow as Record<string, unknown> | null) ?? null);

  const { error: updateError } = await admin.from("user_profiles").update(patch).eq("id", userId);
  if (updateError) return null;

  const { data: row } = await admin.from("user_profiles").select("*").eq("id", userId).single();
  if (!row) return null;

  const profile = mapProfileRow(row as Record<string, unknown>);
  try {
    await persistDerivedSignals(userId, profile, (row as { deadline_answers?: Record<string, unknown> }).deadline_answers);
  } catch {
    // Non-blocking cache materialization; profile, deadlines, and firm answers remain primary
  }
  return profile;
}

/**
 * Recompute the stored signals from the full saved profile. Called after any
 * save that doesn't go through persistProfileDraft (deadlines, green cards),
 * so the cache never lags behind what the user entered.
 */
export async function refreshDerivedSignals(userId: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data: row } = await admin.from("user_profiles").select("*").eq("id", userId).maybeSingle();
    if (!row) return false;
    return await persistDerivedSignals(
      userId,
      mapProfileRow(row as Record<string, unknown>),
      (row as { deadline_answers?: Record<string, unknown> }).deadline_answers
    );
  } catch {
    return false;
  }
}

export function parseOverrideCookie(value: string | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(decodeURIComponent(value)) as ProfileDraft;
  } catch {
    return null;
  }
}

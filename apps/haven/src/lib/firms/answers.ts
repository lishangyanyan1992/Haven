import { isCustomQuestionKey } from "@/lib/firms/intake-question-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The setup answers a client shares with their firm.
 *
 * Kept as a separate copy on firm_clients.shared_answers rather than read
 * live from user_profiles, because the chat also updates user_profiles
 * (for example, "I was laid off" changes work status). Only the setup and
 * settings screens write this copy, so nothing said in a chat reaches the
 * lawyer.
 */

export const SHARED_ANSWER_KEYS = [
  "fullName",
  "visaType",
  "countryOfBirth",
  "primaryGoal",
  "employerName",
  "jobTitle",
  "h1bStartDate",
  "employerSize",
  "greenCardStage",
  "priorityDate",
  "preferenceCategory",
  "spouseVisaStatus",
  "topConcerns",
  // "Your deadlines" (setup step 5 and the one-time prompt)
  "statusEndDate",
  "statusEndUnknown",
  "jobEnded",
  "lastWorkDay",
  "agencyDeadlineType",
  "agencyDeadlineDate",
  "travelPlanned",
  "travelDate"
] as const;

export type CustomQuestionKey = `custom_q_${string}`;
export type SharedAnswerKey = (typeof SHARED_ANSWER_KEYS)[number];
export type SharedAnswers = Partial<Record<SharedAnswerKey, string | string[]>> &
  Record<CustomQuestionKey, string | string[]>;

/** The answered setup fields from a setup or settings form submission. */
export function pickSharedAnswers(draft: Record<string, unknown>): SharedAnswers {
  const out: SharedAnswers = {};
  const outRecord = out as Record<string, string | string[] | undefined>;
  for (const key of SHARED_ANSWER_KEYS) {
    const value = draft[key];
    if (Array.isArray(value)) {
      const items = value.map(String).map((v) => v.trim()).filter(Boolean);
      if (items.length) out[key] = items;
    } else if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  for (const [key, value] of Object.entries(draft)) {
    if (!isCustomQuestionKey(key)) continue;
    if (Array.isArray(value)) {
      const items = value.map(String).map((v) => v.trim()).filter(Boolean);
      if (items.length) outRecord[key] = items;
    } else if (typeof value === "string" && value.trim()) {
      outRecord[key] = value.trim();
    }
  }
  return out;
}

/**
 * The same answers read from a profile, for someone who finished setup before
 * joining a firm. Used once, when they join.
 */
export function sharedAnswersFromProfile(p: Record<string, any> | null): SharedAnswers {
  if (!p || !String(p.country_of_birth ?? "").trim()) return {};
  const greenCardStage = p.i485_filed
    ? "i485_filed"
    : p.i140_approved
      ? "i140_approved"
      : p.i140_filed
        ? "i140_filed"
        : p.perm_stage === "certified"
          ? "perm_certified"
          : p.perm_stage === "in_progress"
            ? "perm_in_progress"
            : "not_started";
  const deadlineRecord =
    p.deadline_answers && typeof p.deadline_answers === "object" && !Array.isArray(p.deadline_answers)
      ? (p.deadline_answers as Record<string, unknown>)
      : {};
  return pickSharedAnswers({
    fullName: p.full_name ?? "",
    visaType: p.visa_type,
    countryOfBirth: p.country_of_birth,
    primaryGoal: p.primary_goal,
    employerName: p.employer_name ?? "",
    jobTitle: p.job_title ?? "",
    h1bStartDate: p.h1b_start_date ?? "",
    employerSize: p.employer_size ?? "",
    greenCardStage,
    priorityDate: p.priority_date ?? "",
    preferenceCategory: p.preference_category,
    spouseVisaStatus: p.spouse_visa_status,
    topConcerns: p.top_concerns ?? [],
    statusEndDate: deadlineRecord.statusEndDate ?? p.current_visa_expiry_date ?? "",
    statusEndUnknown: deadlineRecord.statusEndUnknown,
    jobEnded: deadlineRecord.jobEnded,
    lastWorkDay: deadlineRecord.lastWorkDay,
    agencyDeadlineType: deadlineRecord.agencyDeadlineType,
    agencyDeadlineDate: deadlineRecord.agencyDeadlineDate,
    travelPlanned: deadlineRecord.travelPlanned,
    travelDate: deadlineRecord.travelDate
  });
}

/**
 * Apply a setup or settings submission to the firm's copy. Fields the form
 * sent with a value are set; fields it sent empty are removed, so clearing
 * an answer clears it for the firm too; fields it didn't send are left as
 * they were (each setup step only sends its own fields). Does nothing for
 * people who haven't joined a firm. Never call this from the chat.
 */
export function mergeSharedAnswers(current: SharedAnswers, draft: Record<string, unknown>, form: Pick<FormData, "has">) {
  // Unticked checkboxes send nothing, so concerns count as sent whenever
  // the screen they sit on (with spouse status) was sent.
  const customKeys = Array.from(
    new Set([...Object.keys(current), ...Object.keys(draft)].filter(isCustomQuestionKey))
  );
  const submitted: string[] = [
    ...SHARED_ANSWER_KEYS.filter(
      (key) => form.has(key) || (key === "topConcerns" && form.has("spouseVisaStatus"))
    ),
    ...customKeys.filter((key) => form.has(key))
  ];
  const picked = pickSharedAnswers(draft) as Record<string, string | string[] | undefined>;
  const next: SharedAnswers = { ...current };
  const nextRecord = next as Record<string, string | string[] | undefined>;
  for (const key of submitted) {
    if (picked[key] !== undefined) nextRecord[key] = picked[key];
    else delete nextRecord[key];
  }
  return { next, changed: submitted.length > 0 };
}

/**
 * A view of a submitted form that only reports some fields as sent, so one
 * save can't clear answers that belong to another (setup sends every answer
 * on every save).
 */
export function formLimitedTo(form: Pick<FormData, "has">, keys: readonly string[], mode: "only" | "except" = "only") {
  return { has: (key: string) => (mode === "only" ? keys.includes(key) : !keys.includes(key)) && form.has(key) };
}

/** True when the firm's copy is up to date (or there's no firm to update). */
export async function recordFirmSharedAnswers(userId: string, draft: Record<string, unknown>, form: Pick<FormData, "has">): Promise<boolean> {
  if (!mergeSharedAnswers({}, draft, form).changed) return true;

  const admin = createSupabaseAdminClient() as any;
  const { data: row, error: readError } = await admin
    .from("firm_clients")
    .select("id, shared_answers, joined_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) {
    console.error("[firms] could not read shared answers", readError.message);
    return false;
  }
  if (!row?.joined_at) return true;

  const { next } = mergeSharedAnswers(row.shared_answers ?? {}, draft, form);
  const { error } = await admin.from("firm_clients").update({ shared_answers: next }).eq("id", row.id);
  if (error) {
    console.error("[firms] could not save shared answers", error.message);
    return false;
  }
  return true;
}

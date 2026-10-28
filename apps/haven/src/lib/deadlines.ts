import { formLimitedTo, recordFirmSharedAnswers } from "@/lib/firms/answers";
import { openLayoffEvent } from "@/lib/layoff-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * "Your deadlines": setup step 5 and the one-time prompt
 * (openspec change add-lead-urgency-ranking).
 *
 * Answers are stored twice: the client's own copy in
 * user_profiles.deadline_answers, and the firm's copy in
 * firm_clients.shared_answers. Only setup and the prompt write either one.
 * The chat never does.
 */

export const DEADLINE_KEYS = [
  "statusEndDate",
  "statusEndUnknown",
  "jobEnded",
  "lastWorkDay",
  "agencyDeadlineType",
  "agencyDeadlineDate",
  "travelPlanned",
  "travelDate"
] as const;

export type DeadlineKey = (typeof DEADLINE_KEYS)[number];
export type DeadlineAnswers = Partial<Record<DeadlineKey, string>>;

export const AGENCY_DEADLINE_TYPES = ["rfe", "interview", "biometrics", "other"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A real YYYY-MM-DD within ten years either side of today, else "". */
export function cleanDate(value: unknown, today = new Date()): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return "";
  if (Math.abs(ms - today.getTime()) > 3653 * DAY_MS) return "";
  return value;
}

/**
 * The deadline fields a form sent, cleaned. A field the form didn't send is
 * left out (so it isn't touched); a field it sent is always present, "" if
 * blank or invalid (so it's cleared). A date is dropped when the answer it
 * belongs to says it doesn't apply.
 */
export function deadlineDraftFromForm(form: Pick<FormData, "has" | "get">, today = new Date()): DeadlineAnswers {
  const raw = (key: DeadlineKey) => String(form.get(key) ?? "").trim();
  const out: DeadlineAnswers = {};
  const sent = (key: DeadlineKey) => form.has(key);

  const unknown = raw("statusEndUnknown") === "yes";
  if (sent("statusEndUnknown")) out.statusEndUnknown = unknown ? "yes" : "";
  if (sent("statusEndDate") || sent("statusEndUnknown")) out.statusEndDate = unknown ? "" : cleanDate(raw("statusEndDate"), today);

  const jobEnded = ["yes", "no"].includes(raw("jobEnded")) ? raw("jobEnded") : "";
  if (sent("jobEnded")) out.jobEnded = jobEnded;
  if (sent("lastWorkDay") || sent("jobEnded")) out.lastWorkDay = jobEnded === "yes" ? cleanDate(raw("lastWorkDay"), today) : "";

  const agencyType = (AGENCY_DEADLINE_TYPES as readonly string[]).includes(raw("agencyDeadlineType")) ? raw("agencyDeadlineType") : "";
  if (sent("agencyDeadlineType")) out.agencyDeadlineType = agencyType;
  if (sent("agencyDeadlineDate") || sent("agencyDeadlineType")) out.agencyDeadlineDate = agencyType ? cleanDate(raw("agencyDeadlineDate"), today) : "";

  const travel = ["yes", "no"].includes(raw("travelPlanned")) ? raw("travelPlanned") : "";
  if (sent("travelPlanned")) out.travelPlanned = travel;
  if (sent("travelDate") || sent("travelPlanned")) out.travelDate = travel === "yes" ? cleanDate(raw("travelDate"), today) : "";

  return out;
}

/** Apply cleaned answers to a stored set: values are set, "" removes. */
export function mergeDeadlineAnswers(current: DeadlineAnswers, draft: DeadlineAnswers): DeadlineAnswers {
  const next: DeadlineAnswers = { ...current };
  for (const key of DEADLINE_KEYS) {
    if (!(key in draft)) continue;
    if (draft[key]) next[key] = draft[key];
    else delete next[key];
  }
  return next;
}

/**
 * Save a deadline submission: the client's own copy, and the firm's copy
 * through the same path as other setup answers. `form` must be the
 * submitted form so fields it didn't send are left alone. Throws if either
 * copy couldn't be saved, so callers don't treat a failure as done.
 */
export async function saveDeadlineAnswers(userId: string, form: FormData) {
  const draft = deadlineDraftFromForm(form);
  if (Object.keys(draft).length === 0) return;
  const admin = createSupabaseAdminClient() as any;
  const { data: profile, error: readError } = await admin
    .from("user_profiles")
    .select("deadline_answers, current_visa_expiry_date, employment_status")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw new Error(`Could not read deadline answers: ${readError.message}`);
  if (profile) {
    const next = mergeDeadlineAnswers(profile.deadline_answers ?? {}, draft);
    const updatePatch: Record<string, unknown> = { deadline_answers: next };
    if ("statusEndDate" in draft || "statusEndUnknown" in draft) {
      updatePatch.current_visa_expiry_date = next.statusEndDate || null;
    }
    if (draft.jobEnded === "yes") {
      updatePatch.employment_status = "laid_off";
    }
    const { error } = await admin.from("user_profiles").update(updatePatch).eq("id", userId);
    if (error) throw new Error(`Could not save deadline answers: ${error.message}`);
    if (next.jobEnded === "yes" && next.lastWorkDay) {
      await openLayoffEvent(userId, next.lastWorkDay).catch(() => null);
    }
  }
  if (!(await recordFirmSharedAnswers(userId, draft, formLimitedTo(form, DEADLINE_KEYS)))) {
    throw new Error("Could not share deadline answers with the firm.");
  }
}

/** The client's saved deadline answers, to fill in the form again. */
export async function loadDeadlineAnswers(userId: string): Promise<DeadlineAnswers> {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("user_profiles").select("deadline_answers").eq("id", userId).maybeSingle();
  return (data?.deadline_answers ?? {}) as DeadlineAnswers;
}

/** Answered or skipped: don't show the one-time prompt again. */
export async function markDeadlinesPrompted(userId: string) {
  const admin = createSupabaseAdminClient() as any;
  await admin.from("user_profiles").update({ deadlines_prompted_at: new Date().toISOString() }).eq("id", userId).is("deadlines_prompted_at", null);
}

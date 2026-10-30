import { greenCardLinesForFirm, greenCardSponsorsForFirm } from "@/lib/firms/green-cards";
import { HELP_NEEDED_SENT_MARKER, normalizeHelpNeeded } from "@/lib/firms/help-needed";
import { isCustomQuestionKey } from "@/lib/firms/intake-question-catalog";
import { findActivePetition, resolveEffectivePriorityDate } from "@/lib/immigration-journey";
import { normalizePetitions } from "@/lib/petitions";
import { mapProfileRow } from "@/lib/profile-mapper";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * The setup answers a client shares with their firm.
 *
 * Kept as a separate copy on firm_clients.shared_answers rather than read
 * live from user_profiles, because the chat also updates user_profiles
 * (for example, "I was laid off" changes work status). Only the setup and
 * settings screens write this copy. A firm sees chats only through
 * lib/firms/shared-chats.ts, after the client agrees.
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
  "greenCardSponsor",
  "retainedPriorityDateSponsor",
  "priorityDate",
  "preferenceCategory",
  // Every green card filed for the client, one plain line each. Written by
  // the green card editor in settings, not by a form field.
  "greenCards",
  // The same green cards as JSON strings (id, sponsor, stage), so the firm's
  // document checklist can ask for sponsor documents per sponsor.
  "greenCardSponsors",
  "spouseVisaStatus",
  // Kept for clients who answered "Main concerns" before it was replaced.
  "topConcerns",
  // "What help do you need from your lawyer?"
  "helpNeeded",
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
  const savedStage =
    p.deadline_answers && typeof p.deadline_answers === "object" && typeof p.deadline_answers.greenCardStage === "string"
      ? p.deadline_answers.greenCardStage.trim()
      : "";
  // The active green card's own step first, then the step saved in Settings
  // (I-130 filed, consular processing…), then the old flags.
  const activeStage = findActivePetition(mapProfileRow(p))?.stage;
  const greenCardStage = activeStage || savedStage || (p.i485_filed
    ? "i485_filed"
    : p.i140_approved
      ? "i140_approved"
      : p.i140_filed
        ? "i140_filed"
        : p.perm_stage === "certified"
          ? "perm_certified"
          : p.perm_stage === "in_progress"
            ? "perm_in_progress"
            : "not_started");
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
    greenCardSponsor: (deadlineRecord.greenCardSponsor as string) ?? "",
    retainedPriorityDateSponsor: (deadlineRecord.retainedPriorityDateSponsor as string) ?? "",
    priorityDate: p.priority_date ?? "",
    preferenceCategory: p.preference_category,
    greenCards: greenCardLinesForFirm(deadlineRecord.immigrantPetitions),
    greenCardSponsors: greenCardSponsorsForFirm(deadlineRecord.immigrantPetitions),
    spouseVisaStatus: p.spouse_visa_status,
    topConcerns: p.top_concerns ?? [],
    helpNeeded: normalizeHelpNeeded(p.help_needed),
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
      (key) =>
        form.has(key) ||
        // "Main concerns" is no longer asked; earlier answers stay until a form sends them.
        (key === "helpNeeded" && form.has(HELP_NEEDED_SENT_MARKER))
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

/** True when all joined firms' copies are up to date (or there's no firm to update). */
export async function recordFirmSharedAnswers(userId: string, draft: Record<string, unknown>, form: Pick<FormData, "has">): Promise<boolean> {
  if (!mergeSharedAnswers({}, draft, form).changed) return true;

  const admin = createSupabaseAdminClient() as any;
  const { data: rows, error: readError } = await admin
    .from("firm_clients")
    .select("id, firm_id, shared_answers, joined_at, firms(intake_questions)")
    .eq("user_id", userId);
  if (readError) {
    console.error("[firms] could not read shared answers", readError.message);
    return false;
  }
  const joinedRows = (rows ?? []).filter((r: any) => Boolean(r.joined_at));
  if (joinedRows.length === 0) return true;

  for (const row of joinedRows) {
    const { next } = mergeSharedAnswers(row.shared_answers ?? {}, draft, form);

    // Keep all standard shared keys, but only retain custom questions configured for this firm
    // (including any firm-scoped suffixed keys generated during multi-firm onboarding collision resolution)
    const firmSuffix = row.firm_id ? `_${row.firm_id.slice(0, 8)}` : "";
    const allowedCustomKeys = new Set<string>();
    const suffixedKeyToOriginal = new Map<string, string>();
    if (Array.isArray(row.firms?.intake_questions)) {
      for (const q of row.firms.intake_questions) {
        if (isCustomQuestionKey(q.key)) {
          allowedCustomKeys.add(q.key);
          if (firmSuffix) {
            allowedCustomKeys.add(`${q.key}${firmSuffix}`);
            suffixedKeyToOriginal.set(`${q.key}${firmSuffix}`, q.key);
          }
        }
      }
    }

    const scopedAnswers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) {
      if (!isCustomQuestionKey(key)) {
        scopedAnswers[key] = value;
      } else if (allowedCustomKeys.has(key)) {
        const targetKey = suffixedKeyToOriginal.get(key) ?? key;
        scopedAnswers[targetKey] = value;
      }
    }

    const { error } = await admin.from("firm_clients").update({ shared_answers: scopedAnswers }).eq("id", row.id);
    if (error) {
      console.error("[firms] could not save shared answers", error.message);
      return false;
    }
  }
  return true;
}

/**
 * Replace the green card list in the firm's copy after the client saves green
 * cards in settings. An empty list removes it. True when the copy is up to
 * date (or there's no firm to update).
 */
export async function recordFirmSharedGreenCards(
  userId: string,
  rawPetitions: unknown,
  savedPriorityDate?: string | null
): Promise<boolean> {
  const admin = createSupabaseAdminClient() as any;
  const { data: rows, error: readError } = await admin
    .from("firm_clients")
    .select("id, shared_answers, joined_at")
    .eq("user_id", userId);
  if (readError) {
    console.error("[firms] could not read shared answers", readError.message);
    return false;
  }
  // A client can belong to more than one firm; each joined firm gets the list.
  for (const row of (rows ?? []).filter((r: any) => Boolean(r.joined_at))) {
    const next = withSharedGreenCards(row.shared_answers ?? {}, rawPetitions, savedPriorityDate);
    const { error } = await admin.from("firm_clients").update({ shared_answers: next }).eq("id", row.id);
    if (error) {
      console.error("[firms] could not save shared green cards", error.message);
      return false;
    }
  }
  return true;
}

/** The firm's copy with its green card list replaced. Leaves every other answer alone. */
export function withSharedGreenCards(
  current: SharedAnswers,
  rawPetitions: unknown,
  savedPriorityDate?: string | null
): SharedAnswers {
  const lines = greenCardLinesForFirm(rawPetitions);
  const sponsors = greenCardSponsorsForFirm(rawPetitions);
  const next: SharedAnswers = { ...current };
  if (lines.length) next.greenCards = lines;
  else delete next.greenCards;
  if (sponsors.length) next.greenCardSponsors = sponsors;
  else delete next.greenCardSponsors;

  // Also sync summary fields if petitions provided
  if (Array.isArray(rawPetitions) && rawPetitions.length === 0) {
    delete next.greenCardStage;
    delete next.greenCardSponsor;
    delete next.retainedPriorityDateSponsor;
    delete next.priorityDate;
  } else if (Array.isArray(rawPetitions)) {
    const norm = normalizePetitions(rawPetitions);
    const mockProfile = mapProfileRow({
      employer_name: current.employerName,
      immigrant_petitions: norm,
      deadline_answers: { immigrantPetitions: norm }
    });
    const active = findActivePetition(mockProfile);
    if (active) {
      next.greenCardSponsor = active.sponsorName;
      next.greenCardStage = active.stage;
      if (active.preferenceCategory && (active.preferenceCategory as string) !== "Not sure") {
        next.preferenceCategory = active.preferenceCategory;
      }
    } else {
      delete next.greenCardSponsor;
      delete next.greenCardStage;
    }
    const effective = resolveEffectivePriorityDate(mockProfile);
    if (effective.effectiveDate) {
      next.priorityDate = effective.effectiveDate.toISOString().slice(0, 10);
    } else if (savedPriorityDate) {
      next.priorityDate = savedPriorityDate;
    } else {
      delete next.priorityDate;
    }
    if (effective.isRetained && effective.retainedSponsorName) {
      next.retainedPriorityDateSponsor = effective.retainedSponsorName;
    } else {
      delete next.retainedPriorityDateSponsor;
    }
  }
  return next;
}

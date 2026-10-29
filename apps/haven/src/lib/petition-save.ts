import { resolveEffectivePriorityDate } from "@/lib/immigration-journey";
import {
  normalizePetitions,
  providesI140Protection,
  sponsorMatches,
  STAGE_ORDER,
  usesI140,
  validatePetition,
  type PetitionFieldError
} from "@/lib/petitions";
import { mapProfileRow } from "@/lib/profile-mapper";
import { isPetitionEnded, type ImmigrantPetition, type PermStage } from "@/types/domain";

// Pure planning for a green card save: checks the list and works out exactly
// what to write. The server action only loads the row and applies the plan.

export const MAX_PETITIONS = 12;

/**
 * The flat profile answers (I-140 approved, priority date, PERM stage) that
 * older screens read, kept in line with the green card records.
 */
export function flatFieldsFrom(
  petitions: ImmigrantPetition[],
  row: Record<string, unknown>
): Record<string, unknown> {
  const existingAnswers =
    row.deadline_answers && typeof row.deadline_answers === "object" && !Array.isArray(row.deadline_answers)
      ? (row.deadline_answers as Record<string, unknown>)
      : {};
  // The stored priority_date may be a copy written from the old green card
  // list. If so, drop it, so deleting or changing that green card doesn't
  // bring the old date back. A date the person typed themselves is kept.
  const previousDerived = resolveEffectivePriorityDate(mapProfileRow({ ...row, priority_date: null })).effectiveDate;
  const legacyIsCopy =
    typeof row.priority_date === "string" &&
    previousDerived instanceof Date &&
    previousDerived.toISOString().slice(0, 10) === row.priority_date.slice(0, 10);
  // Likewise a stored PERM filing date copied from a green card that's now gone.
  const previousPermDates = (mapProfileRow(row).immigrantPetitions ?? [])
    .map((p) => p.permFilingDate?.slice(0, 10))
    .filter(Boolean);
  const storedPerm = typeof row.perm_filing_date === "string" ? row.perm_filing_date.slice(0, 10) : null;
  const storedPermIsRemoved =
    storedPerm !== null &&
    previousPermDates.includes(storedPerm) &&
    !petitions.some((p) => p.permFilingDate?.slice(0, 10) === storedPerm);
  const profile = mapProfileRow({
    ...row,
    priority_date: legacyIsCopy ? null : row.priority_date,
    perm_filing_date: storedPermIsRemoved ? null : row.perm_filing_date,
    deadline_answers: { ...existingAnswers, immigrantPetitions: petitions }
  });
  const protecting = petitions.filter(providesI140Protection);
  const earliestApproval = protecting
    .map((p) => p.i140ApprovalDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const effective = resolveEffectivePriorityDate(profile);
  const patch: Record<string, unknown> = {
    i140_approved: protecting.length > 0,
    i140_approval_date: earliestApproval ?? null,
    i140_filed:
      petitions.some((p) => usesI140(p.petitionType) && STAGE_ORDER[p.stage] >= STAGE_ORDER.i140_filed) || protecting.length > 0,
    priority_date: effective.effectiveDate ? effective.effectiveDate.toISOString().slice(0, 10) : null
  };
  if (storedPermIsRemoved) patch.perm_filing_date = null;

  // PERM stage describes the current employer's green card, so only change it
  // when there is one that is still moving.
  if (profile.employmentStatus !== "laid_off" && profile.employerName) {
    const current = petitions.find(
      (p) =>
        !isPetitionEnded(p) &&
        (p.petitionType === "employer_sponsored" || p.petitionType === "concurrent_employer") &&
        sponsorMatches(p.sponsorName, profile.employerName)
    );
    if (current) {
      const stage: PermStage =
        current.stage === "pwd_recruitment" || current.stage === "perm_in_progress" ? "in_progress" : "certified";
      patch.perm_stage = stage;
      if (current.permFilingDate) patch.perm_filing_date = current.permFilingDate;
    }
  }
  return patch;
}


export type PetitionSavePlan =
  | { ok: true; petitions: ImmigrantPetition[]; update: Record<string, unknown> }
  | { ok: false; error: string; fieldErrors?: Record<string, PetitionFieldError[]> };

export function planPetitionSave(
  input: unknown,
  row: Record<string, unknown>,
  /** Check only these green cards. Others are saved as they were, even if an older one has a problem. */
  options: { onlyCheck?: string[] } = {}
): PetitionSavePlan {
  if (!Array.isArray(input)) return { ok: false, error: "Nothing to save." };
  if (input.length > MAX_PETITIONS) return { ok: false, error: `You can track up to ${MAX_PETITIONS} green cards.` };

  // Normalizing also strips any field we don't store.
  const petitions = normalizePetitions(input);
  if (petitions.length !== input.length) {
    return { ok: false, error: "Each green card needs an employer or petitioner name." };
  }

  const fieldErrors: Record<string, PetitionFieldError[]> = {};
  for (const p of petitions) {
    if (options.onlyCheck && !options.onlyCheck.includes(p.id)) continue;
    const errors = validatePetition(p);
    if (errors.length > 0) fieldErrors[p.id] = errors;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Some dates or stages need fixing.", fieldErrors };
  }

  const existing = (row.deadline_answers && typeof row.deadline_answers === "object" ? row.deadline_answers : {}) as Record<
    string,
    unknown
  >;
  const nextAnswers: Record<string, unknown> = { ...existing, immigrantPetitions: petitions };
  // Keep the first saved copy in its original form, once, so a rewrite can be undone.
  if (existing.immigrantPetitions !== undefined && existing.immigrantPetitionsLegacy === undefined) {
    nextAnswers.immigrantPetitionsLegacy = existing.immigrantPetitions;
  }

  return { ok: true, petitions, update: { deadline_answers: nextAnswers, ...flatFieldsFrom(petitions, row) } };
}

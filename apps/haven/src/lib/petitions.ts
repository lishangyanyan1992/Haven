import {
  isPetitionEnded,
  type ImmigrantPetition,
  type ImmigrantPetitionStage,
  type ImmigrantPetitionType,
  type PetitionEndedReason,
  type PreferenceCategory
} from "@/types/domain";

// The one place green card petitions are read, matched and checked.
// Petitions are saved as JSON inside deadline_answers, and older records used
// different field names, so everything goes through normalizePetitions first.

const PETITION_TYPES: ImmigrantPetitionType[] = [
  "employer_sponsored",
  "self_petition_niw",
  "self_petition_eb1a",
  "concurrent_employer",
  "family_marriage_usc",
  "family_marriage_lpr",
  "family_preference",
  "investment_eb5",
  "humanitarian_asylum",
  "humanitarian_other",
  "diversity_lottery",
  "other"
];
const STAGES: ImmigrantPetitionStage[] = [
  "not_started",
  "pwd_recruitment",
  "perm_in_progress",
  "perm_certified",
  "i140_filed",
  "i140_approved",
  "i130_filed",
  "i130_approved",
  "consular_processing",
  "conditional_resident",
  "i485_filed",
  "i485_approved",
  "withdrawn"
];
const CATEGORIES: PreferenceCategory[] = [
  "EB-1",
  "EB-2",
  "EB-3",
  "EB-2 NIW",
  "EB-1A",
  "EB-1B",
  "EB-1C",
  "EB-4",
  "EB-5",
  "Immediate Relative (Spouse)",
  "Immediate Relative (Parent/Child)",
  "F-1",
  "F-2A",
  "F-2B",
  "F-3",
  "F-4",
  "Diversity Visa",
  "Asylum Adjustment",
  "Not sure"
];
const ENDED_REASONS: PetitionEndedReason[] = ["layoff", "job_change", "withdrawn", "denied", "other"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Stage order from first step to green card. Withdrawn sorts first: it says nothing about progress. */
export const STAGE_ORDER: Record<string, number> = {
  withdrawn: -1,
  // Before any filing; above withdrawn so it still counts as a real step.
  not_started: -0.5,
  pwd_recruitment: 0,
  perm_in_progress: 1,
  perm_certified: 2,
  i140_filed: 3,
  i140_approved: 4,
  i130_filed: 3,
  i130_approved: 4,
  consular_processing: 4,
  i485_filed: 5,
  conditional_resident: 5,
  i485_approved: 6
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isoDate(value: unknown): string | undefined {
  const v = text(value);
  return v && ISO_DATE.test(v) ? v : undefined;
}

function pick<T extends string>(allowed: readonly T[], ...values: unknown[]): T | undefined {
  for (const value of values) {
    const v = text(value);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  }
  return undefined;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "petition";
}

/**
 * Reads saved petitions in any format we have written, and returns them in the
 * current shape. Records without a sponsor name are dropped.
 */
export function normalizePetitions(raw: unknown): ImmigrantPetition[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const result: ImmigrantPetition[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const r = entry as Record<string, unknown>;
    const sponsorName = text(r.sponsorName) ?? text(r.sponsor);
    if (!sponsorName) return;

    const stage = pick(STAGES, r.stage) ?? "pwd_recruitment";
    const isWithdrawn = Boolean(r.isWithdrawn) || stage === "withdrawn";
    let endedReason = pick(ENDED_REASONS, r.endedReason);
    if (!endedReason && isWithdrawn) endedReason = "withdrawn";
    const endedDate = isoDate(r.endedDate) ?? (endedReason ? isoDate(r.withdrawnDate) : undefined);

    let id = text(r.id) ?? `pet-${index + 1}-${slug(sponsorName)}`;
    while (seenIds.has(id)) id = `${id}-${index + 1}`;
    seenIds.add(id);

    const petition: ImmigrantPetition = {
      id,
      sponsorName,
      petitionType: pick(PETITION_TYPES, r.petitionType, r.petitionKind, r.type) ?? (text(r.petitionType) as ImmigrantPetitionType) ?? "employer_sponsored",
      preferenceCategory: pick(CATEGORIES, r.preferenceCategory, r.category) ?? (text(r.preferenceCategory) as PreferenceCategory) ?? "Not sure",
      stage: pick(STAGES, r.stage) ?? (text(r.stage) as ImmigrantPetitionStage) ?? "pwd_recruitment"
    };
    const optional: Partial<ImmigrantPetition> = {
      // The lottery has no priority date.
      priorityDate: r.petitionType === "diversity_lottery" ? undefined : isoDate(r.priorityDate),
      isPriorityDateRecaptured: r.isPriorityDateRecaptured === true ? true : undefined,
      permFilingDate: isoDate(r.permFilingDate),
      permCertifiedDate: isoDate(r.permCertifiedDate),
      i140ReceiptNumber: text(r.i140ReceiptNumber),
      i140FiledDate: isoDate(r.i140FiledDate),
      i140ApprovalDate: isoDate(r.i140ApprovalDate),
      petitionFiledDate: isoDate(r.petitionFiledDate),
      petitionApprovalDate: isoDate(r.petitionApprovalDate),
      isRevocationProtected: r.isRevocationProtected === true ? true : undefined,
      endedReason,
      endedDate,
      notes: text(r.notes)
    };
    for (const [key, value] of Object.entries(optional)) {
      if (value !== undefined) (petition as unknown as Record<string, unknown>)[key] = value;
    }
    result.push(petition);
  });

  return result;
}

/** Name pieces a sponsor can be known by: the main name, comma parts and anything in parentheses. */
function sponsorAliases(name: string): string[] {
  const clean = (v: string) =>
    v
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const inParens = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const main = name.replace(/\([^)]*\)/g, " ");
  const parts = [main, ...main.split(","), ...inParens];
  return [...new Set(parts.map(clean).filter((v) => v.length > 0))];
}

/**
 * True when two names refer to the same employer. Ignores case, punctuation,
 * company suffixes and text in parentheses, and treats "Parent (Brand)" and
 * "A, B" as known by each part.
 */
export function sponsorMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const left = sponsorAliases(a);
  const right = sponsorAliases(b);
  return left.some((x) => right.some((y) => x === y));
}

export function isApprovedStage(stage: ImmigrantPetitionStage): boolean {
  return stage === "i140_approved" || stage === "i485_filed" || stage === "i485_approved";
}

/**
 * An approved I-140 keeps the priority date and AC21 protections after the
 * job ends, unless it was denied, or the employer withdrew it within 180 days
 * of approval (8 CFR § 205.1).
 */
export function providesI140Protection(p: ImmigrantPetition): boolean {
  // Only an I-140 gives I-140 protection; a family green card at I-485 doesn't.
  if (!usesI140(p.petitionType)) return false;
  // A record marked "withdrawn" as its stage only counts if we know it was approved first.
  // Consular processing comes after an approved I-140 on the employer path.
  const wasApproved =
    isApprovedStage(p.stage) ||
    ((p.stage === "withdrawn" || p.stage === "consular_processing") && Boolean(p.i140ApprovalDate));
  if (!wasApproved) return false;
  if (p.endedReason === "denied") return false;
  if (p.endedReason === "withdrawn") {
    if (p.isRevocationProtected) return true;
    const approved = p.i140ApprovalDate ? Date.parse(p.i140ApprovalDate) : NaN;
    const ended = p.endedDate ? Date.parse(p.endedDate) : NaN;
    if (Number.isNaN(approved) || Number.isNaN(ended)) return false;
    return ended - approved >= 180 * 24 * 60 * 60 * 1000;
  }
  return true;
}

export type PetitionFieldError = { field: keyof ImmigrantPetition; message: string };

function before(a?: string, b?: string): boolean {
  return Boolean(a && b && a < b);
}

/** Problems a user must fix before a petition can be saved. */
/** Paths that file an I-140: employer-sponsored and self-petitions. */
export function usesI140(type: string | undefined): boolean {
  return ["employer_sponsored", "concurrent_employer", "self_petition_niw", "self_petition_eb1a"].includes(type ?? "employer_sponsored");
}

/** Paths that go through PERM labor certification. */
export function usesPerm(type: string | undefined): boolean {
  return ["employer_sponsored", "concurrent_employer"].includes(type ?? "employer_sponsored");
}

export function validatePetition(p: ImmigrantPetition): PetitionFieldError[] {
  const errors: PetitionFieldError[] = [];
  if (!p.sponsorName?.trim()) errors.push({ field: "sponsorName", message: "Add the employer or petitioner name." });
  if (before(p.petitionApprovalDate, p.petitionFiledDate)) {
    errors.push({ field: "petitionApprovalDate", message: "The approval can't be before the petition was filed." });
  }
  if (usesI140(p.petitionType) && before(p.i140ApprovalDate, p.i140FiledDate)) {
    errors.push({ field: "i140ApprovalDate", message: "I-140 approval can't be before the I-140 was filed." });
  }
  if (usesPerm(p.petitionType) && before(p.permCertifiedDate, p.permFilingDate)) {
    errors.push({ field: "permCertifiedDate", message: "PERM approval can't be before PERM was filed." });
  }
  if (usesPerm(p.petitionType) && before(p.i140ApprovalDate, p.permFilingDate)) {
    errors.push({ field: "i140ApprovalDate", message: "I-140 approval can't be before PERM was filed." });
  }
  // Family, investor, humanitarian and lottery paths have no I-140 or PERM.
  if (usesI140(p.petitionType) && isApprovedStage(p.stage) && !p.i140ApprovalDate) {
    errors.push({ field: "i140ApprovalDate", message: "Add the date the I-140 was approved." });
  }
  // Only checked while the green card is still moving; an ended one is kept as entered.
  const beforePermFiled =
    usesPerm(p.petitionType) &&
    !p.endedReason &&
    (p.stage === "pwd_recruitment" || p.stage === "perm_in_progress") &&
    !p.permFilingDate;
  if (beforePermFiled && p.priorityDate && !p.isPriorityDateRecaptured) {
    errors.push({
      field: "priorityDate",
      message:
        "This green card has no priority date of its own until PERM is filed. If the date carries over from an earlier green card, tick \"Carried over\"."
    });
  }
  if (p.endedReason && !p.endedDate) {
    errors.push({ field: "endedDate", message: "Add the date this green card ended." });
  }
  return errors;
}

/** Petitions that are still moving forward. */
export function activePetitions(petitions: ImmigrantPetition[]): ImmigrantPetition[] {
  return petitions.filter((p) => !isPetitionEnded(p));
}

export const ENDED_REASON_LABELS: Record<PetitionEndedReason, string> = {
  layoff: "Ended at layoff",
  job_change: "Ended at job change",
  withdrawn: "Withdrawn by employer",
  denied: "Denied",
  other: "Ended"
};

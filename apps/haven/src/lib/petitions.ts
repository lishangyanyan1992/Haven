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
      priorityDate: isoDate(r.priorityDate),
      isPriorityDateRecaptured: r.isPriorityDateRecaptured === true ? true : undefined,
      permFilingDate: isoDate(r.permFilingDate),
      permCertifiedDate: isoDate(r.permCertifiedDate),
      i140ReceiptNumber: text(r.i140ReceiptNumber),
      i140FiledDate: isoDate(r.i140FiledDate),
      i140ApprovalDate: isoDate(r.i140ApprovalDate),
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
  // A record marked "withdrawn" as its stage only counts if we know it was approved first.
  const wasApproved = isApprovedStage(p.stage) || (p.stage === "withdrawn" && Boolean(p.i140ApprovalDate));
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
export function validatePetition(p: ImmigrantPetition): PetitionFieldError[] {
  const errors: PetitionFieldError[] = [];
  if (!p.sponsorName?.trim()) errors.push({ field: "sponsorName", message: "Add the employer or petitioner name." });
  if (before(p.i140ApprovalDate, p.i140FiledDate)) {
    errors.push({ field: "i140ApprovalDate", message: "I-140 approval can't be before the I-140 was filed." });
  }
  if (before(p.permCertifiedDate, p.permFilingDate)) {
    errors.push({ field: "permCertifiedDate", message: "PERM approval can't be before PERM was filed." });
  }
  if (before(p.i140ApprovalDate, p.permFilingDate)) {
    errors.push({ field: "i140ApprovalDate", message: "I-140 approval can't be before PERM was filed." });
  }
  if (isApprovedStage(p.stage) && !p.i140ApprovalDate) {
    errors.push({ field: "i140ApprovalDate", message: "Add the date the I-140 was approved." });
  }
  // Only checked while the green card is still moving; an ended one is kept as entered.
  const beforePermFiled =
    !p.endedReason && (p.stage === "pwd_recruitment" || p.stage === "perm_in_progress") && !p.permFilingDate;
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

/**
 * Synthesizes initial ImmigrantPetition records for a profile that has flat
 * green card fields (stage, priority date, I-140 flags, sponsors) but no
 * immigrantPetitions entries yet.
 */
export function seedPetitionsFromLegacyProfile(profile: {
  immigrantPetitions?: ImmigrantPetition[];
  greenCardPathway?: string | null;
  permStage?: string | null;
  permFilingDate?: string | null;
  i140Filed?: boolean | null;
  i140Approved?: boolean | null;
  i140ApprovalDate?: string | null;
  i485Filed?: boolean | null;
  priorityDate?: string | null;
  preferenceCategory?: string | null;
  greenCardSponsor?: string | null;
  retainedPriorityDate?: string | null;
  retainedPriorityDateSponsor?: string | null;
  employerName?: string | null;
}): ImmigrantPetition[] {
  if (profile.immigrantPetitions && profile.immigrantPetitions.length > 0) {
    return profile.immigrantPetitions;
  }

  const hasFlatActivity =
    Boolean(profile.priorityDate) ||
    Boolean(profile.i140Approved) ||
    Boolean(profile.i140Filed) ||
    Boolean(profile.i485Filed) ||
    (Boolean(profile.permStage) && profile.permStage !== "not_started") ||
    Boolean(profile.greenCardSponsor) ||
    Boolean(profile.retainedPriorityDateSponsor);

  if (!hasFlatActivity) {
    return [];
  }

  const seeded: ImmigrantPetition[] = [];
  const primarySponsor =
    profile.greenCardSponsor?.trim() ||
    profile.employerName?.trim() ||
    "Current Employer";

  const retainedSponsor = profile.retainedPriorityDateSponsor?.trim();
  const hasSeparateRetained =
    Boolean(retainedSponsor) &&
    Boolean(profile.i140Approved || profile.retainedPriorityDate) &&
    !sponsorMatches(retainedSponsor, primarySponsor);

  // If there's a distinct prior sponsor for an approved I-140 / locked-in priority date:
  if (hasSeparateRetained && retainedSponsor) {
    seeded.push({
      id: `pet-prior-${slug(retainedSponsor)}`,
      sponsorName: retainedSponsor,
      petitionType: "employer_sponsored",
      preferenceCategory: (profile.preferenceCategory as PreferenceCategory) || "EB-2",
      stage: "i140_approved",
      priorityDate: profile.retainedPriorityDate || profile.priorityDate || undefined,
      i140ApprovalDate: profile.i140ApprovalDate || profile.priorityDate || undefined,
      endedReason: "job_change",
      notes: "Seeded from prior approved I-140 sponsor in profile"
    });
  }

  // Derive stage for the current/primary petition:
  let stage: ImmigrantPetitionStage = "pwd_recruitment";
  if (profile.i485Filed) stage = "i485_filed";
  else if (profile.i140Approved && !hasSeparateRetained) stage = "i140_approved";
  else if (profile.i140Filed) stage = "i140_filed";
  else if (profile.permStage === "certified") stage = "perm_certified";
  else if (profile.permStage === "in_progress") stage = "perm_in_progress";

  const primaryPriorityDate = hasSeparateRetained
    ? undefined
    : (profile.priorityDate || undefined);

  let petitionType: ImmigrantPetitionType = "employer_sponsored";
  if (profile.greenCardPathway === "EB-2 NIW" || profile.preferenceCategory === "EB-2 NIW") {
    petitionType = "self_petition_niw";
  } else if (profile.preferenceCategory === "EB-1A") {
    petitionType = "self_petition_eb1a";
  } else if (profile.greenCardPathway?.includes("Marriage")) {
    petitionType = "family_marriage_usc";
  }

  seeded.push({
    id: `pet-primary-${slug(primarySponsor)}`,
    sponsorName: primarySponsor,
    petitionType,
    preferenceCategory: (profile.preferenceCategory as PreferenceCategory) || "EB-2",
    stage,
    priorityDate: primaryPriorityDate,
    isPriorityDateRecaptured: hasSeparateRetained ? true : undefined,
    permFilingDate: profile.permFilingDate || undefined,
    i140ApprovalDate: (!hasSeparateRetained && profile.i140Approved) ? (profile.i140ApprovalDate || undefined) : undefined
  });

  return seeded;
}

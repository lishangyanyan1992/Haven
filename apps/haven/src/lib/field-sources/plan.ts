/**
 * Where each profile and green card value came from, and the rules for
 * writing details read from a document. Pure: the database side is in
 * ./store.ts, so these rules are checked without one
 * (evals/documents/apply-facts.check.ts).
 *
 * The rule that matters most: a document never replaces a value a person
 * typed. It fills empty fields and fields it filled before; when it
 * disagrees with a person, both values are kept and shown.
 */

import type { FactSet, FactTarget } from "@/lib/document-facts/catalog";
import { STAGE_ORDER, sponsorMatches } from "@/lib/petitions";
import type { ImmigrantPetition, ImmigrantPetitionStage, PreferenceCategory } from "@/types/domain";

export type FieldOrigin = "document" | "person" | "document_deleted";
export type Resolution = "open" | "kept_mine";

/** One row of field_sources, in code shape. */
export type FieldSource = {
  fieldKey: string;
  origin: FieldOrigin;
  value: string | null;
  documentFactId: string | null;
  documentValue: string | null;
  documentLabel: string | null;
  documentPage: number | null;
  resolution: Resolution | null;
};

export type FactState = "filled" | "needs_check" | "not_used_person_value" | "not_used_record_removed" | "no_target";

/** Profile values a document can fill. */
export const PROFILE_FIELDS = ["visaType", "countryOfBirth", "employerName", "statusEndDate"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileValues = Partial<Record<ProfileField, string | null>>;

export const PETITION_FIELDS = [
  "sponsorName",
  "i140ReceiptNumber",
  "priorityDate",
  "preferenceCategory",
  "i140FiledDate",
  "i140ApprovalDate",
  "permFilingDate",
  "permCertifiedDate"
] as const;
export type PetitionField = (typeof PETITION_FIELDS)[number];

export function petitionFieldKey(petitionId: string, field: PetitionField | string) {
  return `petition:${petitionId}.${field}`;
}

export function parseFieldKey(
  key: string
): { kind: "profile"; field: ProfileField } | { kind: "petition"; petitionId: string; field: PetitionField } | null {
  if ((PROFILE_FIELDS as readonly string[]).includes(key)) return { kind: "profile", field: key as ProfileField };
  const m = key.match(/^petition:(.+)\.([A-Za-z0-9]+)$/);
  if (m && (PETITION_FIELDS as readonly string[]).includes(m[2])) {
    return { kind: "petition", petitionId: m[1], field: m[2] as PetitionField };
  }
  return null;
}

const VISA_TYPES = new Set(["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"]);
const CATEGORIES = new Set(["EB-1", "EB-2", "EB-3", "EB-2 NIW"]);

/** Same value, ignoring case and spacing for names; exact for dates and codes. */
export function sameValue(a: string | null | undefined, b: string | null | undefined) {
  const x = (a ?? "").trim();
  const y = (b ?? "").trim();
  if (!x || !y) return x === y;
  return x.toLowerCase().replace(/\s+/g, " ") === y.toLowerCase().replace(/\s+/g, " ");
}

export type PlanFact = {
  id: string;
  key: string;
  value: string | null;
  confident: boolean;
  page: number | null;
};

export type PlanInput = {
  set: FactSet;
  facts: PlanFact[];
  document: { id: string; label: string; petitionId: string | null };
  profile: ProfileValues;
  petitions: ImmigrantPetition[];
  sources: Map<string, FieldSource>;
  /** The user has a trusted I-94 admit-until date from any document. */
  hasI94StatusDate: boolean;
  newPetitionId: (sponsorName: string) => string;
};

export type FactOutcome = { factId: string; state: FactState; appliedTo: string | null };

export type Plan = {
  /** The green card the document belongs to (sponsor documents only). */
  petitionId: string | null;
  createdPetition: ImmigrantPetition | null;
  petitions: ImmigrantPetition[];
  petitionsChanged: boolean;
  profilePatch: ProfileValues;
  sourceUpserts: FieldSource[];
  outcomes: FactOutcome[];
};

function targetOf(set: FactSet, key: string): FactTarget | null {
  return set.facts.find((f) => f.key === key)?.target ?? null;
}

/** The stage a document proves, if it is later than the green card's own. */
function provenStage(set: FactSet, facts: PlanFact[]): ImmigrantPetitionStage | null {
  const has = (key: string) => facts.some((f) => f.key === key && f.confident && f.value);
  if (set.id === "i140") return has("i140.approval_date") ? "i140_approved" : "i140_filed";
  if (set.id === "perm") return has("perm.certification_date") ? "perm_certified" : "perm_in_progress";
  return null;
}

export function planFactApplication(input: PlanInput): Plan {
  const { set, facts, document } = input;
  const outcomes: FactOutcome[] = [];
  const sourceUpserts: FieldSource[] = [];
  const profilePatch: ProfileValues = {};
  let petitions = input.petitions.map((p) => ({ ...p }));
  let petitionsChanged = false;
  let createdPetition: ImmigrantPetition | null = null;

  // 1. Which green card a sponsor document belongs to: its link, then the name on it.
  let petitionId: string | null = null;
  if (set.sponsorScoped) {
    const sponsorFact = facts.find((f) => targetOf(set, f.key) === "petition.sponsorName" && f.confident && f.value);
    if (document.petitionId && petitions.some((p) => p.id === document.petitionId)) {
      petitionId = document.petitionId;
    } else if (sponsorFact) {
      petitionId = petitions.find((p) => sponsorMatches(p.sponsorName, sponsorFact.value))?.id ?? null;
      if (!petitionId) {
        const stage = provenStage(set, facts) ?? "i140_filed";
        const category = facts.find((f) => f.key.endsWith(".category") && f.confident)?.value;
        createdPetition = {
          id: input.newPetitionId(sponsorFact.value!),
          sponsorName: sponsorFact.value!,
          petitionType: "employer_sponsored",
          preferenceCategory: (category && CATEGORIES.has(category) ? category : "Not sure") as PreferenceCategory,
          stage
        };
        petitions = [...petitions, createdPetition];
        petitionId = createdPetition.id;
        petitionsChanged = true;
      }
    } else if (petitions.length === 1) {
      petitionId = petitions[0].id;
    }
  }

  const petition = () => petitions.find((p) => p.id === petitionId) ?? null;

  // A document that proves a later step moves the green card forward. Never back.
  const proven = set.sponsorScoped ? provenStage(set, facts) : null;
  const current = petition();
  if (proven && current && !createdPetition && STAGE_ORDER[current.stage] >= 0 && STAGE_ORDER[proven] > STAGE_ORDER[current.stage]) {
    petitions = petitions.map((p) => (p.id === current.id ? { ...p, stage: proven } : p));
    petitionsChanged = true;
  }

  // 2. Each detail.
  for (const fact of facts) {
    const target = targetOf(set, fact.key);
    if (!fact.confident || !fact.value) {
      outcomes.push({ factId: fact.id, state: "needs_check", appliedTo: null });
      continue;
    }
    if (!target) {
      outcomes.push({ factId: fact.id, state: "no_target", appliedTo: null });
      continue;
    }
    // The I-94 is the real status end date; the H-1B approval's date is shown only.
    if (fact.key === "h1b.valid_to" && input.hasI94StatusDate) {
      outcomes.push({ factId: fact.id, state: "no_target", appliedTo: null });
      continue;
    }
    if (target === "visaType" && !VISA_TYPES.has(fact.value)) {
      outcomes.push({ factId: fact.id, state: "no_target", appliedTo: null });
      continue;
    }

    let fieldKey: string;
    let currentValue: string | null;
    if (target.startsWith("petition.")) {
      const p = petition();
      if (!p) {
        // No green card to put it in, and no sponsor name to start one.
        outcomes.push({ factId: fact.id, state: "needs_check", appliedTo: null });
        continue;
      }
      const field = target.slice("petition.".length) as PetitionField;
      fieldKey = petitionFieldKey(p.id, field);
      if (field === "sponsorName") {
        // Used to find the green card; the name on file is kept.
        outcomes.push({ factId: fact.id, state: "filled", appliedTo: fieldKey });
        if (createdPetition?.id === p.id) sourceUpserts.push(documentSource(fieldKey, p.sponsorName, fact, document));
        continue;
      }
      if (field === "preferenceCategory" && !CATEGORIES.has(fact.value)) {
        outcomes.push({ factId: fact.id, state: "no_target", appliedTo: null });
        continue;
      }
      currentValue = (p[field] as string | undefined) ?? null;
    } else {
      fieldKey = target;
      currentValue = input.profile[target as ProfileField] ?? null;
    }

    const source = input.sources.get(fieldKey);
    // A value with no record that is already filled was typed in setup or Settings.
    const personOwned = source ? source.origin === "person" : Boolean(currentValue?.trim());
    // A new green card's fields are the document's own, not a person's.
    const isNewRecord = createdPetition !== null && fieldKey.startsWith(`petition:${createdPetition.id}.`);

    if (!personOwned || isNewRecord) {
      write(fieldKey, fact.value);
      sourceUpserts.push(documentSource(fieldKey, fact.value, fact, document));
      outcomes.push({ factId: fact.id, state: "filled", appliedTo: fieldKey });
    } else if (sameValue(currentValue, fact.value)) {
      // The document confirms what the person entered.
      sourceUpserts.push(documentSource(fieldKey, currentValue, fact, document));
      outcomes.push({ factId: fact.id, state: "filled", appliedTo: fieldKey });
    } else {
      const keptBefore = source?.resolution === "kept_mine" && sameValue(source.documentValue, fact.value);
      sourceUpserts.push({
        fieldKey,
        origin: "person",
        value: currentValue,
        documentFactId: fact.id,
        documentValue: fact.value,
        documentLabel: document.label,
        documentPage: fact.page,
        resolution: keptBefore ? "kept_mine" : "open"
      });
      outcomes.push({ factId: fact.id, state: "not_used_person_value", appliedTo: fieldKey });
    }
  }

  function write(fieldKey: string, value: string) {
    const parsed = parseFieldKey(fieldKey);
    if (!parsed) return;
    if (parsed.kind === "profile") {
      profilePatch[parsed.field] = value;
      return;
    }
    petitions = petitions.map((p) => (p.id === parsed.petitionId ? { ...p, [parsed.field]: value } : p));
    petitionsChanged = true;
  }

  return { petitionId, createdPetition, petitions, petitionsChanged, profilePatch, sourceUpserts, outcomes };
}

function documentSource(
  fieldKey: string,
  value: string | null,
  fact: PlanFact,
  document: PlanInput["document"]
): FieldSource {
  return {
    fieldKey,
    origin: "document",
    value,
    documentFactId: fact.id,
    documentValue: null,
    documentLabel: document.label,
    documentPage: fact.page,
    resolution: null
  };
}

// ── People changing values ───────────────────────────────────────────────────

/**
 * What to record when a person saves a field. A change to a document's value
 * keeps the document's value beside it ("You changed this. Your I-140 notice
 * says …"), marked as their choice. An unchanged save of a value from a
 * deleted document confirms it as theirs.
 */
export function sourceAfterPersonSave(
  fieldKey: string,
  previous: string | null,
  next: string | null,
  source: FieldSource | undefined
): FieldSource | null {
  const changed = !sameValue(previous, next);
  if (!source) {
    return changed ? personSource(fieldKey, next) : null;
  }
  if (source.origin === "document_deleted") {
    return personSource(fieldKey, next);
  }
  if (!changed) return null;
  if (source.origin === "document") {
    if (sameValue(next, source.value)) return null;
    return {
      ...source,
      origin: "person",
      value: next,
      documentValue: source.value,
      resolution: next ? "kept_mine" : null
    };
  }
  // Already a person's value.
  if (source.documentValue && sameValue(next, source.documentValue)) {
    // They typed the document's value: it now agrees with the document.
    return { ...source, origin: "document", value: next, documentValue: null, resolution: null };
  }
  return { ...source, value: next };
}

function personSource(fieldKey: string, value: string | null): FieldSource {
  return {
    fieldKey,
    origin: "person",
    value,
    documentFactId: null,
    documentValue: null,
    documentLabel: null,
    documentPage: null,
    resolution: null
  };
}

// ── Labels ───────────────────────────────────────────────────────────────────

export type SourceLabel = {
  tone: "document" | "person" | "warning";
  text: string;
  /** Set when there is a document value to switch to or a choice to undo. */
  documentValue?: string | null;
  canUseDocument: boolean;
  canKeepMine: boolean;
  open: boolean;
};

function pageText(page: number | null) {
  return page ? `, page ${page}` : "";
}

/** The one label a field shows. Formats values with `format` for display. */
export function labelFor(
  source: FieldSource | undefined,
  format: (value: string | null) => string = (v) => v ?? ""
): SourceLabel {
  if (!source || (source.origin === "person" && !source.documentValue)) {
    return { tone: "person", text: "You entered this", canUseDocument: false, canKeepMine: false, open: false };
  }
  const doc = source.documentLabel ? `your ${source.documentLabel}` : "a document";
  if (source.origin === "document") {
    return {
      tone: "document",
      text: `From ${doc}${pageText(source.documentPage)}`,
      canUseDocument: false,
      canKeepMine: false,
      open: false
    };
  }
  if (source.origin === "document_deleted") {
    return {
      tone: "warning",
      text: "From a document you deleted — please confirm",
      canUseDocument: false,
      canKeepMine: false,
      open: true
    };
  }
  // A person's value next to a different document value.
  const docSays = `${doc.charAt(0).toUpperCase()}${doc.slice(1)} says ${format(source.documentValue)}`;
  if (source.resolution === "open") {
    return { tone: "warning", text: docSays, documentValue: source.documentValue, canUseDocument: true, canKeepMine: true, open: true };
  }
  return {
    tone: "person",
    text: `You changed this. ${docSays}`,
    documentValue: source.documentValue,
    canUseDocument: Boolean(source.documentFactId),
    canKeepMine: false,
    open: false
  };
}

// ── Deleting a document ──────────────────────────────────────────────────────

/**
 * A field's source after the document behind it is deleted. Values it filled
 * keep their value and ask to be confirmed; a disagreement with only that
 * document goes away. Null when the field didn't involve that document.
 */
export function sourceAfterDocumentDeleted(source: FieldSource, deletedFactIds: Set<string>): FieldSource | null {
  if (!source.documentFactId || !deletedFactIds.has(source.documentFactId)) return null;
  if (source.origin === "document") {
    return { ...source, origin: "document_deleted", documentFactId: null };
  }
  // A person's value next to the deleted document's: just the person's now.
  return { ...source, documentFactId: null, documentValue: null, documentLabel: null, documentPage: null, resolution: null };
}

// ── Saving green card changes without losing others ──────────────────────────

/**
 * Apply only the changes a document made (original → next, for the touched
 * green cards) onto the list as it is saved now. Anything else saved in the
 * meantime — another document, a Settings edit — is kept. A green card created
 * by the document is added; one removed meanwhile stays removed.
 */
export function mergePetitionChanges(
  original: ImmigrantPetition[],
  next: ImmigrantPetition[],
  current: ImmigrantPetition[],
  touchedIds: string[]
): ImmigrantPetition[] {
  let out = current.map((p) => ({ ...p }));
  for (const id of touchedIds) {
    const after = next.find((p) => p.id === id);
    if (!after) continue;
    const before = original.find((p) => p.id === id);
    const now = out.find((p) => p.id === id);
    if (!before) {
      if (!now) out.push({ ...after });
      continue;
    }
    if (!now) continue;
    const changes: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const a = (after as unknown as Record<string, unknown>)[key];
      if (a !== (before as unknown as Record<string, unknown>)[key]) changes[key] = a;
    }
    out = out.map((p) => (p.id === id ? ({ ...p, ...changes } as ImmigrantPetition) : p));
  }
  return out;
}

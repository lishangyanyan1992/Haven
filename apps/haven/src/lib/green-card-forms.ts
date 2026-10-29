import { GREEN_CARD_PATHWAYS, getStagesForPathway, type GreenCardPathwayItem } from "@/lib/visas";
import { usesI140, usesPerm } from "@/lib/petitions";
import type { ImmigrantPetition } from "@/types/domain";

/**
 * What the green card editor shows for each kind of green card: its steps,
 * its dates, and what to call the sponsor. One place, so family, investor,
 * humanitarian and lottery green cards never get PERM or I-140 fields.
 */

/** Every pathway, including two the intake list leaves out. */
export const PATHWAY_OPTIONS: Array<Pick<GreenCardPathwayItem, "id" | "label" | "category" | "defaultPreferenceCategory">> = [
  ...GREEN_CARD_PATHWAYS.filter((p) => p.id !== "other"),
  {
    id: "concurrent_employer",
    label: "Second employer, at the same time (EB-2/EB-3)",
    category: "Employment-Based",
    defaultPreferenceCategory: "EB-2"
  },
  {
    id: "humanitarian_other",
    label: "Humanitarian: VAWA, U/T visa, SIJS, other",
    category: "Humanitarian",
    defaultPreferenceCategory: "Not sure"
  },
  ...GREEN_CARD_PATHWAYS.filter((p) => p.id === "other")
];

export type DateFieldKey =
  | "permFilingDate"
  | "permCertifiedDate"
  | "i140FiledDate"
  | "i140ApprovalDate"
  | "petitionFiledDate"
  | "petitionApprovalDate"
  | "priorityDate";

/** The form that starts each non-I-140 path, for date labels. */
export function firstPetitionForm(type: string): string | null {
  if (type.startsWith("family_")) return "I-130";
  if (type === "investment_eb5") return "I-526";
  if (type === "humanitarian_other") return "Petition (I-360, I-918, I-914…)";
  if (type === "other") return "Petition";
  // Asylum adjustment and the lottery start straight at I-485 or consular processing.
  return null;
}

export function dateFieldsFor(type: string): Array<{ key: DateFieldKey; label: string }> {
  const fields: Array<{ key: DateFieldKey; label: string }> = [];
  if (usesPerm(type)) {
    fields.push({ key: "permFilingDate", label: "PERM filed" }, { key: "permCertifiedDate", label: "PERM approved" });
  }
  if (usesI140(type)) {
    fields.push({ key: "i140FiledDate", label: "I-140 filed" }, { key: "i140ApprovalDate", label: "I-140 approved" });
  } else {
    const form = firstPetitionForm(type);
    if (form) {
      fields.push({ key: "petitionFiledDate", label: `${form} filed` }, { key: "petitionApprovalDate", label: `${form} approved` });
    }
  }
  // Asylum adjustment has no visa queue, so no priority date.
  if (type !== "humanitarian_asylum") fields.push({ key: "priorityDate", label: "Priority date" });
  return fields;
}

/** Steps for this kind of green card. The current step is kept even if it belongs to another kind. */
export function stagesFor(type: string, current?: string): Array<{ id: string; label: string }> {
  const list = getStagesForPathway(type).map((s) => ({ id: String(s.id), label: s.label }));
  if (current && current !== "withdrawn" && !list.some((s) => s.id === current)) {
    list.push({ id: current, label: current.replace(/_/g, " ") });
  }
  return list;
}

/** What to call the sponsor field for this kind of green card. */
export function sponsorFieldFor(type: string): { label: string; placeholder: string } {
  if (type.startsWith("family_")) return { label: "Petitioner (spouse or family member)", placeholder: "e.g. Jordan Lee (spouse)" };
  if (type.startsWith("self_petition_")) return { label: "Petitioner", placeholder: "Yourself" };
  if (type === "investment_eb5") return { label: "Investment or regional center", placeholder: "e.g. Golden Gate Regional Center" };
  if (type === "humanitarian_asylum") return { label: "Name for this green card", placeholder: "e.g. Asylum adjustment" };
  if (type === "diversity_lottery") return { label: "Name for this green card", placeholder: "e.g. DV-2027 selection" };
  if (type === "humanitarian_other" || type === "other") return { label: "Petitioner or name", placeholder: "e.g. VAWA self-petition" };
  return { label: "Employer or petitioner", placeholder: "e.g. Acme Robotics" };
}

/** Changing the kind: its usual category, and a step that exists for it. Dates that don't apply are cleared. */
export function changesForType(p: ImmigrantPetition, type: string): Partial<ImmigrantPetition> {
  const pathway = PATHWAY_OPTIONS.find((o) => o.id === type);
  const steps = getStagesForPathway(type).map((s) => String(s.id));
  const keep = new Set(dateFieldsFor(type).map((f) => f.key));
  const cleared: Partial<ImmigrantPetition> = {};
  for (const key of ["permFilingDate", "permCertifiedDate", "i140FiledDate", "i140ApprovalDate", "petitionFiledDate", "petitionApprovalDate", "priorityDate"] as const) {
    if (!keep.has(key) && p[key]) cleared[key] = undefined;
  }
  if (!usesI140(type)) {
    cleared.i140ReceiptNumber = undefined;
    cleared.isPriorityDateRecaptured = undefined;
  }
  return {
    petitionType: type,
    preferenceCategory: pathway?.defaultPreferenceCategory ?? p.preferenceCategory,
    stage: steps.includes(p.stage) ? p.stage : steps[0] ?? p.stage,
    ...cleared
  };
}

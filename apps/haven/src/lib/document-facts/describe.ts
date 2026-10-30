import { factSetForKey } from "@/lib/document-facts/catalog";
import { parseFieldKey, type FactState, type FieldSource } from "@/lib/field-sources/plan";

/** One stored detail, as the screens read it. */
export type StoredFact = {
  id: string;
  documentId: string;
  key: string;
  value: string | null;
  rawText: string | null;
  page: number | null;
  confident: boolean;
  state: FactState;
  appliedTo: string | null;
};

export function toStoredFact(row: any): StoredFact {
  return {
    id: row.id,
    documentId: row.document_id,
    key: row.fact_key,
    value: row.value ?? null,
    rawText: row.raw_text ?? null,
    page: row.page ?? null,
    confident: Boolean(row.confident),
    state: row.state,
    appliedTo: row.applied_to ?? null
  };
}

export type FactLine = {
  label: string;
  value: string;
  page: number | null;
  /** Plain words on what happened to it. */
  outcome: string;
  tone: "filled" | "check" | "info";
  /** Where to see or change it, when it went into a field. */
  href: string | null;
};

const PROFILE_FIELD_NAMES: Record<string, string> = {
  visaType: "your visa status",
  countryOfBirth: "your country of birth",
  employerName: "your employer name",
  statusEndDate: "your status end date"
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function show(value: string | null) {
  if (!value) return "";
  if (!ISO_DATE.test(value)) return value;
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function whereName(appliedTo: string | null, sponsors: Map<string, string>) {
  const parsed = appliedTo ? parseFieldKey(appliedTo) : null;
  if (!parsed) return null;
  if (parsed.kind === "profile") return { name: PROFILE_FIELD_NAMES[parsed.field] ?? parsed.field, href: "/profile#case-details" };
  const sponsor = sponsors.get(parsed.petitionId);
  return { name: sponsor ? `${sponsor}'s green card` : "a green card", href: "/profile#green-cards" };
}

/**
 * The "What Haven took" list for one document. `sponsors` maps green card id
 * to sponsor name; `sources` tells whether a green card was created from it.
 */
export function describeFacts(
  facts: StoredFact[],
  sponsors: Map<string, string>,
  sources: Map<string, FieldSource> | Record<string, FieldSource>
): { lines: FactLine[]; createdSponsor: string | null } {
  const sourceMap = sources instanceof Map ? sources : new Map(Object.entries(sources));
  const set = facts[0] ? factSetForKey(facts[0].key) : null;
  const order = set?.facts.map((f) => f.key) ?? [];
  const sorted = [...facts].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  let createdSponsor: string | null = null;

  const lines = sorted.map((fact): FactLine => {
    const spec = set?.facts.find((f) => f.key === fact.key);
    const label = spec?.label ?? fact.key;
    const value = show(fact.value) || fact.rawText || "";
    const where = whereName(fact.appliedTo, sponsors);
    if (fact.appliedTo?.endsWith(".sponsorName")) {
      const src = sourceMap.get(fact.appliedTo);
      if (src?.documentFactId === fact.id && src.origin === "document") createdSponsor = src.value;
    }
    switch (fact.state) {
      case "filled":
        return {
          label,
          value,
          page: fact.page,
          outcome: fact.appliedTo?.endsWith(".sponsorName")
            ? `Used to match ${where?.name ?? "a green card"}`
            : `Filled into ${where?.name ?? "your profile"}`,
          tone: "filled",
          href: where?.href ?? null
        };
      case "not_used_person_value":
        return {
          label,
          value,
          page: fact.page,
          outcome: `Not used: you entered something different for ${where?.name ?? "this"}. Check it in Settings.`,
          tone: "check",
          href: where?.href ?? null
        };
      case "needs_check":
        return {
          label,
          value: fact.rawText ?? value,
          page: fact.page,
          outcome: "Haven wasn't sure — please check",
          tone: "check",
          href: null
        };
      case "not_used_record_removed":
        return { label, value, page: fact.page, outcome: "Not used: green card removed", tone: "info", href: null };
      default:
        return { label, value, page: fact.page, outcome: "Shown here only", tone: "info", href: null };
    }
  });
  return { lines, createdSponsor };
}

const PETITION_FIELD_NAMES: Record<string, string> = {
  i140ReceiptNumber: "I-140 receipt number",
  priorityDate: "Priority date",
  preferenceCategory: "Category",
  i140FiledDate: "I-140 filed",
  i140ApprovalDate: "I-140 approved",
  permFilingDate: "PERM filed",
  permCertifiedDate: "PERM approved",
  sponsorName: "Sponsor"
};

const PROFILE_FIELD_TITLES: Record<string, string> = {
  visaType: "Visa status",
  countryOfBirth: "Country of birth",
  employerName: "Employer",
  statusEndDate: "Status end date"
};

/** A field's name for people, e.g. "Priority date — Acme Insurance's green card". */
export function fieldTitle(fieldKey: string, sponsors: Map<string, string>) {
  const parsed = parseFieldKey(fieldKey);
  if (!parsed) return fieldKey;
  if (parsed.kind === "profile") return PROFILE_FIELD_TITLES[parsed.field] ?? parsed.field;
  const sponsor = sponsors.get(parsed.petitionId);
  return `${PETITION_FIELD_NAMES[parsed.field] ?? parsed.field}${sponsor ? ` — ${sponsor}'s green card` : ""}`;
}

export type Disagreement = {
  fieldKey: string;
  title: string;
  clientValue: string;
  documentValue: string;
  documentLabel: string;
  page: number | null;
  documentId: string | null;
  /** "open": not settled yet; "kept_mine": the client chose their own value. */
  resolution: "open" | "kept_mine";
};

/** Every field where the client's value differs from a document's, for the lawyer. */
export function disagreementsFrom(
  sources: Iterable<FieldSource>,
  factDocument: Map<string, string>,
  sponsors: Map<string, string>
): Disagreement[] {
  const out: Disagreement[] = [];
  for (const s of sources) {
    if (s.origin !== "person" || !s.documentValue || !s.resolution) continue;
    out.push({
      fieldKey: s.fieldKey,
      title: fieldTitle(s.fieldKey, sponsors),
      clientValue: show(s.value) || "(empty)",
      documentValue: show(s.documentValue),
      documentLabel: s.documentLabel ?? "document",
      page: s.documentPage,
      documentId: s.documentFactId ? factDocument.get(s.documentFactId) ?? null : null,
      resolution: s.resolution
    });
  }
  // Open ones first.
  return out.sort((a, b) => (a.resolution === b.resolution ? 0 : a.resolution === "open" ? -1 : 1));
}

/**
 * The fixed list of details Haven reads from each kind of document, and where
 * each one is filled in. One table drives three things so they cannot drift:
 * the "Haven will take…" sentence shown before upload, the extractor's schema,
 * and the step that writes values into the profile and green cards.
 *
 * Anything not listed here is never read as a detail.
 */

/** How a value is checked and normalized before it is used. */
export type FactFormat = "date" | "receipt" | "category" | "visa_class" | "name" | "country";

/**
 * Where a detail goes. Profile fields are named as in Settings; green card
 * fields are "petition.<field>" and resolve to "petition:<id>.<field>".
 */
export type FactTarget =
  | "visaType"
  | "countryOfBirth"
  | "employerName"
  | "statusEndDate"
  | "petition.sponsorName"
  | "petition.i140ReceiptNumber"
  | "petition.priorityDate"
  | "petition.preferenceCategory"
  | "petition.i140FiledDate"
  | "petition.i140ApprovalDate"
  | "petition.permFilingDate"
  | "petition.permCertifiedDate";

export type FactSpec = {
  /** Stored key, e.g. "i140.priority_date". */
  key: string;
  /** Plain name shown to people. */
  label: string;
  format: FactFormat;
  /** Where it is filled. Null: shown on the document only. */
  target: FactTarget | null;
  /** What to tell the model to look for. */
  hint: string;
};

/** Which details set the extractor reads; several document kinds can share one. */
export type FactSetId = "i140" | "perm" | "h1b_approval" | "i94" | "passport";

export type FactSet = {
  id: FactSetId;
  /** Plain name of the document, used in labels: "From your I-140 notice". */
  documentName: string;
  /** Green card details go to one sponsor's green card. */
  sponsorScoped: boolean;
  /** Where the details end up, for the "Haven will take…" sentence. */
  destination: string;
  facts: FactSpec[];
};

export const FACT_SETS: Record<FactSetId, FactSet> = {
  i140: {
    id: "i140",
    documentName: "I-140 notice",
    sponsorScoped: true,
    destination: "that sponsor's green card",
    facts: [
      { key: "i140.sponsor", label: "Sponsor", format: "name", target: "petition.sponsorName", hint: "The petitioner (employer) name." },
      { key: "i140.receipt_number", label: "Receipt number", format: "receipt", target: "petition.i140ReceiptNumber", hint: "The receipt number, three letters then ten digits." },
      { key: "i140.priority_date", label: "Priority date", format: "date", target: "petition.priorityDate", hint: "The Priority Date." },
      { key: "i140.category", label: "Category", format: "category", target: "petition.preferenceCategory", hint: "The classification or Class code (for example E21 or Sec.203(b)(2))." },
      { key: "i140.filed_date", label: "Filing date", format: "date", target: "petition.i140FiledDate", hint: "The Received Date." },
      {
        key: "i140.approval_date",
        label: "Approval date",
        format: "date",
        target: "petition.i140ApprovalDate",
        hint: "The Notice Date, only if this is an Approval Notice. Leave empty for a receipt notice."
      }
    ]
  },
  perm: {
    id: "perm",
    documentName: "PERM certification",
    sponsorScoped: true,
    destination: "that sponsor's green card",
    facts: [
      { key: "perm.employer", label: "Employer", format: "name", target: "petition.sponsorName", hint: "The employer's legal business name." },
      { key: "perm.filing_date", label: "Filing date", format: "date", target: "petition.permFilingDate", hint: "The date the labor certification was filed (received by DOL)." },
      { key: "perm.certification_date", label: "Certification date", format: "date", target: "petition.permCertifiedDate", hint: "The date it was certified." }
    ]
  },
  h1b_approval: {
    id: "h1b_approval",
    documentName: "H-1B approval notice",
    sponsorScoped: false,
    destination: "your profile",
    facts: [
      { key: "h1b.employer", label: "Employer", format: "name", target: "employerName", hint: "The petitioner (employer) name." },
      { key: "h1b.receipt_number", label: "Receipt number", format: "receipt", target: null, hint: "The receipt number, three letters then ten digits." },
      { key: "h1b.valid_from", label: "Valid from", format: "date", target: null, hint: "The first date of the approved validity period." },
      { key: "h1b.valid_to", label: "Valid to", format: "date", target: "statusEndDate", hint: "The last date of the approved validity period." }
    ]
  },
  i94: {
    id: "i94",
    documentName: "I-94",
    sponsorScoped: false,
    destination: "your profile",
    facts: [
      { key: "i94.class_of_admission", label: "Visa type", format: "visa_class", target: "visaType", hint: "The Class of Admission." },
      { key: "i94.admit_until", label: "Status end date", format: "date", target: "statusEndDate", hint: "The Admit Until Date. Leave empty if it says D/S." }
    ]
  },
  passport: {
    id: "passport",
    documentName: "passport",
    sponsorScoped: false,
    destination: "your profile",
    facts: [
      { key: "passport.country_of_birth", label: "Country of birth", format: "country", target: "countryOfBirth", hint: "The country of birth (place of birth). Give the country only, not a city." }
    ]
  }
};

/** Document kinds whose details are always read with one set. */
const KIND_TO_SET: Record<string, FactSetId> = {
  i140_notice: "i140",
  perm_certification: "perm",
  h1b_petition: "h1b_approval",
  i94_record: "i94",
  passport_biographic_page: "passport"
};

/**
 * The set for a document. A general USCIS notice is an I-140 or H-1B approval
 * depending on the form it names; anything else has no details read.
 */
export function factSetFor(documentKind: string, text?: string): FactSet | null {
  const direct = KIND_TO_SET[documentKind];
  if (direct) return FACT_SETS[direct];
  if (documentKind === "uscis_notice" && text) {
    if (/\bI-?140\b/i.test(text)) return FACT_SETS.i140;
    if (/\bI-?129\b/i.test(text)) return FACT_SETS.h1b_approval;
  }
  return null;
}

/** The set shown before upload, when only the kind is known. */
export function factSetForKind(documentKind: string): FactSet | null {
  return KIND_TO_SET[documentKind] ? FACT_SETS[KIND_TO_SET[documentKind]] : null;
}

function joinLabels(labels: string[]): string {
  const lower = labels.map((l, i) => (i === 0 ? l : l.charAt(0).toLowerCase() + l.slice(1)));
  if (lower.length <= 1) return lower.join("");
  return `${lower.slice(0, -1).join(", ")} and ${lower[lower.length - 1]}`;
}

/**
 * Plain sentence for a checklist item or the upload screen, e.g. "Haven will
 * take the sponsor, receipt number, priority date, category, filing date and
 * approval date, and fill them into Acme Insurance's green card."
 */
export function willTakeSentence(documentKind: string, sponsorName?: string): string {
  const set = factSetForKind(documentKind);
  if (!set && documentKind === "uscis_notice") {
    return "If this is an I-140 or H-1B approval notice, Haven takes its dates and receipt number and fills them in. Other notices are kept as they are.";
  }
  if (!set) return "Haven keeps this document but doesn't take any details from it.";
  const labels = joinLabels(set.facts.map((f) => f.label.toLowerCase()));
  const filled = set.facts.filter((f) => f.target);
  const shownOnly = set.facts.filter((f) => !f.target);
  const where = set.sponsorScoped
    ? sponsorName?.trim()
      ? `${sponsorName.trim()}'s green card`
      : set.destination
    : set.destination;
  const tail = shownOnly.length
    ? ` The ${joinLabels(shownOnly.map((f) => f.label.toLowerCase()))} ${shownOnly.length === 1 ? "is" : "are"} shown on the document only.`
    : "";
  return filled.length === set.facts.length
    ? `Haven will take the ${labels} and fill ${set.facts.length === 1 ? "it" : "them"} into ${where}.`
    : `Haven will take the ${labels}, and fill what fits into ${where}.${tail}`;
}

/** The set a stored detail belongs to, from its key ("i140.priority_date" → I-140). */
export function factSetForKey(factKey: string): FactSet | null {
  const prefix = factKey.split(".")[0];
  const id: FactSetId | undefined =
    prefix === "h1b" ? "h1b_approval" : (["i140", "perm", "i94", "passport"] as const).find((p) => p === prefix);
  return id ? FACT_SETS[id] : null;
}

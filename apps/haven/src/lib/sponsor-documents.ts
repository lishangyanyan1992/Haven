import { findPresetDocument, isPerSponsor } from "@/lib/document-vault";
import { STAGE_ORDER, usesI140, usesPerm } from "@/lib/petitions";
import type { RequiredDocumentItem } from "@/lib/firms/types";
import type { ImmigrantPetition, ImmigrantPetitionStage } from "@/types/domain";

/**
 * The document checklist, with sponsor-tied documents asked once per sponsor.
 *
 * Pure, so the client's Documents page, the lawyer's client page and the
 * lawyer's client-list count all build the same list from the same inputs.
 */

/** What the checklist needs to know about one green card. The firm side gets this from its shared copy. */
export type SponsorRef = Pick<
  ImmigrantPetition,
  "id" | "sponsorName" | "stage" | "endedReason" | "permCertifiedDate" | "i140FiledDate" | "i140ApprovalDate"
> & { petitionType?: ImmigrantPetition["petitionType"] };

/** The minimum of an uploaded document the checklist reads. */
export type ChecklistDocument = { id: string; documentKind: string; petitionId?: string | null };

export type ChecklistStatus = "uploaded" | "needed" | "not_needed_yet";

export type ChecklistEntry<D extends ChecklistDocument = ChecklistDocument> = {
  /** Unique per entry: the requirement key, plus ":<petitionId>" for sponsor entries. */
  id: string;
  key: string;
  /** The requirement's own label, without the sponsor. */
  baseLabel: string;
  /** What to show, e.g. "I-140 approval notice — Acme Insurance". */
  label: string;
  detail?: string;
  isCustom?: boolean;
  sponsorName?: string;
  /** Set for green card sponsor entries; uploads from this entry are linked to it. */
  petitionId?: string;
  status: ChecklistStatus;
  /** Plain reason, set when status is "not_needed_yet". */
  reason?: string;
  documents: D[];
};

export type ChecklistResult<D extends ChecklistDocument = ChecklistDocument> = {
  entries: ChecklistEntry<D>[];
  /** Documents of a sponsor-tied kind that are not linked to any of the client's sponsors yet. */
  unlinked: D[];
  /** Entries actually requested (leaves out "not needed yet"). */
  requestedCount: number;
  uploadedCount: number;
};

/** Which step a sponsor's case must reach before a preset document exists. */
const STAGE_GATES: Record<string, { stage: ImmigrantPetitionStage; dateField: keyof SponsorRef; produced: string }> = {
  perm_certification: { stage: "perm_certified", dateField: "permCertifiedDate", produced: "PERM approval" },
  i140_notice: { stage: "i140_filed", dateField: "i140FiledDate", produced: "the I-140 filing" }
};

/** Whether this sponsor's case has reached the step that produces the document. Unknown counts as reached. */
function gateFor(key: string, petition: SponsorRef): { reached: boolean; reason?: string } {
  const gate = STAGE_GATES[key];
  if (!gate) return { reached: true };
  // Family, investor, humanitarian and lottery green cards never produce these.
  if (key === "perm_certification" && !usesPerm(petition.petitionType)) {
    return { reached: false, reason: "this green card doesn't go through PERM" };
  }
  if (key === "i140_notice" && !usesI140(petition.petitionType)) {
    return { reached: false, reason: "this green card doesn't use an I-140" };
  }
  if (petition[gate.dateField] || (key === "i140_notice" && petition.i140ApprovalDate)) return { reached: true };
  const order = STAGE_ORDER[petition.stage];
  // Withdrawn says nothing about how far it got, so ask.
  if (order === undefined || petition.stage === "withdrawn") return { reached: true };
  if (order >= STAGE_ORDER[gate.stage]) return { reached: true };
  // Name the earliest step the case never reached, e.g. "ended before PERM".
  const missed = order < STAGE_ORDER.perm_in_progress ? "PERM" : gate.produced;
  if (petition.endedReason) {
    return { reached: false, reason: `this case ended before ${missed}` };
  }
  return { reached: false, reason: `this case hasn't reached ${missed} yet` };
}

function sponsorLabel(base: string, sponsor: string | undefined) {
  return sponsor?.trim() ? `${base} — ${sponsor.trim()}` : base;
}

export function expandRequiredDocuments<D extends ChecklistDocument>(input: {
  items: RequiredDocumentItem[];
  petitions: SponsorRef[];
  employerName?: string | null;
  documents: D[];
  /** Also accept "<key>_<suffix>" kinds (multi-firm collision keys). */
  kindMatches?: (documentKind: string, key: string) => boolean;
}): ChecklistResult<D> {
  const matchesKind = input.kindMatches ?? ((kind: string, key: string) => kind === key);
  const petitions = input.petitions.filter((p) => p.sponsorName?.trim());
  const petitionIds = new Set(petitions.map((p) => p.id));
  const entries: ChecklistEntry<D>[] = [];
  const unlinked: D[] = [];

  for (const item of input.items) {
    const preset = findPresetDocument(item.key);
    const base = {
      key: item.key,
      baseLabel: item.label,
      detail: preset?.detail,
      isCustom: item.isCustom
    };
    const ofKind = input.documents.filter((d) => matchesKind(d.documentKind, item.key));

    // Asked once: not sponsor-tied, or sponsor-tied with no green card to split by.
    const greenCardTied = isPerSponsor(item) && item.key !== "h1b_petition";
    if (!isPerSponsor(item) || (greenCardTied && petitions.length === 0)) {
      entries.push({
        ...base,
        id: item.key,
        label: item.label,
        status: ofKind.length > 0 ? "uploaded" : "needed",
        documents: ofKind
      });
      continue;
    }

    // H-1B packet: Haven only knows the current H-1B employer.
    if (!greenCardTied) {
      const employer = input.employerName?.trim() || undefined;
      entries.push({
        ...base,
        id: item.key,
        label: sponsorLabel(item.label, employer),
        sponsorName: employer,
        status: ofKind.length > 0 ? "uploaded" : "needed",
        documents: ofKind
      });
      continue;
    }

    // One entry per green card. With a single sponsor, an unlinked upload counts for it.
    const single = petitions.length === 1;
    for (const petition of petitions) {
      const docs = ofKind.filter((d) => d.petitionId === petition.id || (single && !d.petitionId));
      const gate = gateFor(item.key, petition);
      entries.push({
        ...base,
        id: `${item.key}:${petition.id}`,
        label: sponsorLabel(item.label, petition.sponsorName),
        sponsorName: petition.sponsorName.trim(),
        petitionId: petition.id,
        // An upload always counts, even if the case looks too early for it.
        status: docs.length > 0 ? "uploaded" : gate.reached ? "needed" : "not_needed_yet",
        reason: docs.length > 0 || gate.reached ? undefined : `Not needed yet: ${gate.reason}`,
        documents: docs
      });
    }
    if (!single) {
      for (const d of ofKind) {
        if (!d.petitionId || !petitionIds.has(d.petitionId)) unlinked.push(d);
      }
    }
  }

  const requested = entries.filter((e) => e.status !== "not_needed_yet");
  return {
    entries,
    unlinked,
    requestedCount: requested.length,
    uploadedCount: requested.filter((e) => e.status === "uploaded").length
  };
}

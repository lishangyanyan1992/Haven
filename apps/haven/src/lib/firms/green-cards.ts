import { ENDED_REASON_LABELS, normalizePetitions, usesI140 } from "@/lib/petitions";
import { firstPetitionForm } from "@/lib/green-card-forms";
import type { SponsorRef } from "@/lib/sponsor-documents";
import type { ImmigrantPetition, ImmigrantPetitionStage, ImmigrantPetitionType } from "@/types/domain";

/**
 * The client's green card list, written as one plain line per green card for
 * their law firm. Stored in the firm's copy of shared answers under
 * "greenCards", so the firm still never reads user_profiles.
 */

const STAGE_LABELS: Record<string, string> = {
  pwd_recruitment: "Prevailing wage / recruitment",
  perm_in_progress: "PERM filed",
  perm_certified: "PERM approved",
  i140_filed: "I-140 filed",
  i140_approved: "I-140 approved",
  i130_filed: "I-130 filed",
  i130_approved: "I-130 approved",
  consular_processing: "Consular / NVC processing",
  conditional_resident: "2-year conditional resident",
  i485_filed: "I-485 filed",
  i485_approved: "Green card approved",
  withdrawn: "Withdrawn"
};

const TYPE_LABELS: Partial<Record<string, string>> = {
  self_petition_niw: "NIW self-petition",
  self_petition_eb1a: "EB-1A self-petition",
  concurrent_employer: "second employer",
  family_marriage_usc: "Marriage to US citizen",
  family_marriage_lpr: "Marriage to permanent resident",
  family_preference: "Family preference",
  investment_eb5: "EB-5 investment",
  humanitarian_asylum: "Asylum adjustment",
  humanitarian_other: "Humanitarian",
  diversity_lottery: "Diversity Visa"
};

function formatDate(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** One line, e.g. "Acme · EB-2 · I-140 approved Jan 20, 2026 · Priority date Jun 14, 2021 · Ended at layoff Oct 8, 2026". */
export function greenCardLine(p: ImmigrantPetition): string {
  const parts: string[] = [p.sponsorName.trim()];
  const category = p.preferenceCategory && p.preferenceCategory !== "Not sure" ? p.preferenceCategory : null;
  const type = TYPE_LABELS[p.petitionType];
  if (category || type) parts.push([category, type].filter(Boolean).join(", "));

  // "I-130 filed" belongs to family green cards; EB-5 and others name their own form.
  const firstForm = p.stage === "i130_filed" || p.stage === "i130_approved" ? firstPetitionForm(p.petitionType) : null;
  const stage = firstForm && firstForm !== "I-130"
    ? `${firstForm} ${p.stage === "i130_filed" ? "filed" : "approved"}`
    : STAGE_LABELS[p.stage] ?? p.stage;
  const stageDate =
    p.stage === "i140_approved"
      ? formatDate(p.i140ApprovalDate)
      : p.stage === "i140_filed"
        ? formatDate(p.i140FiledDate)
        : p.stage === "i130_filed"
          ? formatDate(p.petitionFiledDate)
          : p.stage === "i130_approved"
            ? formatDate(p.petitionApprovalDate)
            : p.stage === "perm_certified"
          ? formatDate(p.permCertifiedDate)
          : p.stage === "perm_in_progress"
            ? formatDate(p.permFilingDate)
            : null;
  parts.push(stageDate ? `${stage} ${stageDate}` : stage);
  // No I-485 dates are collected, so name the I-140 approval date separately.
  if ((p.stage === "i485_filed" || p.stage === "i485_approved") && usesI140(p.petitionType)) {
    const approved = formatDate(p.i140ApprovalDate);
    if (approved) parts.push(`I-140 approved ${approved}`);
  }

  const pd = formatDate(p.priorityDate);
  if (pd) parts.push(`Priority date ${pd}${p.isPriorityDateRecaptured ? " (carried over)" : ""}`);

  if (p.endedReason) {
    const ended = formatDate(p.endedDate);
    parts.push(ended ? `${ENDED_REASON_LABELS[p.endedReason]} ${ended}` : ENDED_REASON_LABELS[p.endedReason]);
  }
  return parts.join(" · ");
}

/**
 * The few fields the document checklist needs per green card, one JSON string
 * each so they fit the shared answers' string-list shape. Lets the firm's
 * checklist ask for sponsor documents per sponsor without reading the profile.
 */
export function greenCardSponsorsForFirm(raw: unknown): string[] {
  return normalizePetitions(raw)
    .filter((p) => p.sponsorName.trim())
    .map((p) =>
      JSON.stringify({
        id: p.id,
        sponsorName: p.sponsorName.trim(),
        stage: p.stage,
        petitionType: p.petitionType,
        ...(p.endedReason ? { endedReason: p.endedReason } : {}),
        ...(p.permCertifiedDate ? { permCertifiedDate: p.permCertifiedDate } : {}),
        ...(p.i140FiledDate ? { i140FiledDate: p.i140FiledDate } : {}),
        ...(p.i140ApprovalDate ? { i140ApprovalDate: p.i140ApprovalDate } : {})
      })
    );
}

/** Reads greenCardSponsorsForFirm output back. Bad entries are skipped. */
export function parseFirmGreenCardSponsors(value: unknown): SponsorRef[] {
  if (!Array.isArray(value)) return [];
  const out: SponsorRef[] = [];
  for (const entry of value) {
    try {
      const parsed = JSON.parse(String(entry));
      if (parsed && typeof parsed.id === "string" && typeof parsed.sponsorName === "string" && typeof parsed.stage === "string") {
        out.push(parsed as SponsorRef);
      }
    } catch {
      // Skip anything that isn't ours.
    }
  }
  return out;
}

/** The firm's lines for a saved (possibly older-format) petition list. Empty list when there are none. */
export function greenCardLinesForFirm(raw: unknown): string[] {
  return normalizePetitions(raw)
    .filter((p) => p.sponsorName.trim())
    .map(greenCardLine);
}

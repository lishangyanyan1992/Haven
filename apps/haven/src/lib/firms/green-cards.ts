import { ENDED_REASON_LABELS, normalizePetitions } from "@/lib/petitions";
import type { ImmigrantPetition, ImmigrantPetitionStage, ImmigrantPetitionType } from "@/types/domain";

/**
 * The client's green card list, written as one plain line per green card for
 * their law firm. Stored in the firm's copy of shared answers under
 * "greenCards", so the firm still never reads user_profiles.
 */

const STAGE_LABELS: Record<ImmigrantPetitionStage, string> = {
  pwd_recruitment: "Prevailing wage / recruitment",
  perm_in_progress: "PERM filed",
  perm_certified: "PERM approved",
  i140_filed: "I-140 filed",
  i140_approved: "I-140 approved",
  i485_filed: "I-485 filed",
  i485_approved: "Green card approved",
  withdrawn: "Withdrawn"
};

const TYPE_LABELS: Partial<Record<ImmigrantPetitionType, string>> = {
  self_petition_niw: "NIW self-petition",
  self_petition_eb1a: "EB-1A self-petition",
  concurrent_employer: "second employer"
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

  const stage = STAGE_LABELS[p.stage] ?? p.stage;
  const stageDate =
    p.stage === "i140_approved"
      ? formatDate(p.i140ApprovalDate)
      : p.stage === "i140_filed"
        ? formatDate(p.i140FiledDate)
        : p.stage === "perm_certified"
          ? formatDate(p.permCertifiedDate)
          : p.stage === "perm_in_progress"
            ? formatDate(p.permFilingDate)
            : null;
  parts.push(stageDate ? `${stage} ${stageDate}` : stage);
  // No I-485 dates are collected, so name the I-140 approval date separately.
  if (p.stage === "i485_filed" || p.stage === "i485_approved") {
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

/** The firm's lines for a saved (possibly older-format) petition list. Empty list when there are none. */
export function greenCardLinesForFirm(raw: unknown): string[] {
  return normalizePetitions(raw)
    .filter((p) => p.sponsorName.trim())
    .map(greenCardLine);
}

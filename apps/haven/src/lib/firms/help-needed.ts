import type { Concern } from "@/types/domain";

/**
 * "What help do you need from your lawyer?" (specs/client-help-request).
 *
 * Replaced "Main concerns" in setup. Haven's own features (community
 * matching, personalization) still read the old concern areas, so each choice
 * maps to the concern areas it implies and those are saved alongside.
 */

export type HelpNeeded =
  | "first_consultation"
  | "case_review"
  | "job_loss_plan"
  | "changing_employers"
  | "other_paths"
  | "green_card_next_step"
  | "extend_status"
  | "family"
  | "something_else";

export type HelpNeededOption = {
  value: HelpNeeded;
  label: string;
  description: string;
  concerns: Concern[];
};

/** In the order the client sees them. Must match the database check in migration 0050. */
export const HELP_NEEDED_OPTIONS: readonly HelpNeededOption[] = [
  {
    value: "first_consultation",
    label: "First consultation",
    description: "A first meeting to talk through my situation and options.",
    concerns: []
  },
  {
    value: "case_review",
    label: "Review my current case",
    description: "Check that my status, dates, and documents are in order.",
    concerns: ["gc_timeline"]
  },
  {
    value: "job_loss_plan",
    label: "Plan if I lose my job",
    description: "What to do, and by when, if my job ends or is at risk.",
    concerns: ["layoffs"]
  },
  {
    value: "changing_employers",
    label: "Changing employers",
    description: "Moving my visa or green card process to a new job.",
    concerns: ["job_change"]
  },
  {
    value: "other_paths",
    label: "Other ways to stay in the US",
    description: "Explore other visa or green card paths, like O-1, EB-1A, NIW, or through a spouse.",
    concerns: ["job_change"]
  },
  {
    value: "green_card_next_step",
    label: "Next green card step",
    description: "Help with PERM, I-140, I-485, or whatever comes next for me.",
    concerns: ["gc_timeline"]
  },
  {
    value: "extend_status",
    label: "Extend or renew my status",
    description: "Keep my visa or work permit valid before it runs out.",
    concerns: ["visa_expiry"]
  },
  {
    value: "family",
    label: "Help for my spouse or children",
    description: "Visas or status for my family members.",
    concerns: []
  },
  {
    value: "something_else",
    label: "Something else",
    description: "Tell your lawyer more in the box below.",
    concerns: []
  }
];

const BY_VALUE = new Map(HELP_NEEDED_OPTIONS.map((option) => [option.value, option]));

export const HELP_NEEDED_VALUES = HELP_NEEDED_OPTIONS.map((option) => option.value);

/** Known choices only, de-duplicated, in display order. */
export function normalizeHelpNeeded(raw: unknown): HelpNeeded[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.map(String));
  return HELP_NEEDED_VALUES.filter((value) => picked.has(value));
}

/** The old concern areas these choices imply, de-duplicated. */
export function concernsForHelpNeeded(choices: readonly string[]): Concern[] {
  const out: Concern[] = [];
  for (const choice of choices) {
    for (const concern of BY_VALUE.get(choice as HelpNeeded)?.concerns ?? []) {
      if (!out.includes(concern)) out.push(concern);
    }
  }
  return out;
}

/** Plain labels for showing choices to a lawyer. Unknown values are dropped. */
export function helpNeededLabels(choices: unknown): string[] {
  return normalizeHelpNeeded(choices).map((value) => BY_VALUE.get(value)!.label);
}

/**
 * Setup sends every answer on every save, and an empty selection sends no
 * field at all. Forms that show the help question add this marker so an empty
 * selection still counts as "sent" and clears the saved choices.
 */
export const HELP_NEEDED_SENT_MARKER = "helpNeededSent";

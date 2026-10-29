import type { IntakeQuestionItem } from "@/lib/firms/types";

export type IntakeQuestionGroup = "Profile" | "Employment" | "Green card" | "Situation" | "Deadlines";

export type PresetIntakeQuestion = {
  key: string;
  label: string;
  detail: string;
  group: IntakeQuestionGroup;
};

export const PRESET_INTAKE_QUESTIONS: PresetIntakeQuestion[] = [
  {
    key: "visaType",
    label: "Current visa status",
    detail: "Visitor (B-1/B-2), Student (F-1/J-1/OPT), Work (H-1B, L-1, O-1, TN, E-2), Family, Humanitarian, or custom status.",
    group: "Profile"
  },
  {
    key: "countryOfBirth",
    label: "Country of birth",
    detail: "Determines per-country green card backlog queue.",
    group: "Profile"
  },
  {
    key: "primaryGoal",
    label: "Primary goal",
    detail: "Main immigration objective (green card, stability, flexibility).",
    group: "Profile"
  },
  {
    key: "employerName",
    label: "Employer name",
    detail: "Current sponsoring or employing company.",
    group: "Employment"
  },
  {
    key: "jobTitle",
    label: "Job title",
    detail: "Client's current role title.",
    group: "Employment"
  },
  {
    key: "h1bStartDate",
    label: "H-1B start date",
    detail: "Used to compute six-year cap date and renewal window.",
    group: "Employment"
  },
  {
    key: "employerSize",
    label: "Employer size",
    detail: "Startup, mid-size, or enterprise.",
    group: "Employment"
  },
  {
    key: "greenCardStage",
    label: "Green card stage",
    detail: "Not started, family/marriage (I-130), PERM, I-140, or I-485 filed.",
    group: "Green card"
  },
  {
    key: "preferenceCategory",
    label: "Preference category",
    detail: "Family (Spouse/F-2A/F1-F4), Employment (EB-1, EB-2, EB-3, NIW), EB-5, or Lottery.",
    group: "Green card"
  },
  {
    key: "priorityDate",
    label: "Priority date",
    detail: "Date the client's initial petition (PERM, Form I-130, or Form I-140) was filed.",
    group: "Green card"
  },
  {
    key: "spouseVisaStatus",
    label: "Spouse or partner visa status",
    detail: "Dependent or independent status of spouse or partner.",
    group: "Situation"
  },
  {
    key: "helpNeeded",
    label: "Help needed from your lawyer",
    detail: "First consultation, case review, job-loss plan, other paths to stay, and more. Plus a message to you.",
    group: "Situation"
  },
  {
    key: "statusEndDate",
    label: "When current status ends",
    detail: "Date on I-94, visa, or EAD (with 'Not sure' option).",
    group: "Deadlines"
  },
  {
    key: "jobEnded",
    label: "Whether job has ended or is ending",
    detail: "Asks if employment ended and the last day of work for grace period calculation.",
    group: "Deadlines"
  },
  {
    key: "agencyDeadlineType",
    label: "USCIS or consulate deadline",
    detail: "RFE response, interview, biometrics, or other agency deadline and date.",
    group: "Deadlines"
  },
  {
    key: "travelPlanned",
    label: "Upcoming travel outside the US",
    detail: "Whether international travel is planned and the departure date.",
    group: "Deadlines"
  }
];

export const DEFAULT_INTAKE_QUESTION_KEYS = PRESET_INTAKE_QUESTIONS.map((q) => q.key);

/**
 * Preset keys that were renamed. "Main concerns" (topConcerns) became "Help
 * needed from your lawyer" (helpNeeded); migration 0050 rewrote stored lists,
 * and this keeps any list saved under the old key working.
 */
const RENAMED_PRESET_KEYS: Record<string, string> = { topConcerns: "helpNeeded" };

/** A firm's stored list with renamed preset keys (and their labels) brought up to date. */
export function normalizeIntakeQuestionKeys(items: IntakeQuestionItem[]): IntakeQuestionItem[] {
  return items.map((item) => {
    const renamed = item && typeof item.key === "string" ? RENAMED_PRESET_KEYS[item.key] : undefined;
    if (!renamed) return item;
    const preset = PRESET_INTAKE_QUESTIONS.find((q) => q.key === renamed);
    return { key: renamed, label: preset?.label ?? item.label, isCustom: false };
  });
}

export function getDefaultIntakeQuestions(): IntakeQuestionItem[] {
  return PRESET_INTAKE_QUESTIONS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    isCustom: false
  }));
}

export function findPresetIntakeQuestion(key: string): PresetIntakeQuestion | undefined {
  return PRESET_INTAKE_QUESTIONS.find((q) => q.key === key);
}

export function slugifyCustomQuestionKey(label: string): string {
  const sanitized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `custom_q_${sanitized || "question"}`;
}

export function isCustomQuestionKey(key: string): boolean {
  return /^custom_q_[a-z0-9_]+$/.test(key);
}

export function validateIntakeQuestionList(
  items: unknown
): { ok: true; items: IntakeQuestionItem[] } | { ok: false; error: string } {
  if (!Array.isArray(items)) {
    return { ok: false, error: "Intake questions must be a list." };
  }
  if (items.length === 0) {
    return { ok: false, error: "Please select at least one intake question." };
  }
  if (items.length > 40) {
    return { ok: false, error: "You can specify at most 40 intake questions." };
  }

  const presetKeySet = new Set(DEFAULT_INTAKE_QUESTION_KEYS);
  const seenKeys = new Set<string>();
  const validated: IntakeQuestionItem[] = [];

  for (const original of items) {
    const raw =
      typeof original === "object" && original && typeof (original as any).key === "string"
        ? normalizeIntakeQuestionKeys([original as IntakeQuestionItem])[0]
        : original;
    if (typeof raw !== "object" || !raw) continue;
    const label = typeof (raw as any).label === "string" ? (raw as any).label.trim() : "";
    if (!label || label.length > 120) {
      return { ok: false, error: "Question labels must be between 1 and 120 characters." };
    }

    const rawKey = typeof (raw as any).key === "string" ? (raw as any).key.trim() : "";
    const isCustom = Boolean((raw as any).isCustom) || !presetKeySet.has(rawKey);

    let key = rawKey;
    if (isCustom) {
      if (!isCustomQuestionKey(key)) {
        key = slugifyCustomQuestionKey(label);
      }
    } else if (seenKeys.has(key)) {
      return { ok: false, error: `Duplicate preset question: ${key}` };
    }

    let finalKey = key;
    if (isCustom) {
      let counter = 2;
      while (seenKeys.has(finalKey)) {
        finalKey = `${key}_${counter}`;
        counter += 1;
      }
    }
    seenKeys.add(finalKey);

    validated.push({
      key: finalKey,
      label,
      isCustom
    });
  }

  if (validated.length === 0) {
    return { ok: false, error: "Please select at least one valid intake question." };
  }

  return { ok: true, items: validated };
}

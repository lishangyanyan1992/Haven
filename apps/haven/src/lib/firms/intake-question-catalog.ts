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
    detail: "OPT, STEM OPT, H-1B, H-4, O-1, Green card, or Citizen.",
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
    detail: "Not started, PERM in progress/certified, I-140, or I-485 filed.",
    group: "Green card"
  },
  {
    key: "preferenceCategory",
    label: "Preference category",
    detail: "EB-1, EB-2, EB-3, EB-2 NIW, or Not sure.",
    group: "Green card"
  },
  {
    key: "priorityDate",
    label: "Priority date",
    detail: "Date the client's PERM or I-140 was filed.",
    group: "Green card"
  },
  {
    key: "spouseVisaStatus",
    label: "Spouse or partner visa status",
    detail: "Dependent or independent status of spouse or partner.",
    group: "Situation"
  },
  {
    key: "topConcerns",
    label: "Main concerns",
    detail: "Layoff risk, visa expiry, green card timeline, or job change.",
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

  for (const raw of items) {
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
    }

    let finalKey = key;
    let counter = 2;
    while (seenKeys.has(finalKey)) {
      finalKey = `${key}_${counter}`;
      counter += 1;
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

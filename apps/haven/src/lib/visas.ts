import type { GreenCardStage, ImmigrantPetitionType, StandardPreferenceCategory, StandardVisaType } from "@/types/domain";

export type VisaCategoryGroup =
  | "Visitor & Tourism"
  | "Student & Exchange"
  | "Work & Specialty"
  | "Family & Fiance(e)"
  | "Humanitarian & Protected"
  | "Permanent Resident & Citizen"
  | "Other";

export interface VisaOptionItem {
  value: string;
  label: string;
  detail?: string;
  group: VisaCategoryGroup;
  workAuthorized: boolean;
}

export const VISA_CATEGORY_GROUPS: Record<VisaCategoryGroup, VisaOptionItem[]> = {
  "Visitor & Tourism": [
    { value: "B-1", label: "B-1 (Business Visitor)", detail: "Short-term business meetings, conferences", group: "Visitor & Tourism", workAuthorized: false },
    { value: "B-2", label: "B-2 (Tourism / Visitor)", detail: "Vacation, visiting family, medical treatment", group: "Visitor & Tourism", workAuthorized: false },
    { value: "B-1/B-2", label: "B-1/B-2 (Business & Tourism)", detail: "Combined visitor visa", group: "Visitor & Tourism", workAuthorized: false },
    { value: "ESTA", label: "ESTA / Visa Waiver (VWP)", detail: "90-day visa-free entry for participating countries", group: "Visitor & Tourism", workAuthorized: false }
  ],
  "Student & Exchange": [
    { value: "F-1", label: "F-1 (Academic Student)", detail: "Enrolled in degree program (pre-OPT)", group: "Student & Exchange", workAuthorized: false },
    { value: "OPT", label: "F-1 OPT (Post-Completion)", detail: "12-month post-degree work authorization", group: "Student & Exchange", workAuthorized: true },
    { value: "STEM OPT", label: "F-1 STEM OPT Extension", detail: "24-month STEM extension", group: "Student & Exchange", workAuthorized: true },
    { value: "J-1", label: "J-1 (Exchange Visitor)", detail: "Scholar, researcher, intern, trainee", group: "Student & Exchange", workAuthorized: false },
    { value: "M-1", label: "M-1 (Vocational Student)", detail: "Non-academic vocational studies", group: "Student & Exchange", workAuthorized: false }
  ],
  "Work & Specialty": [
    { value: "H1B", label: "H-1B (Specialty Occupation)", detail: "Employer-sponsored professional role", group: "Work & Specialty", workAuthorized: true },
    { value: "H-1B1", label: "H-1B1 (Chile / Singapore)", detail: "Free trade agreement specialty visa", group: "Work & Specialty", workAuthorized: true },
    { value: "H4", label: "H-4 (H-1B Dependent)", detail: "Spouse or child of H-1B holder", group: "Work & Specialty", workAuthorized: false },
    { value: "H4 EAD", label: "H-4 with EAD", detail: "Work-authorized H-4 dependent", group: "Work & Specialty", workAuthorized: true },
    { value: "L-1A", label: "L-1A (Intracompany Executive)", detail: "Executive or managerial transferee", group: "Work & Specialty", workAuthorized: true },
    { value: "L-1B", label: "L-1B (Intracompany Specialized)", detail: "Specialized knowledge transferee", group: "Work & Specialty", workAuthorized: true },
    { value: "L-2", label: "L-2 / L-2 EAD (Dependent)", detail: "Spouse of L-1 holder", group: "Work & Specialty", workAuthorized: true },
    { value: "O-1", label: "O-1 (Extraordinary Ability)", detail: "Nationally/internationally recognized acclaim", group: "Work & Specialty", workAuthorized: true },
    { value: "O-1A", label: "O-1A (Sciences / Business / Tech)", detail: "Extraordinary ability in sciences or business", group: "Work & Specialty", workAuthorized: true },
    { value: "O-1B", label: "O-1B (Arts / Film / TV)", detail: "Extraordinary ability in arts or media", group: "Work & Specialty", workAuthorized: true },
    { value: "O-2", label: "O-2 (Essential Support)", detail: "Accompanying support personnel to O-1", group: "Work & Specialty", workAuthorized: true },
    { value: "TN", label: "TN (USMCA / NAFTA)", detail: "Canadian or Mexican professional", group: "Work & Specialty", workAuthorized: true },
    { value: "E-1", label: "E-1 (Treaty Trader)", detail: "Engaged in substantial international trade", group: "Work & Specialty", workAuthorized: true },
    { value: "E-2", label: "E-2 (Treaty Investor)", detail: "Directing substantial investment enterprise", group: "Work & Specialty", workAuthorized: true },
    { value: "E-3", label: "E-3 (Australian Specialty)", detail: "Australian national in specialty occupation", group: "Work & Specialty", workAuthorized: true },
    { value: "P-1", label: "P-1 (Athletes / Entertainers)", detail: "Internationally recognized athlete or group", group: "Work & Specialty", workAuthorized: true },
    { value: "R-1", label: "R-1 (Religious Worker)", detail: "Non-profit religious organization role", group: "Work & Specialty", workAuthorized: true }
  ],
  "Family & Fiance(e)": [
    { value: "K-1", label: "K-1 (Fiancé/e of US Citizen)", detail: "Entering US to marry a US citizen", group: "Family & Fiance(e)", workAuthorized: false },
    { value: "K-3", label: "K-3 (Spouse of US Citizen)", detail: "Awaiting approval of Form I-130", group: "Family & Fiance(e)", workAuthorized: false }
  ],
  "Humanitarian & Protected": [
    { value: "TPS", label: "TPS (Temporary Protected Status)", detail: "Designated country protection with EAD", group: "Humanitarian & Protected", workAuthorized: true },
    { value: "DACA", label: "DACA (Deferred Action)", detail: "Deferred childhood arrival with EAD", group: "Humanitarian & Protected", workAuthorized: true },
    { value: "Pending Asylum", label: "Pending Asylum (I-589)", detail: "Asylum application pending", group: "Humanitarian & Protected", workAuthorized: false },
    { value: "Humanitarian Parole", label: "Humanitarian Parole", detail: "Paroled entry (e.g. U4U, CHNV)", group: "Humanitarian & Protected", workAuthorized: false },
    { value: "U Visa", label: "U Visa (Crime Victims)", detail: "Victims of qualifying criminal activity", group: "Humanitarian & Protected", workAuthorized: true },
    { value: "T Visa", label: "T Visa (Trafficking Victims)", detail: "Victims of human trafficking", group: "Humanitarian & Protected", workAuthorized: true }
  ],
  "Permanent Resident & Citizen": [
    { value: "GC", label: "Green Card (Permanent Resident)", detail: "Lawful permanent resident of the United States", group: "Permanent Resident & Citizen", workAuthorized: true },
    { value: "Citizen", label: "U.S. Citizen", detail: "By birth or naturalization", group: "Permanent Resident & Citizen", workAuthorized: true }
  ],
  "Other": [
    { value: "other", label: "Other / Not listed", detail: "Enter your custom status or I-94 class of admission", group: "Other", workAuthorized: false }
  ]
};

export const ALL_VISA_OPTIONS: VisaOptionItem[] = Object.values(VISA_CATEGORY_GROUPS).flat();

/**
 * Returns true if the visa is inherently work-authorized in the US.
 * Used to determine whether employment intake fields should be required or optional.
 */
export function isWorkAuthorizedVisa(visaType: string | undefined): boolean {
  if (!visaType) return false;
  const match = ALL_VISA_OPTIONS.find(
    (v) => v.value.toLowerCase() === visaType.trim().toLowerCase()
  );
  if (match) return match.workAuthorized;

  // Heuristic for custom/unlisted strings: if they mention "ead", "work", "h1", "l1", "o1", "tn", treat as work-authorized
  const lower = visaType.toLowerCase();
  if (lower.includes("ead") || lower.includes("h-1") || lower.includes("h1") || lower.includes("l-1") || lower.includes("o-1") || lower.includes("tn")) {
    return true;
  }
  return false;
}

export interface GreenCardPathwayItem {
  id: ImmigrantPetitionType;
  label: string;
  category: "Family & Marriage" | "Employment-Based" | "Self-Sponsored" | "Investment" | "Humanitarian" | "Lottery" | "Other";
  defaultPreferenceCategory: StandardPreferenceCategory;
  description: string;
}

export const GREEN_CARD_PATHWAYS: GreenCardPathwayItem[] = [
  {
    id: "family_marriage_usc",
    label: "Marriage to U.S. Citizen",
    category: "Family & Marriage",
    defaultPreferenceCategory: "Immediate Relative (Spouse)",
    description: "Immediate Relative petition (Form I-130 + Form I-485 adjustment or consular processing)."
  },
  {
    id: "family_marriage_lpr",
    label: "Marriage to Permanent Resident (Green Card Holder)",
    category: "Family & Marriage",
    defaultPreferenceCategory: "F-2A",
    description: "Family Preference F-2A category with Visa Bulletin backlog queue."
  },
  {
    id: "family_preference",
    label: "Other Family-Sponsored (Parent, Child, Sibling)",
    category: "Family & Marriage",
    defaultPreferenceCategory: "Immediate Relative (Parent/Child)",
    description: "Immediate Relative or family preference categories (F-1, F-2B, F-3, F-4)."
  },
  {
    id: "employer_sponsored",
    label: "Employer-Sponsored (EB-1, EB-2, EB-3)",
    category: "Employment-Based",
    defaultPreferenceCategory: "EB-2",
    description: "PERM Labor Certification, Form ETA-9089, and Form I-140 filing by an employer."
  },
  {
    id: "self_petition_niw",
    label: "Self-Petition: EB-2 NIW (National Interest Waiver)",
    category: "Self-Sponsored",
    defaultPreferenceCategory: "EB-2 NIW",
    description: "Self-petitioned Form I-140 based on endeavor of substantial merit and national importance."
  },
  {
    id: "self_petition_eb1a",
    label: "Self-Petition: EB-1A (Extraordinary Ability)",
    category: "Self-Sponsored",
    defaultPreferenceCategory: "EB-1A",
    description: "Self-petitioned Form I-140 based on sustained national or international acclaim."
  },
  {
    id: "investment_eb5",
    label: "Investment: EB-5 Immigrant Investor",
    category: "Investment",
    defaultPreferenceCategory: "EB-5",
    description: "Commercial enterprise investment (Form I-526/I-526E -> Form I-485/I-829)."
  },
  {
    id: "humanitarian_asylum",
    label: "Humanitarian: Asylum Adjustment",
    category: "Humanitarian",
    defaultPreferenceCategory: "Asylum Adjustment",
    description: "Form I-485 adjustment of status after one year of granted asylee status."
  },
  {
    id: "diversity_lottery",
    label: "Diversity Immigrant Visa (DV Lottery)",
    category: "Lottery",
    defaultPreferenceCategory: "Diversity Visa",
    description: "Selected in annual Diversity Visa lottery program."
  },
  {
    id: "other",
    label: "Other / Custom Green Card Pathway",
    category: "Other",
    defaultPreferenceCategory: "Not sure",
    description: "Special immigrant, VAWA, U/T adjustment, or other custom statutory pathway."
  }
];

export interface StageOptionItem {
  id: GreenCardStage;
  label: string;
  detail: string;
}

export const STAGES_BY_PATHWAY: Record<string, StageOptionItem[]> = {
  family: [
    { id: "not_started", label: "Not started yet", detail: "Preparing documents and evidence" },
    { id: "i130_filed", label: "Form I-130 filed", detail: "Petition submitted to USCIS; awaiting approval" },
    { id: "i130_approved", label: "Form I-130 approved", detail: "Petition approved; awaiting adjustment or visa availability" },
    { id: "i485_filed", label: "Form I-485 filed (Adjustment of Status)", detail: "Adjustment application pending with USCIS" },
    { id: "consular_processing", label: "Consular Processing / NVC", detail: "Processing abroad through National Visa Center" },
    { id: "conditional_resident", label: "2-Year Conditional Resident", detail: "Holding 2-year conditional card; Form I-751 pending or upcoming" },
    { id: "i485_approved", label: "10-Year Permanent Resident", detail: "Full permanent resident green card granted" }
  ],
  employer: [
    { id: "not_started", label: "Not started yet", detail: "Company evaluating or preparing petition" },
    { id: "pwd_recruitment", label: "Prevailing Wage / Recruitment", detail: "PWD obtained or labor market recruitment ongoing" },
    { id: "perm_in_progress", label: "PERM filed (Labor Certification)", detail: "Form ETA-9089 pending with Department of Labor" },
    { id: "perm_certified", label: "PERM certified", detail: "Labor certification approved; ready for Form I-140" },
    { id: "i140_filed", label: "Form I-140 filed", detail: "Immigrant petition pending with USCIS" },
    { id: "i140_approved", label: "Form I-140 approved", detail: "Approved I-140 locks in your Priority Date!" },
    { id: "i485_filed", label: "Form I-485 filed (Adjustment of Status)", detail: "Adjustment application pending with USCIS" },
    { id: "i485_approved", label: "Permanent Resident", detail: "Green card granted" }
  ],
  self_petition: [
    { id: "not_started", label: "Not started yet", detail: "Gathering evidence and drafting petition letters" },
    { id: "i140_filed", label: "Form I-140 filed", detail: "Self-petition submitted to USCIS (no PERM needed)" },
    { id: "i140_approved", label: "Form I-140 approved", detail: "Petition approved; priority date locked" },
    { id: "i485_filed", label: "Form I-485 filed (Adjustment of Status)", detail: "Adjustment application pending with USCIS" },
    { id: "i485_approved", label: "Permanent Resident", detail: "Green card granted" }
  ],
  universal: [
    { id: "not_started", label: "Not started yet", detail: "Gathering materials or awaiting eligibility" },
    { id: "i130_filed", label: "Initial petition filed (I-130, I-140, I-526, or I-360)", detail: "Pending adjudication by USCIS" },
    { id: "i130_approved", label: "Initial petition approved", detail: "Approved petition locking in priority date" },
    { id: "consular_processing", label: "Consular / NVC processing", detail: "Department of State consular processing" },
    { id: "i485_filed", label: "Form I-485 filed", detail: "Adjustment of Status pending" },
    { id: "conditional_resident", label: "Conditional Resident", detail: "Holding conditional green card" },
    { id: "i485_approved", label: "Permanent Resident approved", detail: "Full residency granted" }
  ]
};

export function getStagesForPathway(pathwayId: string | undefined): StageOptionItem[] {
  if (!pathwayId) return STAGES_BY_PATHWAY.universal;
  if (pathwayId.startsWith("family_")) return STAGES_BY_PATHWAY.family;
  if (pathwayId.startsWith("self_petition_")) return STAGES_BY_PATHWAY.self_petition;
  if (pathwayId === "employer_sponsored" || pathwayId === "concurrent_employer") return STAGES_BY_PATHWAY.employer;
  return STAGES_BY_PATHWAY.universal;
}

export interface SponsorAttributionOption {
  value: string;
  label: string;
  helper: string;
}

export const SPONSOR_ATTRIBUTION_OPTIONS: SponsorAttributionOption[] = [
  { value: "current_employer", label: "Current Employer", helper: "Filed by your current employing company" },
  { value: "prior_employer", label: "Prior Employer", helper: "Filed by a previous company (approved I-140 locks in Priority Date)" },
  { value: "self_petition", label: "Self-Petition (No Employer)", helper: "You are the petitioner (e.g. EB-2 NIW or EB-1A)" },
  { value: "spouse", label: "Spouse", helper: "Sponsored by your U.S. citizen or green card holder spouse" },
  { value: "family_member", label: "Family Member", helper: "Sponsored by a parent, child, or sibling" },
  { value: "other", label: "Other / Third Party", helper: "Prospective employer or other sponsoring entity" }
];

/** Every preference category, in the order people look for them. */
export const ALL_PREFERENCE_CATEGORIES: string[] = [
  "EB-1", "EB-1A", "EB-1B", "EB-1C", "EB-2", "EB-2 NIW", "EB-3", "EB-4", "EB-5",
  "Immediate Relative (Spouse)", "Immediate Relative (Parent/Child)",
  "F-1", "F-2A", "F-2B", "F-3", "F-4",
  "Diversity Visa", "Asylum Adjustment", "Not sure"
];

/** Every green card step across all paths, for single-step fields (Settings, dashboard quick edit). */
export const ALL_GREEN_CARD_STAGE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "not_started", label: "Not started yet" },
  { id: "pwd_recruitment", label: "Prevailing wage / recruitment" },
  { id: "perm_in_progress", label: "PERM in progress" },
  { id: "perm_certified", label: "PERM certified" },
  { id: "i140_filed", label: "I-140 filed" },
  { id: "i140_approved", label: "I-140 approved" },
  { id: "i130_filed", label: "I-130 or first petition filed (family, EB-5, other)" },
  { id: "i130_approved", label: "I-130 or first petition approved" },
  { id: "consular_processing", label: "Consular / NVC processing" },
  { id: "i485_filed", label: "I-485 filed (adjustment of status)" },
  { id: "conditional_resident", label: "2-year conditional resident" },
  { id: "i485_approved", label: "Permanent resident" }
];

/** Steps the profile's yes/no flags can't hold, so the saved step is shown instead. */
const FLAG_STAGES = new Set(["not_started", "perm_in_progress", "perm_certified", "i140_filed", "i140_approved", "i485_filed"]);

/** The step to show: the one saved, unless the PERM/I-140/I-485 flags describe it. */
export function chosenGreenCardStage(savedStage: string | undefined, flagStage: string): string {
  return savedStage && !FLAG_STAGES.has(savedStage) ? savedStage : flagStage;
}

/** Turn a visa class as printed (F1, L1A, B-2) into the standard value, or null if it isn't one. */
export function standardVisaValue(raw: string): string | null {
  const squash = (v: string) => v.toUpperCase().replace(/[\s/-]/g, "");
  let target = squash(raw);
  if (!target) return null;
  // I-94 class for an L-2 spouse (L2Y children stay unmatched).
  if (target === "L2S") target = "L2";
  const match = ALL_VISA_OPTIONS.find((o) => o.value !== "other" && squash(o.value) === target);
  return match?.value ?? null;
}

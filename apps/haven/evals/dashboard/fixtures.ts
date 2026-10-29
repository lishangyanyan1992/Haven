import type { ImmigrationProfile } from "@/types/domain";

// Made-up person with the same shape as a real two-employer case: an approved
// EB-2 I-140 from an earlier employer, and a second employer's green card that
// was in its first step when they were laid off. Names and dates are fictional.

export const TWO_EMPLOYER_NOW = new Date("2026-10-28T12:00:00Z");

/** Saved the way older records were written (petitionKind / category). */
export const TWO_EMPLOYER_RAW_PETITIONS = [
  {
    id: "pet-northwind-eb2",
    stage: "i140_approved",
    category: "EB-2",
    sponsorName: "Ridgeline Labs, Northwind Mutual Insurance",
    petitionKind: "employer_sponsored",
    priorityDate: "2021-06-14",
    i140ApprovalDate: "2026-01-20",
    isRevocationProtected: true,
    isPriorityDateRecaptured: true,
    notes: "Approved before leaving."
  },
  {
    id: "pet-harbor-eb2",
    stage: "pwd_recruitment",
    category: "EB-2",
    sponsorName: "Harbor Ventures (Lakeside Insurance)",
    petitionKind: "employer_sponsored",
    priorityDate: "2021-06-14",
    isRevocationProtected: false,
    isPriorityDateRecaptured: false
  }
];

export function twoEmployerProfile(overrides: Partial<ImmigrationProfile> = {}): ImmigrationProfile {
  return {
    id: "fixture-two-employer",
    fullName: "Sam Rivera",
    email: "sam@example.com",
    visaType: "H1B",
    countryOfBirth: "India",
    currentVisaExpiryDate: "2026-12-15",
    h1bStartDate: "2019-10-01",
    permStage: "not_started",
    i140Filed: false,
    i140Approved: true,
    i140ApprovalDate: "2026-01-20",
    priorityDate: "2021-06-14",
    retainedPriorityDate: "2021-06-14",
    retainedPriorityDateSponsor: "Ridgeline Labs, Northwind Mutual Insurance",
    retainedPriorityDateCategory: "EB-2",
    preferenceCategory: "EB-2",
    i485Filed: false,
    employerName: "Harbor Ventures",
    employmentStatus: "laid_off",
    spouseVisaStatus: "none",
    primaryGoal: "get_gc",
    topConcerns: [],
    ...overrides
  };
}

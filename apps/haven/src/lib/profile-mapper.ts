import { normalizePetitions } from "@/lib/petitions";
import type { ImmigrationProfile } from "@/types/domain";

// The one reader that turns a user_profiles row into an ImmigrationProfile.
// Everything that loads a profile (dashboard, saves, stored signals) uses this,
// so green card petitions and retained priority dates are never dropped.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function meta(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isoDate(value: unknown): string | undefined {
  const v = text(value);
  return v && ISO_DATE.test(v) ? v : undefined;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function mapProfileRow(row: Record<string, unknown>): ImmigrationProfile {
  const deadlineMeta = meta(row.deadline_answers);
  const petitions = normalizePetitions(deadlineMeta.immigrantPetitions);

  return {
    id: String(row.id ?? ""),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    visaType: row.visa_type as ImmigrationProfile["visaType"],
    countryOfBirth: String(row.country_of_birth ?? ""),
    currentVisaExpiryDate: optionalText(row.current_visa_expiry_date) ?? isoDate(deadlineMeta.statusEndDate),
    h1bStartDate: optionalText(row.h1b_start_date),
    permStage: row.perm_stage as ImmigrationProfile["permStage"],
    permFilingDate: optionalText(row.perm_filing_date),
    i140Filed: Boolean(row.i140_filed),
    i140Approved: Boolean(row.i140_approved),
    i140ApprovalDate: optionalText(row.i140_approval_date),
    priorityDate: optionalText(row.priority_date),
    greenCardSponsor: text(deadlineMeta.greenCardSponsor),
    retainedPriorityDate: isoDate(deadlineMeta.retainedPriorityDate),
    retainedPriorityDateSponsor: text(deadlineMeta.retainedPriorityDateSponsor),
    retainedPriorityDateCategory: text(deadlineMeta.retainedPriorityDateCategory) as
      | ImmigrationProfile["preferenceCategory"]
      | undefined,
    immigrantPetitions: petitions.length > 0 ? petitions : undefined,
    preferenceCategory: row.preference_category as ImmigrationProfile["preferenceCategory"],
    i485Filed: Boolean(row.i485_filed),
    employerName: optionalText(row.employer_name),
    employerSize: (row.employer_size as ImmigrationProfile["employerSize"] | null) ?? undefined,
    employerIndustry: optionalText(row.employer_industry),
    jobTitle: optionalText(row.job_title),
    employmentStatus: row.employment_status as ImmigrationProfile["employmentStatus"],
    spouseVisaStatus: row.spouse_visa_status as ImmigrationProfile["spouseVisaStatus"],
    primaryGoal: row.primary_goal as ImmigrationProfile["primaryGoal"],
    topConcerns: ((row.top_concerns as string[] | null) ?? []) as ImmigrationProfile["topConcerns"],
    communityReplyEmailNotifications: Boolean(row.community_reply_email_notifications),
    statusUpdateEmailNotifications: Boolean(row.status_update_email_notifications)
  };
}

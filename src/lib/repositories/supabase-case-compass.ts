import type { HavenRepository } from "@/lib/repositories/contracts";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { mergeSnapshotProfile } from "@/lib/haven";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ImmigrationProfile } from "@/types/domain";

function mapProfileRow(row: Record<string, unknown>): ImmigrationProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    visaType: row.visa_type as ImmigrationProfile["visaType"],
    countryOfBirth: String(row.country_of_birth ?? ""),
    currentVisaExpiryDate: (row.current_visa_expiry_date as string | null) ?? undefined,
    h1bStartDate: (row.h1b_start_date as string | null) ?? undefined,
    permStage: row.perm_stage as ImmigrationProfile["permStage"],
    permFilingDate: (row.perm_filing_date as string | null) ?? undefined,
    i140Approved: Boolean(row.i140_approved),
    i140ApprovalDate: (row.i140_approval_date as string | null) ?? undefined,
    priorityDate: (row.priority_date as string | null) ?? undefined,
    preferenceCategory: row.preference_category as ImmigrationProfile["preferenceCategory"],
    i485Filed: Boolean(row.i485_filed),
    employerName: (row.employer_name as string | null) ?? undefined,
    employerSize: (row.employer_size as ImmigrationProfile["employerSize"]) ?? undefined,
    employerIndustry: (row.employer_industry as string | null) ?? undefined,
    jobTitle: (row.job_title as string | null) ?? undefined,
    employmentStatus: row.employment_status as ImmigrationProfile["employmentStatus"],
    spouseVisaStatus: row.spouse_visa_status as ImmigrationProfile["spouseVisaStatus"],
    primaryGoal: row.primary_goal as ImmigrationProfile["primaryGoal"],
    topConcerns: ((row.top_concerns as string[] | null) ?? []) as ImmigrationProfile["topConcerns"]
  };
}

export const supabaseHavenRepository: HavenRepository = {
  async getSnapshot() {
    const supabase = await createSupabaseServerClient();
    const db = supabase as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return havenSnapshot;
    }

    const { data: profileRow } = await db.from("user_profiles").select("*").eq("id", user.id).maybeSingle();

    if (!profileRow) {
      return havenSnapshot;
    }

    return mergeSnapshotProfile(havenSnapshot, mapProfileRow(profileRow as Record<string, unknown>));
  }
};

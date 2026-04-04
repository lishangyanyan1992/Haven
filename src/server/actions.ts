"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ONBOARDING_OVERRIDE_COOKIE } from "@/lib/profile-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistProfileDraft } from "@/lib/profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const EMAIL_INGEST_DOMAIN = env.EMAIL_INGEST_DOMAIN ?? "import.haven-h1b.com";
import {
  emailIngestConfirmationSchema,
  onboardingStepFourSchema,
  onboardingStepOneSchema,
  onboardingStepThreeSchema,
  onboardingStepTwoSchema
} from "@/lib/validation";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

/**
 * Shared post-auth routing logic used by both email/password sign-in
 * and the OAuth callback. Returns the redirect path as a string.
 */
export async function resolvePostAuthRedirect(
  userId: string,
  email: string,
  fullName?: string
): Promise<string> {
  const admin = createSupabaseAdminClient() as any;

  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, country_of_birth, employer_name, preference_category")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    // First time this user has hit Haven — bootstrap a stub profile
    await admin.from("user_profiles").upsert({
      id: userId,
      full_name: fullName ?? email.split("@")[0] ?? "New Haven user",
      email,
      visa_type: "H1B",
      country_of_birth: "",
      perm_stage: "not_started",
      preference_category: "Not sure",
      i485_filed: false,
      i140_approved: false,
      employment_status: "employed",
      spouse_visa_status: "none",
      primary_goal: "not_sure",
      top_concerns: []
    });
    await admin.from("derived_signals").upsert({
      user_id: userId,
      layoff_readiness_score: "low",
      layoff_readiness_reasoning: ["Complete onboarding to calculate personalized readiness."]
    });
    return "/onboarding";
  }

  // Check if onboarding was completed (email_alias is created only at step 4)
  const { data: emailAlias } = await admin
    .from("email_aliases")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!emailAlias) {
    let stepsCompleted = 0;
    if (profile.country_of_birth?.trim()) stepsCompleted++;
    if (profile.employer_name) stepsCompleted++;
    if (profile.preference_category && profile.preference_category !== "Not sure") stepsCompleted++;
    const progress = Math.round((stepsCompleted / 4) * 100);
    return `/onboarding?progress=${progress}`;
  }

  return "/dashboard";
}

async function bootstrapUserProfile(user: { id: string; email?: string | null }, fullName?: string) {
  const admin = createSupabaseAdminClient() as any;

  await admin.from("user_profiles").upsert({
    id: user.id,
    full_name: fullName ?? user.email?.split("@")[0] ?? "New Haven user",
    email: user.email ?? "",
    visa_type: "H1B",
    country_of_birth: "India",
    perm_stage: "not_started",
    preference_category: "Not sure",
    i485_filed: false,
    i140_approved: false,
    employment_status: "employed",
    spouse_visa_status: "none",
    primary_goal: "not_sure",
    top_concerns: ["layoffs"]
  });

  await admin.from("derived_signals").upsert({
    user_id: user.id,
    layoff_readiness_score: "low",
    layoff_readiness_reasoning: ["Complete onboarding to calculate personalized readiness."]
  });

  await admin.from("email_aliases").upsert({
    user_id: user.id,
    alias: `${(user.email ?? "user").split("@")[0]}-${user.id.slice(0, 6)}@${EMAIL_INGEST_DOMAIN}`
  });
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");
  const admin = createSupabaseAdminClient() as any;

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const { data: adminUserList } = await admin.auth.admin.listUsers();
    const authUserExists = (adminUserList?.users ?? []).some(
      (u: { email?: string }) => u.email?.toLowerCase() === email
    );
    if (!authUserExists) {
      redirect(`/register?email=${encodeURIComponent(email)}&message=no_account`);
    }
    redirect(`/login?email=${encodeURIComponent(email)}&message=invalid_credentials`);
  }

  const userId = signInData?.user?.id;
  const fullName = String(signInData?.user?.user_metadata?.full_name ?? email.split("@")[0]);
  const destination = userId
    ? await resolvePostAuthRedirect(userId, email, fullName)
    : "/onboarding";

  const finalRedirect =
    destination === "/dashboard" && redirectTo && !redirectTo.startsWith("/onboarding")
      ? redirectTo
      : destination;
  redirect(finalRedirect);
}

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const admin = createSupabaseAdminClient() as any;

  // Check if a profile already exists (stub or complete)
  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    // Distinguish full account vs. incomplete onboarding stub
    const { data: emailAlias } = await admin
      .from("email_aliases")
      .select("id")
      .eq("user_id", existingProfile.id)
      .maybeSingle();

    if (emailAlias) {
      redirect(`/login?email=${encodeURIComponent(email)}&message=existing_account`);
    } else {
      redirect(`/login?email=${encodeURIComponent(email)}&message=incomplete_onboarding&progress=0`);
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      redirect(`/login?email=${encodeURIComponent(email)}&message=existing_account`);
    }
    if (error.message.toLowerCase().includes("rate limit")) {
      redirect(`/register?email=${encodeURIComponent(email)}&message=rate_limited`);
    }
    throw new Error(error.message);
  }

  // Auth user already existed but no profile (edge case: profile was deleted)
  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    redirect(`/login?email=${encodeURIComponent(email)}&message=incomplete_onboarding&progress=0`);
  }

  if (data.session && data.user) {
    // Email confirmation disabled — create stub profile and go to onboarding
    await admin.from("user_profiles").upsert({
      id: data.user.id,
      full_name: fullName || email.split("@")[0],
      email,
      visa_type: "H1B",
      country_of_birth: "",
      perm_stage: "not_started",
      preference_category: "Not sure",
      i485_filed: false,
      i140_approved: false,
      employment_status: "employed",
      spouse_visa_status: "none",
      primary_goal: "not_sure",
      top_concerns: []
    });
    redirect("/onboarding");
  }

  // Email confirmation enabled — ask user to verify first
  redirect(`/login?email=${encodeURIComponent(email)}&message=confirm_email`);
}

export async function completeOnboardingAction(formData: FormData) {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient() as any;

  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Haven user");

  // Create base profile so persistProfileDraft can update it
  await admin.from("user_profiles").upsert({
    id: user.id,
    full_name: fullName,
    email: user.email ?? "",
    visa_type: "H1B",
    country_of_birth: "India",
    perm_stage: "not_started",
    preference_category: "Not sure",
    i485_filed: false,
    i140_approved: false,
    employment_status: "employed",
    spouse_visa_status: "none",
    primary_goal: "not_sure",
    top_concerns: ["layoffs"]
  });

  // Persist all onboarding data
  await persistProfileDraft(user.id, {
    visaType: String(formData.get("visaType") ?? ""),
    countryOfBirth: String(formData.get("countryOfBirth") ?? ""),
    primaryGoal: String(formData.get("primaryGoal") ?? ""),
    employerName: String(formData.get("employerName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    h1bStartDate: String(formData.get("h1bStartDate") ?? ""),
    employerSize: String(formData.get("employerSize") ?? ""),
    greenCardStage: String(formData.get("greenCardStage") ?? ""),
    priorityDate: String(formData.get("priorityDate") ?? ""),
    preferenceCategory: String(formData.get("preferenceCategory") ?? ""),
    i140Approved: String(formData.get("i140Approved") ?? "false"),
    spouseVisaStatus: String(formData.get("spouseVisaStatus") ?? ""),
    topConcerns: formData.getAll("topConcerns").map(String)
  });

  await admin.from("email_aliases").upsert({
    user_id: user.id,
    alias: `${(user.email ?? "user").split("@")[0]}-${user.id.slice(0, 6)}@${EMAIL_INGEST_DOMAIN}`
  });

  const cookieStore = await cookies();
  cookieStore.delete(ONBOARDING_OVERRIDE_COOKIE);
}

export async function resetPasswordAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect("/forgot-password?message=missing_email");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`
  });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      redirect(`/forgot-password?email=${encodeURIComponent(email)}&message=rate_limited`);
    }
    redirect(`/forgot-password?email=${encodeURIComponent(email)}&message=error`);
  }

  redirect(`/forgot-password?message=sent`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ONBOARDING_OVERRIDE_COOKIE);
  redirect("/login");
}

export async function saveOnboardingStepOneAction(formData: FormData) {
  const input = onboardingStepOneSchema.parse({
    visaType: formData.get("visaType"),
    countryOfBirth: formData.get("countryOfBirth"),
    primaryGoal: formData.get("primaryGoal")
  });

  const { user } = await requireUser();
  await persistProfileDraft(user.id, {
    visaType: input.visaType,
    countryOfBirth: input.countryOfBirth,
    primaryGoal: input.primaryGoal
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function saveOnboardingStepTwoAction(formData: FormData) {
  const input = onboardingStepTwoSchema.parse({
    employerName: formData.get("employerName"),
    jobTitle: formData.get("jobTitle"),
    h1bStartDate: formData.get("h1bStartDate"),
    employerSize: formData.get("employerSize")
  });

  const { user } = await requireUser();
  await persistProfileDraft(user.id, {
    employerName: input.employerName,
    jobTitle: input.jobTitle,
    h1bStartDate: input.h1bStartDate || "",
    employerSize: input.employerSize
  });

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
}

export async function saveOnboardingStepThreeAction(formData: FormData) {
  const input = onboardingStepThreeSchema.parse({
    greenCardStage: formData.get("greenCardStage"),
    priorityDate: formData.get("priorityDate"),
    preferenceCategory: formData.get("preferenceCategory"),
    i140Approved: formData.get("i140Approved") === "true"
  });

  const { user } = await requireUser();
  await persistProfileDraft(user.id, {
    greenCardStage: input.greenCardStage,
    priorityDate: input.priorityDate || "",
    preferenceCategory: input.preferenceCategory,
    i140Approved: input.i140Approved
  });

  revalidatePath("/onboarding");
  revalidatePath("/timeline");
  revalidatePath("/planner");
}

export async function saveOnboardingStepFourAction(formData: FormData) {
  const input = onboardingStepFourSchema.parse({
    spouseVisaStatus: formData.get("spouseVisaStatus"),
    topConcerns: formData.getAll("topConcerns")
  });

  const { user } = await requireUser();
  await persistProfileDraft(user.id, {
    spouseVisaStatus: input.spouseVisaStatus,
    topConcerns: input.topConcerns
  });

  revalidatePath("/onboarding");
  revalidatePath("/planner");
  revalidatePath("/community");
  revalidatePath("/dashboard");
}

export async function saveProfileSettingsAction(formData: FormData) {
  const { user } = await requireUser();
  const cookieStore = await cookies();

  await persistProfileDraft(user.id, {
    visaType: String(formData.get("visaType") ?? ""),
    countryOfBirth: String(formData.get("countryOfBirth") ?? ""),
    primaryGoal: String(formData.get("primaryGoal") ?? ""),
    employerName: String(formData.get("employerName") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    h1bStartDate: String(formData.get("h1bStartDate") ?? ""),
    employerSize: String(formData.get("employerSize") ?? ""),
    greenCardStage: String(formData.get("greenCardStage") ?? ""),
    priorityDate: String(formData.get("priorityDate") ?? ""),
    preferenceCategory: String(formData.get("preferenceCategory") ?? ""),
    i140Approved: String(formData.get("i140Approved") ?? "false"),
    spouseVisaStatus: String(formData.get("spouseVisaStatus") ?? ""),
    topConcerns: formData.getAll("topConcerns").map(String)
  });

  cookieStore.delete(ONBOARDING_OVERRIDE_COOKIE);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  revalidatePath("/planner");
  redirect("/settings?saved=1");
}

// Maps extracted field labels → user_profiles columns
const FIELD_TO_PROFILE_COLUMN: Record<string, string> = {
  "Priority Date": "priority_date",
  "Preference Category": "preference_category",
  "Approval Date": "i140_approval_date",
  "Petitioner / Employer": "employer_name",
  "Valid Through": "current_visa_expiry_date",
};

export async function confirmEmailIngestAction(formData: FormData) {
  const { user } = await requireUser();

  const input = emailIngestConfirmationSchema.parse({
    recordId: formData.get("recordId"),
    acceptedFieldLabels: formData.getAll("acceptedFieldLabels").map(String)
  });

  const admin = createSupabaseAdminClient() as any;

  // Ownership check — only update if record belongs to the current user
  await admin
    .from("email_ingest_records")
    .update({ status: "accepted" })
    .eq("id", input.recordId)
    .eq("user_id", user.id);

  // Fetch the accepted extracted fields from DB (never trust client values)
  if (input.acceptedFieldLabels.length > 0) {
    const { data: fieldRows } = await admin
      .from("email_extracted_fields")
      .select("label, value")
      .eq("record_id", input.recordId)
      .in("label", input.acceptedFieldLabels);

    if (fieldRows && fieldRows.length > 0) {
      const profilePatch: Record<string, string> = {};
      for (const row of fieldRows as Array<{ label: string; value: string }>) {
        const col = FIELD_TO_PROFILE_COLUMN[row.label];
        if (col) profilePatch[col] = row.value;
      }

      if (Object.keys(profilePatch).length > 0) {
        await admin
          .from("user_profiles")
          .update(profilePatch)
          .eq("id", user.id);
      }
    }
  }

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
}

const VALID_CONTACT_ROLES = ["hr", "lawyer", "associated_company", "uscis", "recruiter", "other"] as const;

export async function labelContactAction(formData: FormData) {
  const { user } = await requireUser();

  const contactId = String(formData.get("contactId") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!contactId) return;
  if (role && !VALID_CONTACT_ROLES.includes(role as (typeof VALID_CONTACT_ROLES)[number])) return;

  const admin = createSupabaseAdminClient() as any;

  // Ownership check via user_id filter
  await admin
    .from("email_contacts")
    .update({ role: role || null, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("user_id", user.id);

  revalidatePath("/inbox");
}

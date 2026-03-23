"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ONBOARDING_OVERRIDE_COOKIE } from "@/lib/profile-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistProfileDraft } from "@/lib/profile-sync";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    alias: `${(user.email ?? "user").split("@")[0]}-${user.id.slice(0, 6)}@import.haven.com`
  });
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message);
  }

  const finalRedirect = redirectTo.startsWith("/onboarding") ? "/dashboard" : redirectTo;
  redirect(finalRedirect);
}

export async function signUpAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const admin = createSupabaseAdminClient() as any;

  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    redirect(`/login?email=${encodeURIComponent(email)}&message=existing_account`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      redirect(`/login?email=${encodeURIComponent(email)}&message=existing_account`);
    }

    throw new Error(error.message);
  }

  if (data.user) {
    await bootstrapUserProfile(data.user, fullName);
  }

  redirect("/onboarding");
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

export async function confirmEmailIngestAction(formData: FormData) {
  const input = emailIngestConfirmationSchema.parse({
    recordId: formData.get("recordId"),
    acceptedFieldLabels: formData.getAll("acceptedFieldLabels").map(String)
  });

  const admin = createSupabaseAdminClient() as any;
  await admin.from("email_ingest_records").update({ status: "accepted" }).eq("id", input.recordId);

  revalidatePath("/inbox");
}

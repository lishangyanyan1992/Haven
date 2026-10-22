"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@haven/auth/admin";
import { normalizeRedirectPath, resolvePostSignInRedirect } from "@haven/auth/redirects";
import { createSupabaseServerClient } from "@haven/auth/server";

import { ONBOARDING_OVERRIDE_COOKIE } from "@/lib/profile-sync";
import { persistProfileDraft } from "@/lib/profile-sync";
import { env } from "@/lib/env";
import { SIGNED_IN_HOME } from "@/lib/archived-routes";
import { isInvitedEmail } from "@/lib/access";
import { getFirmMembership } from "@/lib/firms/access";
import { recordFirmSharedAnswers } from "@/lib/firms/answers";
import { markFirmClientCompleted } from "@/lib/firms/intake";
import { captureSignupCompleted } from "@/lib/posthog-server";

const EMAIL_INGEST_DOMAIN = env.EMAIL_INGEST_DOMAIN ?? "import.haven-h1b.com";
import {
  emailIngestConfirmationSchema,
  onboardingStepFourSchema,
  onboardingStepOneSchema,
  onboardingStepThreeSchema,
  onboardingStepTwoSchema,
  waitlistSignupSchema
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
 * Shared post-auth routing logic for authenticated users.
 * Returns the redirect path as a string.
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
    // First time this user has hit Haven — bootstrap a stub profile. With
    // invite-only sign-up this first sign-in is when the account starts.
    await captureSignupCompleted(userId);
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

  return SIGNED_IN_HOME;
}

async function bootstrapUserProfile(user: { id: string; email?: string | null }, fullName?: string) {
  const admin = createSupabaseAdminClient() as any;

  await admin.from("user_profiles").upsert({
    id: user.id,
    full_name: fullName ?? user.email?.split("@")[0] ?? "New Haven user",
    email: user.email ?? "",
    visa_type: "H1B",
    country_of_birth: "",
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
  const redirectTo = normalizeRedirectPath(String(formData.get("redirectTo") ?? SIGNED_IN_HOME), SIGNED_IN_HOME);

  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Always redirect to invalid_credentials — do not distinguish "wrong
    // password" from "no account". Telling a user whether an email is
    // registered is a user-enumeration vulnerability.
    redirect(`/login?email=${encodeURIComponent(email)}&message=invalid_credentials`);
  }

  // Lawyers go to their firm dashboard. They aren't clients, so they skip
  // the client invite check and client profile setup.
  if (await getFirmMembership(signInData?.user?.id)) {
    redirect("/firm");
  }

  // Joining a firm is not done here: it needs the one-time code from the
  // firm's intake email (claimFirmInviteAction, on the set-password page),
  // so an ordinary sign-in can never attach someone to a firm.

  if (!(await isInvitedEmail(email))) {
    await supabase.auth.signOut();
    redirect("/register?message=not_invited");
  }

  const userId = signInData?.user?.id;
  const fullName = String(signInData?.user?.user_metadata?.full_name ?? email.split("@")[0]);
  const destination = userId
    ? await resolvePostAuthRedirect(userId, email, fullName)
    : "/onboarding";

  const finalRedirect = resolvePostSignInRedirect({
    redirectTo,
    preferredPath: destination,
    fallbackPath: SIGNED_IN_HOME,
    disallowRedirectPrefixes: ["/onboarding"]
  });
  redirect(finalRedirect);
}

/**
 * Open sign-up is closed: Haven is invitation only. Accounts are created by
 * the invite email sendInviteLinkAction sends, which proves mailbox ownership.
 * Kept so any old form post lands somewhere sensible.
 */
export async function signUpAction(_formData: FormData) {
  redirect("/register");
}

export async function submitWaitlistAction(input: {
  fullName: string;
  email: string;
  interestKey: string;
  interestLabel: string;
  sourcePath?: string;
  metadata?: Record<string, string>;
}) {
  const parsed = waitlistSignupSchema.safeParse({
    ...input,
    fullName: String(input.fullName ?? "").trim(),
    email: String(input.email ?? "").trim().toLowerCase(),
    interestKey: String(input.interestKey ?? "").trim(),
    interestLabel: String(input.interestLabel ?? "").trim(),
    sourcePath: String(input.sourcePath ?? "/").trim() || "/"
  });

  if (!parsed.success) {
    return {
      status: "error" as const,
      message: "Enter a valid name and email."
    };
  }

  try {
    const admin = createSupabaseAdminClient() as any;
    const now = new Date().toISOString();
    const normalizedEmail = parsed.data.email.toLowerCase();

    const { error } = await admin.from("waitlist_signups").upsert(
      {
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        normalized_email: normalizedEmail,
        interest_key: parsed.data.interestKey,
        interest_label: parsed.data.interestLabel,
        source_path: parsed.data.sourcePath,
        metadata: sanitizeWaitlistMetadata(input.metadata),
        updated_at: now
      },
      {
        onConflict: "normalized_email,interest_key,source_path",
        ignoreDuplicates: false
      }
    );

    if (error) {
      console.error("[waitlist] failed to save signup", error);
      return {
        status: "error" as const,
        message: "Could not save your request right now. Please try again."
      };
    }

    return {
      status: "success" as const,
      message: `You're on the list for ${parsed.data.interestLabel}.`
    };
  } catch (error) {
    console.error("[waitlist] unexpected error", error);
    return {
      status: "error" as const,
      message: "Could not save your request right now. Please try again."
    };
  }
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
    country_of_birth: "",
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
  const setupDraft = {
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
    topConcerns: formData.getAll("topConcerns").map(String),
    communityReplyEmailNotifications: String(formData.get("communityReplyEmailNotifications") ?? "false"),
    statusUpdateEmailNotifications: String(formData.get("statusUpdateEmailNotifications") ?? "false")
  };
  await persistProfileDraft(user.id, setupDraft);
  await recordFirmSharedAnswers(user.id, setupDraft);

  await admin.from("email_aliases").upsert({
    user_id: user.id,
    alias: `${(user.email ?? "user").split("@")[0]}-${user.id.slice(0, 6)}@${EMAIL_INGEST_DOMAIN}`
  });
  await markFirmClientCompleted(user.id);

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
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`
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
  const setupDraft = {
    visaType: input.visaType,
    countryOfBirth: input.countryOfBirth,
    primaryGoal: input.primaryGoal
  };
  await persistProfileDraft(user.id, setupDraft);
  await recordFirmSharedAnswers(user.id, setupDraft);

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
  const setupDraft = {
    employerName: input.employerName,
    jobTitle: input.jobTitle,
    h1bStartDate: input.h1bStartDate || "",
    employerSize: input.employerSize
  };
  await persistProfileDraft(user.id, setupDraft);
  await recordFirmSharedAnswers(user.id, setupDraft);

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
  const setupDraft = {
    greenCardStage: input.greenCardStage,
    priorityDate: input.priorityDate || "",
    preferenceCategory: input.preferenceCategory,
    i140Approved: input.i140Approved
  };
  await persistProfileDraft(user.id, setupDraft);
  await recordFirmSharedAnswers(user.id, setupDraft);

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
  const setupDraft = {
    spouseVisaStatus: input.spouseVisaStatus,
    topConcerns: input.topConcerns
  };
  await persistProfileDraft(user.id, setupDraft);
  await recordFirmSharedAnswers(user.id, setupDraft);

  revalidatePath("/onboarding");
  revalidatePath("/planner");
  revalidatePath("/community");
  revalidatePath("/profile/community");
  revalidatePath("/dashboard");
}

export async function saveProfileSettingsAction(formData: FormData) {
  const { user } = await requireUser();
  const cookieStore = await cookies();

  const setupDraft = {
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
  };
  await persistProfileDraft(user.id, setupDraft);
  await recordFirmSharedAnswers(user.id, setupDraft);

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


function sanitizeWaitlistMetadata(metadata: Record<string, string> | undefined) {
  const clean: Record<string, string> = {};
  if (!metadata) return clean;
  for (const [key, value] of Object.entries(metadata).slice(0, 10)) {
    if (typeof value === "string" && /^[a-z_]{1,40}$/.test(key)) {
      clean[key] = value.trim().slice(0, 300);
    }
  }
  return clean;
}

/**
 * The invite chat's "my lawyer invited me" step. If the email is invited and
 * has no account yet, Supabase emails it a link to set a password. The visitor
 * always gets the same reply, so the chat never reveals who is invited.
 */
export async function sendInviteLinkAction(input: { email: string }) {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { status: "invalid" as const };
  }

  if (await isInvitedEmail(email)) {
    try {
      const admin = createSupabaseAdminClient() as any;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`
      });
      // An existing account returns an error here; they should sign in instead,
      // and the shared reply already says so.
      if (error && !/already/i.test(error.message)) {
        console.error("[invite] could not send invite link", error.message);
      }
    } catch (error) {
      console.error("[invite] could not send invite link", error);
    }
  }

  return { status: "sent" as const };
}

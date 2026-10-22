import Link from "next/link";
import { cookies } from "next/headers";

import { HavenBrand } from "@/components/app/haven-brand";
import { MixpanelAuthTracker } from "@/components/app/mixpanel-auth-tracker";
import { FirmSharingNote } from "@/components/app/firm-sharing-note";
import { OnboardingFlow } from "./OnboardingFlow";

const HAVEN_HOME_URL = "https://haven-h1b.com/";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistProfileDraft, ONBOARDING_OVERRIDE_COOKIE } from "@/lib/profile-sync";
import { env } from "@/lib/env";
import { noIndexMetadata } from "@/lib/seo";
import { formLimitedTo, recordFirmSharedAnswers } from "@/lib/firms/answers";
import { DEADLINE_KEYS, loadDeadlineAnswers, markDeadlinesPrompted, saveDeadlineAnswers } from "@/lib/deadlines";
import { getClientFirm, markFirmClientCompleted } from "@/lib/firms/intake";

const EMAIL_INGEST_DOMAIN = env.EMAIL_INGEST_DOMAIN ?? "import.haven-h1b.com";

export const metadata = noIndexMetadata;

function buildDraft(data: FormData) {
  return {
    visaType: String(data.get("visaType") ?? ""),
    countryOfBirth: String(data.get("countryOfBirth") ?? ""),
    primaryGoal: String(data.get("primaryGoal") ?? ""),
    employerName: String(data.get("employerName") ?? ""),
    jobTitle: String(data.get("jobTitle") ?? ""),
    h1bStartDate: String(data.get("h1bStartDate") ?? ""),
    employerSize: String(data.get("employerSize") ?? ""),
    greenCardStage: String(data.get("greenCardStage") ?? ""),
    priorityDate: String(data.get("priorityDate") ?? ""),
    preferenceCategory: String(data.get("preferenceCategory") ?? ""),
    i140Approved: String(data.get("i140Approved") ?? "false"),
    spouseVisaStatus: String(data.get("spouseVisaStatus") ?? ""),
    topConcerns: data.getAll("topConcerns").map(String)
  };
}

async function saveStepAction(step: number, data: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  const admin = createSupabaseAdminClient() as any;
  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Haven user");

  // Setup finishes on step 5, "Your deadlines".
  const isExplicitCompletion = step === 5 && data.get("_complete") === "true";

  if (isExplicitCompletion) {
    // Final explicit completion: persist all data and mark complete via email_alias
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
      top_concerns: []
    });
    await persistProfileDraft(user.id, buildDraft(data));
    const draftWithFullName = { ...buildDraft(data), fullName };
    const formWithFullName = {
      has: (key: string) => key === "fullName" || formLimitedTo(data, DEADLINE_KEYS, "except").has(key)
    };
    await recordFirmSharedAnswers(user.id, draftWithFullName, formWithFullName);
    await saveDeadlineAnswers(user.id, data);
    await admin.from("email_aliases").upsert({
      user_id: user.id,
      alias: `${(user.email ?? "user").split("@")[0]}-${user.id.slice(0, 6)}@${EMAIL_INGEST_DOMAIN}`
    });
    await markFirmClientCompleted(user.id);
    await markDeadlinesPrompted(user.id);
    const cookieStore = await cookies();
    cookieStore.delete(ONBOARDING_OVERRIDE_COOKIE);
  } else {
    // Auto-save for any step (including step 4 while still editing)
    await persistProfileDraft(user.id, buildDraft(data));
    const draftWithFullName = { ...buildDraft(data), fullName };
    const formWithFullName = {
      has: (key: string) => key === "fullName" || formLimitedTo(data, DEADLINE_KEYS, "except").has(key)
    };
    await recordFirmSharedAnswers(user.id, draftWithFullName, formWithFullName);
    await saveDeadlineAnswers(user.id, data);
  }
}

export default async function OnboardingPage({
  searchParams
}: {
  searchParams?: Promise<{ step?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const userEmail = user?.email ?? "";

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedStep = Number(resolvedSearchParams?.step ?? "");
  const initialStep = Number.isFinite(requestedStep) && requestedStep >= 1 && requestedStep <= 5 ? requestedStep : 1;
  const firm = await getClientFirm(user?.id);
  const savedDeadlines = user ? await loadDeadlineAnswers(user.id) : {};

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between gap-4 py-4">
          <Link href={HAVEN_HOME_URL} prefetch={false}>
            <HavenBrand />
          </Link>
          <p className="text-body-sm hidden md:block">Step by step. Value at every step.</p>
        </div>
      </header>
      {userId ? <MixpanelAuthTracker userId={userId} email={userEmail} /> : null}
      {firm ? (
        <div className="content-container-wide pt-5">
          <FirmSharingNote firmName={firm.firmName} />
        </div>
      ) : null}
      <OnboardingFlow initialDeadlines={savedDeadlines} initialStep={initialStep} saveStepAction={saveStepAction} userEmail={userEmail} />
    </div>
  );
}

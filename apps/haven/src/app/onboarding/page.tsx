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
import { getDefaultIntakeQuestions, getFirmIntakeQuestions, isCustomQuestionKey } from "@/lib/firms/intake-questions";
import { getFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { DEADLINE_KEYS, loadDeadlineAnswers, markDeadlinesPrompted, saveDeadlineAnswers } from "@/lib/deadlines";
import { getClientFirms, markFirmClientCompleted } from "@/lib/firms/intake";
import type { IntakeQuestionItem, RequiredDocumentItem } from "@/lib/firms/types";

const EMAIL_INGEST_DOMAIN = env.EMAIL_INGEST_DOMAIN ?? "import.haven-h1b.com";

export const metadata = noIndexMetadata;

function buildDraft(data: FormData) {
  const customAnswers: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (isCustomQuestionKey(key) && typeof value === "string") {
      customAnswers[key] = value;
    }
  }
  return {
    ...customAnswers,
    visaType: String(data.get("visaType") ?? ""),
    countryOfBirth: String(data.get("countryOfBirth") ?? ""),
    primaryGoal: String(data.get("primaryGoal") ?? ""),
    employerName: String(data.get("employerName") ?? ""),
    jobTitle: String(data.get("jobTitle") ?? ""),
    h1bStartDate: String(data.get("h1bStartDate") ?? ""),
    employerSize: String(data.get("employerSize") ?? ""),
    greenCardStage: String(data.get("greenCardStage") ?? ""),
    ...(data.has("greenCardSponsor") ? { greenCardSponsor: String(data.get("greenCardSponsor") ?? "").trim() } : {}),
    ...(data.has("retainedPriorityDateSponsor") ? { retainedPriorityDateSponsor: String(data.get("retainedPriorityDateSponsor") ?? "").trim() } : {}),
    priorityDate: String(data.get("priorityDate") ?? ""),
    preferenceCategory: String(data.get("preferenceCategory") ?? ""),
    i140Approved: String(data.get("i140Approved") ?? "false"),
    spouseVisaStatus: String(data.get("spouseVisaStatus") ?? ""),
    topConcerns: data.getAll("topConcerns").map(String)
  };
}

async function saveStepAction(_step: number, data: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  const admin = createSupabaseAdminClient() as any;
  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Haven user");

  // Setup finishes when the client submits the final active step.
  const isExplicitCompletion = data.get("_complete") === "true";

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
    const firmSaved = await recordFirmSharedAnswers(user.id, draftWithFullName, formWithFullName);
    if (!firmSaved) {
      throw new Error("Could not update firm records");
    }
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
  const initialStep = Number.isFinite(requestedStep) && requestedStep >= 1 && requestedStep <= 6 ? requestedStep : 1;
  const clientFirms = await getClientFirms(user?.id);
  const firmNames = clientFirms.map((f) => f.firmName);

  const unionedRequiredDocs: RequiredDocumentItem[] = [];
  const unionedDocKeys = new Set<string>();
  const unionedQuestions: IntakeQuestionItem[] = [];
  const unionedQuestionKeys = new Set<string>();
  let requirementsFailed = false;

  for (const f of clientFirms) {
    try {
      const [q, d] = await Promise.all([
        getFirmIntakeQuestions(f.firmId),
        getFirmRequiredDocuments(f.firmId)
      ]);
      for (const item of d) {
        if (!unionedDocKeys.has(item.key)) {
          unionedDocKeys.add(item.key);
          unionedRequiredDocs.push(item);
        }
      }
      for (const item of q) {
        if (!unionedQuestionKeys.has(item.key)) {
          unionedQuestionKeys.add(item.key);
          unionedQuestions.push(item);
        }
      }
    } catch (err) {
      console.error("[onboarding] failed loading firm requirements:", err);
      requirementsFailed = true;
    }
  }

  if (requirementsFailed) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16 flex flex-col items-center justify-center text-center">
        <h1 className="text-xl font-semibold text-rose-300">Unable to load intake requirements</h1>
        <p className="mt-2 text-sm text-slate-400">
          We encountered an issue loading requirements for your connected legal firms. Please reload to try again.
        </p>
      </div>
    );
  }

  const effectiveQuestions = unionedQuestions.length > 0 ? unionedQuestions : getDefaultIntakeQuestions();
  const effectiveDocs = unionedRequiredDocs;

  const [savedDeadlines, uploadedDocsResult] = await Promise.all([
    user ? loadDeadlineAnswers(user.id) : Promise.resolve({}),
    user && clientFirms.length > 0
      ? (createSupabaseAdminClient() as any)
          .from("user_documents")
          .select("id, original_name, display_label, document_kind")
          .eq("user_id", user.id)
          .order("uploaded_at", { ascending: false })
      : Promise.resolve({ data: [] })
  ]);

  const initialUploadedDocuments = ((uploadedDocsResult?.data ?? []) as any[]).map((doc) => ({
    id: String(doc.id),
    originalName: String(doc.original_name ?? ""),
    displayLabel: String(doc.display_label ?? doc.document_kind ?? ""),
    documentKind: String(doc.document_kind ?? "")
  }));

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
      {firmNames.length > 0 ? (
        <div className="content-container-wide pt-5">
          <FirmSharingNote firmNames={firmNames} />
        </div>
      ) : null}
      <OnboardingFlow
        firmName={firmNames.length > 0 ? firmNames.join(", ") : undefined}
        initialDeadlines={savedDeadlines}
        initialStep={initialStep}
        initialUploadedDocuments={initialUploadedDocuments}
        intakeQuestions={effectiveQuestions}
        requiredDocuments={effectiveDocs}
        saveStepAction={saveStepAction}
        userEmail={userEmail}
      />
    </div>
  );
}

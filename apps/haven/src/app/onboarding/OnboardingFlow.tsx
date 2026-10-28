"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, CircleAlert, Clock, FileText, Heart, ShieldCheck, TrendingUp, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { trackEvent } from "@/lib/mixpanel";
import { cn } from "@/lib/utils";
import { SIGNED_IN_HOME } from "@/lib/archived-routes";
import { DeadlineFields } from "@/components/app/deadline-fields";
import { DocumentContextUploader } from "@/components/app/document-context-uploader";
import { findPresetDocument } from "@/lib/document-vault";
import { getDefaultIntakeQuestions } from "@/lib/firms/intake-question-catalog";
import type { IntakeQuestionItem, RequiredDocumentItem } from "@/lib/firms/types";

export type UploadedIntakeDocument = {
  id: string;
  originalName: string;
  displayLabel: string;
  documentKind: string;
};

interface OnboardingData {
  [key: string]: string | string[] | undefined;
  visaType: string;
  countryOfBirth: string;
  primaryGoal: string;
  employerName: string;
  jobTitle: string;
  h1bStartDate: string;
  employerSize: string;
  greenCardStage: string;
  greenCardSponsor?: string;
  retainedPriorityDateSponsor?: string;
  priorityDate: string;
  preferenceCategory: string;
  i140Approved: string; // derived from greenCardStage, not shown as a field
  spouseVisaStatus: string;
  topConcerns: string[];
  // Step 5, "Your deadlines" (all optional)
  statusEndDate: string;
  statusEndUnknown: string;
  jobEnded: string;
  lastWorkDay: string;
  agencyDeadlineType: string;
  agencyDeadlineDate: string;
  travelPlanned: string;
  travelDate: string;
}

const steps = [
  {
    id: 1,
    label: "Your profile",
    short: "Profile",
    icon: User,
    headline: "Let's start with where you are right now.",
    description: "These answers place you in the right timeline and community from the start."
  },
  {
    id: 2,
    label: "Employment",
    short: "Work",
    icon: Briefcase,
    headline: "Work details help Haven map the dates that matter.",
    description: "Employer context changes renewal timing, portability options, and layoff readiness."
  },
  {
    id: 3,
    label: "Green card journey",
    short: "GC",
    icon: TrendingUp,
    headline: "This is where specificity builds trust.",
    description: "Priority date and preference category shape the shape of your wait."
  },
  {
    id: 4,
    label: "Your situation",
    short: "Context",
    icon: Heart,
    headline: "One more step so Haven can personalize what feels urgent.",
    description: "This is what powers your layoff plan, your matched cohort, and your next-action queue."
  },
  {
    id: 5,
    label: "Your deadlines",
    short: "Dates",
    icon: Clock,
    headline: "The dates that matter.",
    description: "All optional. These help your lawyer see what's urgent. Skip anything you're not sure about."
  },
  {
    id: 6,
    label: "Your documents",
    short: "Docs",
    icon: FileText,
    headline: "Upload requested documents.",
    description: "Upload what you have handy now for your lawyer to review, or finish uploading later in your Document Vault."
  }
];

const valueInsights: Record<number, string[]> = {
  1: [
    "We route you to the right experience based on your visa path.",
    "Country of birth determines which per-country queue applies to you.",
    "Your first dashboard view should feel personal, not generic."
  ],
  2: [
    "H-1B start date lets Haven compute cap and renewal timing.",
    "Employer size affects fallback options and portability planning.",
    "A few work details unlock more useful scenario planning right away."
  ],
  3: [
    "Priority date plus category sets the shape of your wait.",
    "Your green card stage tells Haven what decisions are actually in front of you.",
    "Haven shows ranges when reality is uncertain, not fake precision."
  ],
  4: [
    "Spouse status may create additional paths in a hard moment.",
    "Your concerns help rank what Haven surfaces first.",
    "Community matching works better when it knows what you are navigating."
  ],
  5: [
    "A date that's coming up is often the most important thing in a case.",
    "Your lawyer sees these dates, so they can spot what needs attention first.",
    "Not sure of a date? Leave it blank. You can add it later."
  ],
  6: [
    "Uploading key notices and records helps your lawyer review your case faster.",
    "Your documents also power cited answers when you ask questions in Haven Advisor.",
    "Don't have a file right now? You can complete setup and upload it anytime in Documents."
  ]
};

function computeH1BInfo(h1bStartDate: string): { capDate: string; label: string; urgent: boolean } | null {
  if (!h1bStartDate) return null;
  const start = new Date(h1bStartDate);
  if (isNaN(start.getTime())) return null;
  const cap = new Date(start);
  cap.setFullYear(cap.getFullYear() + 6);
  const now = new Date();
  const msLeft = cap.getTime() - now.getTime();
  const daysLeft = Math.round(msLeft / (1000 * 60 * 60 * 24));
  const capDate = cap.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (daysLeft <= 0) {
    return { capDate, label: "Cap reached — check AC-21 portability or I-140 extension", urgent: true };
  }
  if (daysLeft <= 180) {
    const months = Math.round(daysLeft / 30);
    return { capDate, label: `~${months} month${months === 1 ? "" : "s"} remaining — renewal window is now`, urgent: true };
  }
  if (daysLeft <= 365) {
    const months = Math.round(daysLeft / 30);
    return { capDate, label: `~${months} months remaining — start renewal planning`, urgent: false };
  }
  const years = (daysLeft / 365).toFixed(1);
  return { capDate, label: `~${years} years remaining`, urgent: false };
}

// Country wait time data (approximate, based on March 2025 Visa Bulletin trends)
const COUNTRY_OVERVIEW: Record<string, { headline: string; detail: string }> = {
  India: {
    headline: "Extreme backlog — 60+ years for EB-2/EB-3",
    detail: "Priority dates from 2012 are being processed today. EB-1 has a 4–6 year wait. This affects nearly every planning decision."
  },
  China: {
    headline: "Significant backlog — 6–9 years",
    detail: "EB-2 and EB-3 waits are 6–9 years. EB-1 is 3–5 years. Category choice matters a lot."
  },
  Mexico: {
    headline: "Varies by category — 2–10 years",
    detail: "EB-2 is 2–4 years and manageable. EB-3 is 8–10 years. EB-1 is near-current."
  },
  Philippines: {
    headline: "Long EB-3 backlog — 10–12 years",
    detail: "EB-3 is 10–12 years. EB-2 is 3–5 years. EB-1 is near-current."
  },
  "South Korea": {
    headline: "Near-current — 1–3 years",
    detail: "South Korea is not oversubscribed. Most categories are current or close to it."
  },
  Brazil: {
    headline: "Near-current — 1–3 years",
    detail: "Brazil is not oversubscribed. Most categories are current or 1–3 years out."
  },
  Canada: {
    headline: "Near-current — 1–2 years",
    detail: "Canada is not oversubscribed. Most categories are current or near-current."
  },
  "United Kingdom": {
    headline: "Near-current — 1–2 years",
    detail: "UK is not oversubscribed. Most categories are current or near-current."
  },
  Other: {
    headline: "Generally near-current — 1–3 years",
    detail: "Most countries outside India, China, Mexico, and Philippines are not oversubscribed."
  }
};

// Approximate total backlog years by country + category (used for priority date estimate)
const BACKLOG_YEARS: Record<string, Record<string, number>> = {
  India:       { "EB-1": 5,  "EB-2": 65, "EB-3": 65, "EB-2 NIW": 65, "Not sure": 65 },
  China:       { "EB-1": 4,  "EB-2": 7,  "EB-3": 8,  "EB-2 NIW": 7,  "Not sure": 8  },
  Mexico:      { "EB-1": 1,  "EB-2": 3,  "EB-3": 9,  "EB-2 NIW": 3,  "Not sure": 6  },
  Philippines: { "EB-1": 1,  "EB-2": 4,  "EB-3": 11, "EB-2 NIW": 4,  "Not sure": 7  },
};
const DEFAULT_BACKLOG: Record<string, number> = {
  "EB-1": 1, "EB-2": 2, "EB-3": 3, "EB-2 NIW": 2, "Not sure": 2
};

function estimateRemainingWait(priorityDate: string, country: string, category: string): string | null {
  if (!priorityDate || !country || !category) return null;
  const pd = new Date(priorityDate);
  if (isNaN(pd.getTime())) return null;
  const now = new Date();
  const yearsWaited = (now.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const countryBacklog = BACKLOG_YEARS[country] ?? DEFAULT_BACKLOG;
  const totalBacklog = countryBacklog[category] ?? countryBacklog["Not sure"] ?? 2;
  const remaining = Math.max(0, totalBacklog - yearsWaited);
  if (totalBacklog >= 60) return `~${Math.round(remaining)}+ years remaining`;
  if (remaining < 0.5) return "Approaching current — may be eligible soon";
  if (remaining < 2) return `~${Math.round(remaining * 12)} months remaining`;
  return `~${Math.round(remaining)} years remaining`;
}

const ONBOARDING_STORAGE_KEY = "haven-onboarding-progress";
const ONBOARDING_OVERRIDE_COOKIE = "haven_onboarding_override";
const ONBOARDING_STARTED_PREFIX = "haven-mixpanel-onboarding-started";
const EMPTY_REQUIRED_DOCUMENTS: RequiredDocumentItem[] = [];
const EMPTY_UPLOADED_DOCUMENTS: UploadedIntakeDocument[] = [];

export function OnboardingFlow({
  saveStepAction,
  initialStep,
  initialDeadlines = {},
  userEmail,
  firmName,
  intakeQuestions,
  requiredDocuments = EMPTY_REQUIRED_DOCUMENTS,
  initialUploadedDocuments = EMPTY_UPLOADED_DOCUMENTS
}: {
  saveStepAction: (step: number, data: FormData) => Promise<void>;
  initialStep: number;
  /** Deadline answers already saved on the account, so another device shows them too. */
  initialDeadlines?: Partial<Record<string, string>>;
  userEmail: string;
  firmName?: string;
  intakeQuestions?: IntakeQuestionItem[];
  requiredDocuments?: RequiredDocumentItem[];
  initialUploadedDocuments?: UploadedIntakeDocument[];
}) {
  const router = useRouter();
  const resolvedQuestions = useMemo(
    () => (intakeQuestions && intakeQuestions.length > 0 ? intakeQuestions : getDefaultIntakeQuestions()),
    [intakeQuestions]
  );
  const enabledKeys = useMemo(() => new Set(resolvedQuestions.map((q) => q.key)), [resolvedQuestions]);
  const customQuestions = useMemo(() => resolvedQuestions.filter((q) => q.isCustom), [resolvedQuestions]);

  const activeSteps = useMemo(() => {
    const filtered = steps.filter((s) => {
      if (s.id === 1) return ["visaType", "countryOfBirth", "primaryGoal"].some((k) => enabledKeys.has(k));
      if (s.id === 2) return ["employerName", "jobTitle", "h1bStartDate", "employerSize"].some((k) => enabledKeys.has(k));
      if (s.id === 3) return ["greenCardStage", "preferenceCategory", "priorityDate"].some((k) => enabledKeys.has(k));
      if (s.id === 4) return ["spouseVisaStatus", "topConcerns"].some((k) => enabledKeys.has(k)) || customQuestions.length > 0;
      if (s.id === 5) return ["statusEndDate", "jobEnded", "agencyDeadlineType", "travelPlanned"].some((k) => enabledKeys.has(k));
      if (s.id === 6) return requiredDocuments.length > 0;
      return true;
    });
    return filtered.length > 0 ? filtered : [steps[0]];
  }, [enabledKeys, customQuestions.length, requiredDocuments.length]);

  const [currentStep, setCurrentStep] = useState<number>(() => {
    const match = activeSteps.find((s) => s.id === initialStep);
    return match ? match.id : activeSteps[0].id;
  });
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedIntakeDocument[]>(initialUploadedDocuments);
  const [isSaving, startSavingTransition] = useTransition();
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({ topConcerns: [], ...initialDeadlines });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStepActionRef = useRef(saveStepAction);
  const currentStepRef = useRef(currentStep);
  const formDataRef = useRef(formData);
  const activeStepsRef = useRef(activeSteps);

  useEffect(() => {
    setUploadedDocuments(initialUploadedDocuments);
  }, [initialUploadedDocuments]);

  useEffect(() => { saveStepActionRef.current = saveStepAction; }, [saveStepAction]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { activeStepsRef.current = activeSteps; }, [activeSteps]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { currentStep?: number; formData?: Partial<OnboardingData>; userEmail?: string };
      // Clear stale data if it belongs to a different account
      if (parsed.userEmail && userEmail && parsed.userEmail !== userEmail) {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        return;
      }
      if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
      if (typeof parsed.currentStep === "number" && activeStepsRef.current.some((s) => s.id === parsed.currentStep)) {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  }, [userEmail]);

  useEffect(() => {
    const match = activeStepsRef.current.find((s) => s.id === initialStep);
    setCurrentStep(match ? match.id : activeStepsRef.current[0].id);
  }, [initialStep]);

  useEffect(() => {
    setCurrentStep((prev) => (activeSteps.some((s) => s.id === prev) ? prev : activeSteps[0].id));
  }, [activeSteps]);

  useEffect(() => {
    setShowFieldErrors(false);
  }, [currentStep]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ currentStep, formData, userEmail }));
    document.cookie = `${ONBOARDING_OVERRIDE_COOKIE}=${encodeURIComponent(JSON.stringify(formData))}; path=/; max-age=86400; samesite=lax`;
  }, [currentStep, formData]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = `${ONBOARDING_STARTED_PREFIX}:${userEmail || "anonymous"}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    trackEvent("Onboarding Started", { initial_step: initialStep });
    window.sessionStorage.setItem(storageKey, "1");
  }, [initialStep, userEmail]);

  const updateField = (key: string, value: string) => {
    setHasInteracted(true);
    setFormData((prev) => {
      const next: Partial<OnboardingData> = { ...prev, [key]: value };
      if (key === "greenCardStage") {
        next.i140Approved = (value === "i140_approved" || value === "i485_filed") ? "true" : "false";
      }
      return next;
    });
  };

  const toggleConcern = (concern: string) => {
    setHasInteracted(true);
    setFormData((prev) => {
      const current = prev.topConcerns ?? [];
      const next = current.includes(concern) ? current.filter((c) => c !== concern) : [...current, concern];
      return { ...prev, topConcerns: next };
    });
  };

  // Debounced auto-save — fires 1.5s after last field change
  useEffect(() => {
    if (!hasInteracted) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const data = new FormData();
      Object.entries(formDataRef.current).forEach(([key, value]) => {
        if (Array.isArray(value)) (value as string[]).forEach((v) => data.append(key, v));
        else if (value !== undefined) data.append(key, value as string);
      });
      try {
        await saveStepActionRef.current(currentStepRef.current, data);
      } catch {
        // silently fail — data is still in localStorage
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [formData, hasInteracted]);

  const missingFields = useMemo(() => {
    const requiredByStep: Record<number, { key: string; label: string }[]> = {
      1: [
        { key: "visaType", label: "Current visa status" },
        { key: "countryOfBirth", label: "Country of birth" },
        { key: "primaryGoal", label: "Primary goal" }
      ],
      2: [
        { key: "employerName", label: "Employer name" },
        { key: "jobTitle", label: "Job title" },
        { key: "h1bStartDate", label: "H-1B start date" },
        { key: "employerSize", label: "Employer size" }
      ],
      3: [
        { key: "greenCardStage", label: "Green card stage" },
        { key: "preferenceCategory", label: "Preference category" }
      ],
      4: [{ key: "spouseVisaStatus", label: "Spouse or partner status" }]
    };
    return (requiredByStep[currentStep] ?? []).filter(({ key }) => {
      if (!enabledKeys.has(key)) return false;
      const value = formData[key];
      return !value || String(value).trim().length === 0;
    });
  }, [currentStep, formData, enabledKeys]);

  const buildFormData = () => {
    const data = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => data.append(key, item));
        return;
      }
      if (value !== undefined) data.append(key, value);
    });
    return data;
  };

  const persistStep = (step: number, onComplete?: () => void) => {
    const data = buildFormData();
    startSavingTransition(async () => {
      try {
        await saveStepAction(step, data);
      } catch {
        // Keep the flow usable even if persistence lags for intermediate steps.
      } finally {
        onComplete?.();
      }
    });
  };

  const activeStepIndex = Math.max(0, activeSteps.findIndex((s) => s.id === currentStep));
  const step = activeSteps[activeStepIndex] ?? activeSteps[0];
  const StepIcon = step.icon;

  const handleNext = () => {
    if (isSaving || activeStepIndex >= activeSteps.length - 1) return;
    if (missingFields.length > 0) {
      setShowFieldErrors(true);
      return;
    }
    setSaveFeedback("Saving...");
    persistStep(currentStep, () => {
      setSaveFeedback(null);
      const nextStep = activeSteps[Math.min(activeStepIndex + 1, activeSteps.length - 1)];
      if (nextStep) setCurrentStep(nextStep.id);
    });
  };

  const handlePrev = () => {
    const prevStep = activeSteps[Math.max(activeStepIndex - 1, 0)];
    if (prevStep) setCurrentStep(prevStep.id);
  };

  const handleFinish = () => {
    if (isSaving) return;
    if (missingFields.length > 0) {
      setShowFieldErrors(true);
      return;
    }
    setSaveFeedback("Saving your profile...");
    const data = buildFormData();
    data.append("_complete", "true"); // signals explicit completion, not auto-save
    startSavingTransition(async () => {
      try {
        await saveStepAction(currentStep, data);
        trackEvent("Onboarding Completed", {
          concern_count: formData.topConcerns?.length ?? 0
        });
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(`${ONBOARDING_STARTED_PREFIX}:${userEmail || "anonymous"}`);
        }
        if (typeof window !== "undefined") window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        router.push(SIGNED_IN_HOME);
      } catch {
        setSaveFeedback("Something went wrong. Please try again.");
      }
    });
  };

  const errorFields: Set<string> = showFieldErrors
    ? new Set(missingFields.map((f) => f.key))
    : new Set();

  // Dynamic sidebar panels
  const countryOverview = formData.countryOfBirth ? COUNTRY_OVERVIEW[formData.countryOfBirth] : null;
  const h1bInfo = formData.h1bStartDate ? computeH1BInfo(formData.h1bStartDate) : null;
  const gcEstimate =
    formData.greenCardStage && formData.preferenceCategory
      ? estimateRemainingWait(
          formData.priorityDate ?? "",
          formData.countryOfBirth ?? "",
          formData.preferenceCategory
        )
      : null;

  return (
    <main className="content-container-wide py-10 md:py-14">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 md:p-8">
          <div className="flex flex-col gap-5 border-b border-[var(--color-border)] pb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-label">Step {activeStepIndex + 1} of {activeSteps.length}</p>
                <h1 className="text-h1 mt-3 max-w-[20ch]">{step.headline}</h1>
                <p className="text-body mt-3 max-w-[60ch]">{step.description}</p>
              </div>
              <div className="hidden rounded-[var(--radius-xl)] bg-[var(--haven-sage-light)] p-3 text-[var(--haven-ink)] md:block">
                <StepIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeSteps.map((item, idx) => {
                const isActive = item.id === step.id;
                const isDone = idx < activeStepIndex;
                return (
                  <button
                    key={item.id}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-full border px-4 py-2 text-sm transition-colors",
                      isActive
                        ? "border-[var(--haven-sage)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                        : isDone
                          ? "border-[var(--haven-sage-mid)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)]"
                          : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--color-text-tertiary)]"
                    )}
                    onClick={() => setCurrentStep(item.id)}
                    type="button"
                  >
                    <span className={cn("step-dot", isActive ? "active" : isDone ? "done" : "")} />
                    {item.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {step.id === 1 && <Step1Form data={formData} enabledKeys={enabledKeys} errors={errorFields} onChange={updateField} />}
            {step.id === 2 && <Step2Form data={formData} enabledKeys={enabledKeys} errors={errorFields} onChange={updateField} />}
            {step.id === 3 && <Step3Form data={formData} enabledKeys={enabledKeys} errors={errorFields} onChange={updateField} />}
            {step.id === 4 && (
              <Step4Form
                customQuestions={customQuestions}
                data={formData}
                enabledKeys={enabledKeys}
                errors={errorFields}
                onChange={updateField}
                onToggleConcern={toggleConcern}
              />
            )}
            {step.id === 5 && (
              <DeadlineFields
                enabledKeys={enabledKeys}
                onChange={(key, value) => updateField(key, value)}
                values={formData}
              />
            )}
            {step.id === 6 && (
              <Step6Documents
                firmName={firmName}
                onDocumentUploaded={(doc) =>
                  setUploadedDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)])
                }
                requiredDocuments={requiredDocuments}
                uploadedDocuments={uploadedDocuments}
              />
            )}
          </div>

          <div className="mt-6 min-h-6">
            {showFieldErrors && missingFields.length > 0 && (
              <p className="text-body-sm text-[#7a3030]">
                Please fill in the required fields above to continue.
              </p>
            )}
            {saveFeedback && <p className="text-body-sm">{saveFeedback}</p>}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2.5 text-sm",
                activeStepIndex === 0
                  ? "pointer-events-none border-transparent text-transparent"
                  : "border-[var(--haven-ink)] bg-transparent text-[var(--haven-ink)]"
              )}
              onClick={handlePrev}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {activeStepIndex < activeSteps.length - 1 ? (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--haven-ink)] bg-[var(--haven-ink)] px-6 py-2.5 text-sm text-[var(--haven-cream)]"
                disabled={isSaving}
                onClick={handleNext}
                type="button"
              >
                {isSaving ? "Saving..." : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--haven-sage)] bg-[var(--haven-sage)] px-6 py-2.5 text-sm text-white"
                disabled={isSaving}
                onClick={handleFinish}
                type="button"
              >
                {isSaving ? "Saving..." : "Complete setup"}
                <ShieldCheck className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          {/* Why we ask */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <p className="text-label">Why we ask this</p>
            <div className="mt-4 space-y-3">
              {(valueInsights[step.id] ?? valueInsights[1]).map((item) => (
                <p key={item} className="text-body-sm">{item}</p>
              ))}
            </div>
          </div>

          {/* Country wait time — shown on step 1 when country is selected */}
          {step.id === 1 && countryOverview && (
            <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--haven-ink)]" />
                <p className="text-label">Current GC wait for {formData.countryOfBirth}</p>
              </div>
              <p className="text-h3 mt-3">{countryOverview.headline}</p>
              <p className="text-body-sm mt-2">{countryOverview.detail}</p>
              <p className="text-caption mt-3 text-[var(--color-text-tertiary)]">Based on March 2025 Visa Bulletin trends. Ranges are approximate.</p>
            </div>
          )}

          {/* H1B cap info — shown on step 2 when h1bStartDate is set */}
          {step.id === 2 && h1bInfo && (
            <div className={`rounded-[var(--radius-xl)] border p-5 ${h1bInfo.urgent ? "border-[#e8b4b4] bg-[#fdf0f0]" : "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]"}`}>
              <div className="flex items-center gap-2">
                <Clock className={`h-4 w-4 ${h1bInfo.urgent ? "text-[#7a3030]" : "text-[var(--haven-ink)]"}`} />
                <p className="text-label">H-1B cap date</p>
              </div>
              <p className={`text-h3 mt-3 ${h1bInfo.urgent ? "text-[#7a3030]" : ""}`}>{h1bInfo.capDate}</p>
              <p className={`text-body-sm mt-2 ${h1bInfo.urgent ? "text-[#7a3030]" : ""}`}>{h1bInfo.label}</p>
              {h1bInfo.urgent && h1bInfo.label.includes("Cap reached") && (
                <p className="text-caption mt-3">If you have an approved I-140, you may qualify for AC-21 portability or a 3-year extension. Talk to your attorney.</p>
              )}
            </div>
          )}

          {/* GC estimate — shown on step 3 when stage + category are set */}
          {step.id === 3 && formData.greenCardStage && formData.preferenceCategory && (
            <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--haven-ink)]" />
                <p className="text-label">Your estimated wait</p>
              </div>
              {formData.countryOfBirth && formData.preferenceCategory ? (
                <>
                  <p className="text-h3 mt-3">
                    {(() => {
                      const country = formData.countryOfBirth ?? "";
                      const cat = formData.preferenceCategory ?? "";
                      const countryBacklog = BACKLOG_YEARS[country] ?? DEFAULT_BACKLOG;
                      const years = countryBacklog[cat] ?? countryBacklog["Not sure"] ?? 2;
                      if (years >= 60) return "60+ years total backlog";
                      return `~${years} year${years === 1 ? "" : "s"} total backlog`;
                    })()}
                  </p>
                  <p className="text-body-sm mt-2">
                    {formData.countryOfBirth} · {formData.preferenceCategory}
                  </p>
                  {gcEstimate && formData.priorityDate && (
                    <div className="mt-3 border-t border-[var(--haven-sage-mid)] pt-3">
                      <p className="text-label">Based on your priority date</p>
                      <p className="text-h3 mt-1">{gcEstimate}</p>
                    </div>
                  )}
                  {!formData.priorityDate && (
                    <p className="text-body-sm mt-3 text-[var(--color-text-tertiary)]">Add your priority date below to see how much of the wait you have left.</p>
                  )}
                </>
              ) : (
                <p className="text-body-sm mt-3 text-[var(--color-text-tertiary)]">Select your country of birth in step 1 and preference category above to see your estimate.</p>
              )}
              <p className="text-caption mt-3 text-[var(--color-text-tertiary)]">Ranges are approximate. Actual wait depends on annual Visa Bulletin movement.</p>
            </div>
          )}

          {/* Progress */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
            <p className="text-label">Your progress</p>
            <div className="mt-4 space-y-3">
              {activeSteps.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className={cn("step-dot", item.id === step.id ? "active" : idx < activeStepIndex ? "done" : "")} />
                  <span className={cn("text-body-sm", idx <= activeStepIndex ? "text-[var(--haven-ink)]" : "")}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-5">
            <p className="text-label">Privacy note</p>
            <p className="text-body-sm mt-3">
              Your immigration data is private and used only to generate your personalized timeline, recommendations, and community matching.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Required() {
  return <span className="ml-0.5 text-[var(--haven-sage)]" aria-label="required">*</span>;
}

function Step1Form({
  data,
  enabledKeys,
  errors,
  onChange
}: {
  data: Partial<OnboardingData>;
  enabledKeys: Set<string>;
  errors: Set<string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {enabledKeys.has("visaType") && (
        <Field error={errors.has("visaType")}>
          <label className="field-label">Current visa status <Required /></label>
          <Select onChange={(e) => onChange("visaType", e.target.value)} value={data.visaType ?? ""}>
            <option value="" disabled>Please select</option>
            {["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </Field>
      )}
      {enabledKeys.has("countryOfBirth") && (
        <Field error={errors.has("countryOfBirth")}>
          <label className="field-label">Country of birth <Required /></label>
          <Select onChange={(e) => onChange("countryOfBirth", e.target.value)} value={data.countryOfBirth ?? ""}>
            <option value="" disabled>Please select</option>
            {["India", "China", "Mexico", "Philippines", "South Korea", "Brazil", "Canada", "United Kingdom", "Other"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
          <p className="field-helper">Country of birth determines your green card queue.</p>
        </Field>
      )}
      {enabledKeys.has("primaryGoal") && (
        <Field error={errors.has("primaryGoal")}>
          <label className="field-label">Primary goal <Required /></label>
          <Select onChange={(e) => onChange("primaryGoal", e.target.value)} value={data.primaryGoal ?? ""}>
            <option value="" disabled>Please select</option>
            <option value="get_gc">Get my green card</option>
            <option value="job_stability">Stay stable at my current employer</option>
            <option value="explore_options">Explore all my options</option>
            <option value="stay_flexible">Maximize flexibility</option>
            <option value="not_sure">Not sure yet</option>
          </Select>
        </Field>
      )}
    </>
  );
}

function Step2Form({
  data,
  enabledKeys,
  errors,
  onChange
}: {
  data: Partial<OnboardingData>;
  enabledKeys: Set<string>;
  errors: Set<string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {enabledKeys.has("employerName") && (
        <Field error={errors.has("employerName")}>
          <label className="field-label">Employer name <Required /></label>
          <Input onChange={(e) => onChange("employerName", e.target.value)} placeholder="e.g. Nimbus AI" value={data.employerName ?? ""} />
        </Field>
      )}
      {enabledKeys.has("jobTitle") && (
        <Field error={errors.has("jobTitle")}>
          <label className="field-label">Job title <Required /></label>
          <Input onChange={(e) => onChange("jobTitle", e.target.value)} placeholder="e.g. Senior Software Engineer" value={data.jobTitle ?? ""} />
        </Field>
      )}
      {enabledKeys.has("h1bStartDate") && (
        <Field error={errors.has("h1bStartDate")}>
          <label className="field-label">H-1B start date <Required /></label>
          <Input onChange={(e) => onChange("h1bStartDate", e.target.value)} type="date" value={data.h1bStartDate ?? ""} />
          <p className="field-helper">Used to compute your six-year cap date and renewal window.</p>
        </Field>
      )}
      {enabledKeys.has("employerSize") && (
        <Field error={errors.has("employerSize")}>
          <label className="field-label">Employer size <Required /></label>
          <Select onChange={(e) => onChange("employerSize", e.target.value)} value={data.employerSize ?? ""}>
            <option value="" disabled>Please select</option>
            <option value="startup">Startup (under 200)</option>
            <option value="mid-size">Mid-size (200–2,000)</option>
            <option value="enterprise">Enterprise (2,000+)</option>
          </Select>
        </Field>
      )}
    </>
  );
}

function Step3Form({
  data,
  enabledKeys,
  errors,
  onChange
}: {
  data: Partial<OnboardingData>;
  enabledKeys: Set<string>;
  errors: Set<string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {enabledKeys.has("greenCardStage") && (
        <Field error={errors.has("greenCardStage")}>
          <label className="field-label">Green card stage <Required /></label>
          <Select onChange={(e) => onChange("greenCardStage", e.target.value)} value={data.greenCardStage ?? ""}>
            <option value="" disabled>Please select</option>
            <option value="not_started">Not started yet</option>
            <option value="perm_in_progress">PERM in progress</option>
            <option value="perm_certified">PERM certified</option>
            <option value="i140_filed">I-140 filed</option>
            <option value="i140_approved">I-140 approved</option>
            <option value="i485_filed">I-485 filed</option>
          </Select>
          <p className="field-helper">I-140 approval status is inferred from your stage.</p>
        </Field>
      )}
      {enabledKeys.has("preferenceCategory") && (
        <Field error={errors.has("preferenceCategory")}>
          <label className="field-label">Preference category <Required /></label>
          <Select onChange={(e) => onChange("preferenceCategory", e.target.value)} value={data.preferenceCategory ?? ""}>
            <option value="" disabled>Please select</option>
            {["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </Field>
      )}
      {enabledKeys.has("priorityDate") && (
        <Field>
          <label className="field-label">Priority date <span className="text-[var(--color-text-tertiary)] font-normal">(optional)</span></label>
          <Input onChange={(e) => onChange("priorityDate", e.target.value)} type="date" value={data.priorityDate ?? ""} />
          <p className="field-helper">The date your PERM or I-140 was filed. Leave blank if not yet applicable.</p>
        </Field>
      )}
      {((data.greenCardStage && data.greenCardStage !== "not_started") || Boolean(data.priorityDate)) && (
        <Field>
          <label className="field-label">
            Sponsoring employer or petitioner <span className="text-[var(--color-text-tertiary)] font-normal">(optional)</span>
          </label>
          <Input
            onChange={(e) => {
              onChange("greenCardSponsor", e.target.value);
              onChange("retainedPriorityDateSponsor", e.target.value);
            }}
            placeholder="e.g. Prior Employer, Current Employer, or Self-Petition (NIW)"
            type="text"
            value={data.greenCardSponsor ?? data.retainedPriorityDateSponsor ?? ""}
          />
          <p className="field-helper">
            Never assumed to be your current employer. If this petition was filed by a previous employer or self-petitioned, naming the sponsor clarifies priority date retention and portability.
          </p>
        </Field>
      )}
    </>
  );
}

function Step4Form({
  data,
  enabledKeys,
  customQuestions,
  errors,
  onChange,
  onToggleConcern
}: {
  data: Partial<OnboardingData>;
  enabledKeys: Set<string>;
  customQuestions: IntakeQuestionItem[];
  errors: Set<string>;
  onChange: (key: string, value: string) => void;
  onToggleConcern: (concern: string) => void;
}) {
  const concerns = data.topConcerns ?? [];
  const concernOptions = [
    { value: "layoffs", label: "Layoff risk", description: "I want a plan if my job changes suddenly." },
    { value: "visa_expiry", label: "Visa expiry", description: "I need help keeping dates and renewal timing straight." },
    { value: "gc_timeline", label: "Green card timeline", description: "I want clarity on queues, ranges, and bulletin movement." },
    { value: "job_change", label: "Job change", description: "I'm weighing portability, transfers, or other moves." }
  ];

  return (
    <>
      {enabledKeys.has("spouseVisaStatus") && (
        <Field error={errors.has("spouseVisaStatus")}>
          <label className="field-label">Spouse or partner visa status <Required /></label>
          <Select onChange={(e) => onChange("spouseVisaStatus", e.target.value)} value={data.spouseVisaStatus ?? ""}>
            <option value="" disabled>Please select</option>
            <option value="none">No spouse / not applicable</option>
            <option value="H1B">Spouse on H-1B</option>
            <option value="H4">Spouse on H-4</option>
            <option value="H4 EAD">Spouse on H-4 EAD</option>
            <option value="GC">Spouse is a green card holder</option>
            <option value="citizen">Spouse is a US citizen</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      )}
      {enabledKeys.has("topConcerns") && (
        <div>
          <label className="field-label">What feels most important right now? <span className="text-[var(--color-text-tertiary)] font-normal">(optional)</span></label>
          <div className="grid gap-3">
            {concernOptions.map((option) => {
              const selected = concerns.includes(option.value);
              return (
                <button
                  key={option.value}
                  className={cn(
                    "rounded-[var(--radius-lg)] border p-4 text-left transition-colors",
                    selected
                      ? "border-[var(--haven-sage)] bg-[var(--haven-sage-light)]"
                      : "border-[var(--color-border)] bg-[var(--haven-white)] hover:bg-[var(--haven-cream)]"
                  )}
                  onClick={() => onToggleConcern(option.value)}
                  type="button"
                >
                  <p className="text-h3">{option.label}</p>
                  <p className="text-body-sm mt-2">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {customQuestions.map((q) => (
        <Field key={q.key}>
          <label className="field-label">
            {q.label} <span className="text-[var(--color-text-tertiary)] font-normal">(optional)</span>
          </label>
          <Input
            onChange={(e) => onChange(q.key, e.target.value)}
            placeholder="Your answer"
            value={typeof data[q.key] === "string" ? (data[q.key] as string) : ""}
          />
        </Field>
      ))}
    </>
  );
}

function Step6Documents({
  firmName,
  requiredDocuments,
  uploadedDocuments,
  onDocumentUploaded
}: {
  firmName?: string;
  requiredDocuments: RequiredDocumentItem[];
  uploadedDocuments: UploadedIntakeDocument[];
  onDocumentUploaded: (doc: UploadedIntakeDocument) => void;
}) {
  const checklist = requiredDocuments.map((req) => {
    const matching = uploadedDocuments.filter((d) => d.documentKind === req.key);
    const preset = findPresetDocument(req.key);
    return {
      key: req.key,
      label: req.label,
      detail: preset?.detail,
      isUploaded: matching.length > 0,
      documents: matching
    };
  });
  const fulfilledCount = checklist.filter((item) => item.isUploaded).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-cream)] px-4 py-3">
        <p className="text-body-sm text-[var(--haven-ink)]">
          Requested by <strong>{firmName || "your law firm"}</strong>. You can upload files now or finish later in your Document Vault.
        </p>
        <span className="rounded-full bg-[var(--haven-white)] px-3 py-1 text-body-sm font-semibold text-[var(--haven-ink)]">
          {fulfilledCount} of {requiredDocuments.length} uploaded
        </span>
      </div>

      <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] px-4">
        {checklist.map((item) => (
          <div className="py-4" key={item.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {item.isUploaded ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)]" />
                ) : (
                  <CircleAlert className="h-4 w-4 text-[var(--haven-blush-ink)]" />
                )}
                <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{item.label}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    item.isUploaded
                      ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                      : "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
                  }`}
                >
                  {item.isUploaded ? "Uploaded" : "Optional now"}
                </span>
              </div>
            </div>

            {item.detail && !item.isUploaded && (
              <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">{item.detail}</p>
            )}

            {item.documents.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.documents.map((doc) => (
                  <li className="text-[12px] text-[var(--haven-ink-mid)]" key={doc.id}>
                    Uploaded: <span className="font-medium text-[var(--haven-ink)]">{doc.originalName}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--haven-cream)] p-3">
              <DocumentContextUploader
                buttonLabel={item.isUploaded ? `Upload another ${item.label}` : `Upload ${item.label}`}
                compact
                displayLabel={item.label}
                documentKind={item.key}
                onUploaded={onDocumentUploaded}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`rounded-[var(--radius-lg)] p-4 ${error ? "bg-[#fdf0f0] ring-1 ring-[#e8b4b4]" : "bg-[var(--haven-cream)]"}`}>
      {children}
      {error && <p className="mt-1.5 text-[0.75rem] font-medium text-[#7a3030]">This field is required</p>}
    </div>
  );
}

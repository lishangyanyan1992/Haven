"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Briefcase, Clock, Heart, ShieldCheck, TrendingUp, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface OnboardingData {
  visaType: string;
  countryOfBirth: string;
  primaryGoal: string;
  employerName: string;
  jobTitle: string;
  h1bStartDate: string;
  employerSize: string;
  greenCardStage: string;
  priorityDate: string;
  preferenceCategory: string;
  i140Approved: string; // derived from greenCardStage, not shown as a field
  spouseVisaStatus: string;
  topConcerns: string[];
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
  }
];

const valueInsights = [
  [
    "We route you to the right experience based on your visa path.",
    "Country of birth determines which per-country queue applies to you.",
    "Your first dashboard view should feel personal, not generic."
  ],
  [
    "H-1B start date lets Haven compute cap and renewal timing.",
    "Employer size affects fallback options and portability planning.",
    "A few work details unlock more useful scenario planning right away."
  ],
  [
    "Priority date plus category sets the shape of your wait.",
    "Your green card stage tells Haven what decisions are actually in front of you.",
    "Haven shows ranges when reality is uncertain, not fake precision."
  ],
  [
    "Spouse status may create additional paths in a hard moment.",
    "Your concerns help rank what Haven surfaces first.",
    "Community matching works better when it knows what you are navigating."
  ]
];

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

export function OnboardingFlow({
  saveStepAction,
  initialStep,
  userEmail
}: {
  saveStepAction: (step: number, data: FormData) => Promise<void>;
  initialStep: number;
  userEmail: string;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSaving, startSavingTransition] = useTransition();
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({ topConcerns: [] });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStepActionRef = useRef(saveStepAction);
  const currentStepRef = useRef(currentStep);
  const formDataRef = useRef(formData);

  useEffect(() => { saveStepActionRef.current = saveStepAction; }, [saveStepAction]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { formDataRef.current = formData; }, [formData]);

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
      if (typeof parsed.currentStep === "number" && parsed.currentStep >= 1 && parsed.currentStep <= 4) {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  }, [userEmail]);

  useEffect(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    setShowFieldErrors(false);
  }, [currentStep]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ currentStep, formData, userEmail }));
    document.cookie = `${ONBOARDING_OVERRIDE_COOKIE}=${encodeURIComponent(JSON.stringify(formData))}; path=/; max-age=86400; samesite=lax`;
  }, [currentStep, formData]);

  const updateField = (key: keyof OnboardingData, value: string) => {
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
    const requiredByStep: Record<number, { key: keyof OnboardingData; label: string }[]> = {
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
      const value = formData[key];
      return !value || String(value).trim().length === 0;
    });
  }, [currentStep, formData]);

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

  const handleNext = () => {
    if (isSaving || currentStep >= steps.length) return;
    if (missingFields.length > 0) {
      setShowFieldErrors(true);
      return;
    }
    setSaveFeedback("Saving...");
    persistStep(currentStep, () => {
      setSaveFeedback(null);
      setCurrentStep((s) => Math.min(s + 1, steps.length));
    });
  };

  const handlePrev = () => setCurrentStep((s) => Math.max(s - 1, 1));

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
        await saveStepAction(4, data);
        if (typeof window !== "undefined") window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        router.push("/dashboard");
      } catch {
        setSaveFeedback("Something went wrong. Please try again.");
      }
    });
  };

  const step = steps[currentStep - 1];
  const StepIcon = step.icon;

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
                <p className="text-label">Step {currentStep} of 4</p>
                <h1 className="text-h1 mt-3 max-w-[20ch]">{step.headline}</h1>
                <p className="text-body mt-3 max-w-[60ch]">{step.description}</p>
              </div>
              <div className="hidden rounded-[var(--radius-xl)] bg-[var(--haven-sage-light)] p-3 text-[var(--haven-ink)] md:block">
                <StepIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {steps.map((item) => {
                const isActive = item.id === currentStep;
                const isDone = item.id < currentStep;
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
            {currentStep === 1 && <Step1Form data={formData} errors={errorFields} onChange={updateField} />}
            {currentStep === 2 && <Step2Form data={formData} errors={errorFields} onChange={updateField} />}
            {currentStep === 3 && <Step3Form data={formData} errors={errorFields} onChange={updateField} />}
            {currentStep === 4 && <Step4Form data={formData} errors={errorFields} onChange={updateField} onToggleConcern={toggleConcern} />}
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
                currentStep === 1
                  ? "pointer-events-none border-transparent text-transparent"
                  : "border-[var(--haven-ink)] bg-transparent text-[var(--haven-ink)]"
              )}
              onClick={handlePrev}
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep < 4 ? (
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
              {valueInsights[currentStep - 1].map((item) => (
                <p key={item} className="text-body-sm">{item}</p>
              ))}
            </div>
          </div>

          {/* Country wait time — shown on step 1 when country is selected */}
          {currentStep === 1 && countryOverview && (
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
          {currentStep === 2 && h1bInfo && (
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
          {currentStep === 3 && formData.greenCardStage && formData.preferenceCategory && (
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
              {steps.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className={cn("step-dot", item.id === currentStep ? "active" : item.id < currentStep ? "done" : "")} />
                  <span className={cn("text-body-sm", item.id <= currentStep ? "text-[var(--haven-ink)]" : "")}>{item.label}</span>
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
  errors,
  onChange
}: {
  data: Partial<OnboardingData>;
  errors: Set<string>;
  onChange: (key: keyof OnboardingData, value: string) => void;
}) {
  return (
    <>
      <Field error={errors.has("visaType")}>
        <label className="field-label">Current visa status <Required /></label>
        <Select onChange={(e) => onChange("visaType", e.target.value)} value={data.visaType ?? ""}>
          <option value="" disabled>Please select</option>
          {["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
      </Field>
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
    </>
  );
}

function Step2Form({
  data,
  errors,
  onChange
}: {
  data: Partial<OnboardingData>;
  errors: Set<string>;
  onChange: (key: keyof OnboardingData, value: string) => void;
}) {
  return (
    <>
      <Field error={errors.has("employerName")}>
        <label className="field-label">Employer name <Required /></label>
        <Input onChange={(e) => onChange("employerName", e.target.value)} placeholder="e.g. Nimbus AI" value={data.employerName ?? ""} />
      </Field>
      <Field error={errors.has("jobTitle")}>
        <label className="field-label">Job title <Required /></label>
        <Input onChange={(e) => onChange("jobTitle", e.target.value)} placeholder="e.g. Senior Software Engineer" value={data.jobTitle ?? ""} />
      </Field>
      <Field error={errors.has("h1bStartDate")}>
        <label className="field-label">H-1B start date <Required /></label>
        <Input onChange={(e) => onChange("h1bStartDate", e.target.value)} type="date" value={data.h1bStartDate ?? ""} />
        <p className="field-helper">Used to compute your six-year cap date and renewal window.</p>
      </Field>
      <Field error={errors.has("employerSize")}>
        <label className="field-label">Employer size <Required /></label>
        <Select onChange={(e) => onChange("employerSize", e.target.value)} value={data.employerSize ?? ""}>
          <option value="" disabled>Please select</option>
          <option value="startup">Startup (under 200)</option>
          <option value="mid-size">Mid-size (200–2,000)</option>
          <option value="enterprise">Enterprise (2,000+)</option>
        </Select>
      </Field>
    </>
  );
}

function Step3Form({
  data,
  errors,
  onChange
}: {
  data: Partial<OnboardingData>;
  errors: Set<string>;
  onChange: (key: keyof OnboardingData, value: string) => void;
}) {
  return (
    <>
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
      <Field error={errors.has("preferenceCategory")}>
        <label className="field-label">Preference category <Required /></label>
        <Select onChange={(e) => onChange("preferenceCategory", e.target.value)} value={data.preferenceCategory ?? ""}>
          <option value="" disabled>Please select</option>
          {["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </Select>
      </Field>
      <Field>
        <label className="field-label">Priority date <span className="text-[var(--color-text-tertiary)] font-normal">(optional)</span></label>
        <Input onChange={(e) => onChange("priorityDate", e.target.value)} type="date" value={data.priorityDate ?? ""} />
        <p className="field-helper">The date your PERM or I-140 was filed. Leave blank if not yet applicable.</p>
      </Field>
    </>
  );
}

function Step4Form({
  data,
  errors,
  onChange,
  onToggleConcern
}: {
  data: Partial<OnboardingData>;
  errors: Set<string>;
  onChange: (key: keyof OnboardingData, value: string) => void;
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
    </>
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

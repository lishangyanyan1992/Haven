"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Briefcase, Heart, ShieldCheck, TrendingUp, User } from "lucide-react";

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
  i140Approved: string;
  spouseVisaStatus: string;
  topConcerns: string[];
}

const steps = [
  {
    id: 1,
    label: "Your profile",
    short: "Profile",
    icon: User,
    headline: "Let’s start with where you are right now.",
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
    description: "Priority date, category, and I-140 status shape what to expect next."
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
    "We can route you to the right experience based on your visa path.",
    "Country of birth matters because it affects green card wait time.",
    "Your first dashboard view should feel personal, not generic."
  ],
  [
    "H-1B start date lets Haven compute cap and renewal timing.",
    "Employer size affects fallback options and portability planning.",
    "A few work details unlock more useful scenario planning right away."
  ],
  [
    "Priority date plus category sets the shape of your wait.",
    "I-140 approval changes what options stay open during a job change.",
    "Haven shows ranges when reality is uncertain, not fake precision."
  ],
  [
    "Spouse status may create additional paths in a hard moment.",
    "Your concerns help rank what Haven surfaces first.",
    "Community matching works better when it knows what you are navigating."
  ]
];

const ONBOARDING_STORAGE_KEY = "haven-onboarding-progress";
const ONBOARDING_OVERRIDE_COOKIE = "haven_onboarding_override";

export function OnboardingFlow({
  saveStepAction,
  initialStep
}: {
  saveStepAction: (step: number, data: FormData) => Promise<void>;
  initialStep: number;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSaving, startSavingTransition] = useTransition();
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({
    visaType: "H1B",
    countryOfBirth: "India",
    primaryGoal: "get_gc",
    employerSize: "enterprise",
    greenCardStage: "not_started",
    preferenceCategory: "EB-2",
    i140Approved: "false",
    spouseVisaStatus: "none",
    topConcerns: ["layoffs"]
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        currentStep?: number;
        formData?: Partial<OnboardingData>;
      };

      if (parsed.formData) {
        setFormData((prev) => ({ ...prev, ...parsed.formData }));
      }

      if (typeof parsed.currentStep === "number" && parsed.currentStep >= 1 && parsed.currentStep <= 4) {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    window.localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep,
        formData
      })
    );

    document.cookie = `${ONBOARDING_OVERRIDE_COOKIE}=${encodeURIComponent(JSON.stringify(formData))}; path=/; max-age=86400; samesite=lax`;
  }, [currentStep, formData]);

  const updateField = (key: keyof OnboardingData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleConcern = (concern: string) => {
    setFormData((prev) => {
      const current = prev.topConcerns ?? [];
      const next = current.includes(concern) ? current.filter((item) => item !== concern) : [...current, concern];
      return { ...prev, topConcerns: next };
    });
  };

  const missingFields = useMemo(() => {
    if (currentStep !== 2) return [];

    return [
      { key: "employerName", label: "Employer name" },
      { key: "jobTitle", label: "Job title" },
      { key: "h1bStartDate", label: "H-1B start date" }
    ].filter(({ key }) => {
      const value = formData[key as keyof OnboardingData];
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

      if (value !== undefined) {
        data.append(key, value);
      }
    });
    return data;
  };

  const persistStep = (step: number, onComplete?: () => void) => {
    const data = buildFormData();
    startSavingTransition(async () => {
      try {
        await saveStepAction(step, data);
      } catch {
        // Keep the flow usable even if persistence lags.
      } finally {
        onComplete?.();
      }
    });
  };

  const handleNext = () => {
    if (isSaving || currentStep >= steps.length) return;
    setSaveFeedback("Saving your answers in the background.");
    persistStep(currentStep, () => {
      setSaveFeedback(null);
      setCurrentStep((step) => Math.min(step + 1, steps.length));
    });
  };

  const handlePrev = () => {
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const handleFinish = () => {
    if (isSaving) return;
    setSaveFeedback("Opening your dashboard...");
    persistStep(4, () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      }
      router.push("/dashboard?setup=local");
    });
  };

  const step = steps[currentStep - 1];
  const StepIcon = step.icon;

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
                    <span
                      className={cn(
                        "step-dot",
                        isActive ? "active" : isDone ? "done" : ""
                      )}
                    />
                    {item.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {currentStep === 1 && <Step1Form data={formData} onChange={updateField} />}
            {currentStep === 2 && <Step2Form data={formData} onChange={updateField} />}
            {currentStep === 3 && <Step3Form data={formData} onChange={updateField} />}
            {currentStep === 4 && <Step4Form data={formData} onChange={updateField} onToggleConcern={toggleConcern} />}
          </div>

          <div className="mt-6 min-h-6">
            {missingFields.length > 0 && (
              <p className="text-body-sm">
                You can keep going now, but add {missingFields.map((field) => field.label.toLowerCase()).join(", ")} for a more accurate dashboard.
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
          <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <p className="text-label">Why we ask this</p>
            <div className="mt-4 space-y-3">
              {valueInsights[currentStep - 1].map((item) => (
                <p key={item} className="text-body-sm">
                  {item}
                </p>
              ))}
            </div>
          </div>

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

function Step1Form({
  data,
  onChange
}: {
  data: Partial<OnboardingData>;
  onChange: (key: keyof OnboardingData, value: string) => void;
}) {
  return (
    <>
      <Field>
        <label className="field-label">Current visa status</label>
        <Select onChange={(event) => onChange("visaType", event.target.value)} value={data.visaType ?? "H1B"}>
          {["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <label className="field-label">Country of birth</label>
        <Select onChange={(event) => onChange("countryOfBirth", event.target.value)} value={data.countryOfBirth ?? ""}>
          <option value="">Select country</option>
          {["India", "China", "Mexico", "Philippines", "South Korea", "Brazil", "Canada", "United Kingdom", "Other"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <p className="field-helper">Country of birth shapes your green card wait time.</p>
      </Field>
      <Field>
        <label className="field-label">Primary goal</label>
        <Select onChange={(event) => onChange("primaryGoal", event.target.value)} value={data.primaryGoal ?? "get_gc"}>
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
  onChange
}: {
  data: Partial<OnboardingData>;
  onChange: (key: keyof OnboardingData, value: string) => void;
}) {
  return (
    <>
      <Field>
        <label className="field-label">Employer name</label>
        <Input onChange={(event) => onChange("employerName", event.target.value)} placeholder="e.g. Nimbus AI" value={data.employerName ?? ""} />
      </Field>
      <Field>
        <label className="field-label">Job title</label>
        <Input onChange={(event) => onChange("jobTitle", event.target.value)} placeholder="e.g. Senior Software Engineer" value={data.jobTitle ?? ""} />
      </Field>
      <Field>
        <label className="field-label">H-1B start date</label>
        <Input onChange={(event) => onChange("h1bStartDate", event.target.value)} type="date" value={data.h1bStartDate ?? ""} />
        <p className="field-helper">Used to compute your six-year cap date and renewal window.</p>
      </Field>
      <Field>
        <label className="field-label">Employer size</label>
        <Select onChange={(event) => onChange("employerSize", event.target.value)} value={data.employerSize ?? "enterprise"}>
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
  onChange
}: {
  data: Partial<OnboardingData>;
  onChange: (key: keyof OnboardingData, value: string) => void;
}) {
  return (
    <>
      <Field>
        <label className="field-label">Green card stage</label>
        <Select onChange={(event) => onChange("greenCardStage", event.target.value)} value={data.greenCardStage ?? "not_started"}>
          <option value="not_started">Not started yet</option>
          <option value="perm_in_progress">PERM in progress</option>
          <option value="perm_certified">PERM certified</option>
          <option value="i140_filed">I-140 filed</option>
          <option value="i140_approved">I-140 approved</option>
          <option value="i485_filed">I-485 filed</option>
        </Select>
      </Field>
      <Field>
        <label className="field-label">Preference category</label>
        <Select onChange={(event) => onChange("preferenceCategory", event.target.value)} value={data.preferenceCategory ?? "EB-2"}>
          {["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <label className="field-label">Priority date</label>
        <Input onChange={(event) => onChange("priorityDate", event.target.value)} type="date" value={data.priorityDate ?? ""} />
        <p className="field-helper">Leave blank if this is not applicable yet.</p>
      </Field>
      <Field>
        <label className="field-label">I-140 status</label>
        <Select onChange={(event) => onChange("i140Approved", event.target.value)} value={data.i140Approved ?? "false"}>
          <option value="false">Not approved yet</option>
          <option value="true">I-140 approved</option>
        </Select>
      </Field>
    </>
  );
}

function Step4Form({
  data,
  onChange,
  onToggleConcern
}: {
  data: Partial<OnboardingData>;
  onChange: (key: keyof OnboardingData, value: string) => void;
  onToggleConcern: (concern: string) => void;
}) {
  const concerns = data.topConcerns ?? [];
  const concernOptions = [
    { value: "layoffs", label: "Layoff risk", description: "I want a plan if my job changes suddenly." },
    { value: "visa_expiry", label: "Visa expiry", description: "I need help keeping dates and renewal timing straight." },
    { value: "gc_timeline", label: "Green card timeline", description: "I want clarity on queues, ranges, and bulletin movement." },
    { value: "job_change", label: "Job change", description: "I’m weighing portability, transfers, or other moves." }
  ];

  return (
    <>
      <Field>
        <label className="field-label">Spouse or partner visa status</label>
        <Select onChange={(event) => onChange("spouseVisaStatus", event.target.value)} value={data.spouseVisaStatus ?? "none"}>
          <option value="none">No spouse or not applicable</option>
          <option value="H1B">Spouse on H-1B</option>
          <option value="H4">Spouse on H-4</option>
          <option value="H4 EAD">Spouse on H-4 EAD</option>
          <option value="GC">Spouse is a green card holder</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <div>
        <label className="field-label">What feels most important right now?</label>
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

function Field({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[var(--radius-lg)] bg-[var(--haven-cream)] p-4">{children}</div>;
}

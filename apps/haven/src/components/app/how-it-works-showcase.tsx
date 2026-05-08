"use client";

import { CalendarCheck, Clock3, MessageCircle, ShieldAlert, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const steps = [
  {
    label: "Step 1",
    title: "Tell us about yourself",
    copy: "Every case is different, so Haven can place you in the right path.",
    preview: ProfilePreview
  },
  {
    label: "Step 2",
    title: "See your milestone dates and action windows",
    copy: "Deterministic dates where possible, honest ranges where not.",
    preview: TimelinePreview
  },
  {
    label: "Step 3",
    title: "Plan for layoffs, renewals, and employer changes",
    copy: "One calm plan instead of a generic warning banner.",
    preview: ActionPlanPreview
  },
  {
    label: "Step 4",
    title: "Learn from people who already went through it",
    copy: "Community guidance shows what worked in practice.",
    preview: CommunityPreview
  }
] as const;

export function HowItWorksShowcase() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, 2600);

    return () => window.clearInterval(intervalId);
  }, []);

  const ActivePreview = steps[activeStep].preview;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[rgba(253,250,246,0.86)] p-5 md:p-6">
        <div className="space-y-3">
          {steps.map((step, index) => {
            const state =
              index < activeStep ? "done" : index === activeStep ? "active" : "pending";

            return (
              <button
                key={step.label}
                className={cn(
                  "group relative flex w-full gap-4 rounded-[1.25rem] px-3 py-3 text-left transition-all duration-300",
                  state === "active" && "bg-[var(--haven-white)] shadow-[0_12px_28px_-18px_rgba(44,54,48,0.22)]",
                  state === "done" && "bg-[rgba(239,246,238,0.56)]",
                  state === "pending" && "bg-transparent hover:bg-[rgba(255,255,255,0.6)]"
                )}
                onClick={() => setActiveStep(index)}
                type="button"
              >
                <div className="relative flex w-7 shrink-0 justify-center pt-1">
                  {index < steps.length - 1 ? (
                    <div
                      className={cn(
                        "absolute top-7 h-[calc(100%+0.75rem)] w-px transition-colors duration-300",
                        index < activeStep ? "bg-[var(--haven-sage-mid)]" : "bg-[var(--color-border-mid)]"
                      )}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "relative z-10 h-3 w-3 rounded-full border transition-all duration-300",
                      state === "done" && "border-[var(--haven-sage)] bg-[var(--haven-sage)]",
                      state === "active" &&
                        "h-4 w-4 border-[var(--haven-ink)] bg-[var(--haven-ink)] shadow-[0_0_0_6px_rgba(44,54,48,0.1)]",
                      state === "pending" && "border-[var(--color-border-mid)] bg-[var(--haven-white)]"
                    )}
                  />
                </div>

                <div className="min-w-0 pb-5 last:pb-0">
                  <p className="text-label">{step.label}</p>
                  <p
                    className={cn(
                      "mt-1 text-h3 transition-colors duration-300",
                      state === "active" ? "text-[var(--haven-ink)]" : "text-[var(--haven-ink-mid)]"
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-body-sm mt-2">{step.copy}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <p className="text-label">{steps[activeStep].label}</p>
            <p className="text-h3 mt-1">{steps[activeStep].title}</p>
          </div>
          <div className="step-dots">
            {steps.map((step, index) => (
              <span key={step.label} className={cn("step-dot", index < activeStep ? "done" : index === activeStep ? "active" : "")} />
            ))}
          </div>
        </div>

        <div key={steps[activeStep].label} className="animate-enter">
          <ActivePreview />
        </div>
      </div>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(248,246,242,0.98),rgba(255,255,255,0.96))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">Profile setup</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">Match me to the right track</p>
        </div>
        <Sparkles className="h-4 w-4 text-[var(--haven-sky-ink)]" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["Visa status", "H-1B"],
          ["Country of birth", "India"],
          ["Current employer", "Acme Health"],
          ["Primary goal", "Keep status + plan GC"]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1rem] border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-ink-mid)]">{label}</p>
            <p className="mt-2 text-[13px] font-medium text-[var(--haven-ink)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[1rem] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-4 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sky-ink)]">Suggested path</p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--haven-ink)]">Employment-based timeline with layoff readiness, transfer support, and green card planning.</p>
      </div>
    </div>
  );
}

function TimelinePreview() {
  return (
    <div className="rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(247,250,251,0.96),rgba(255,255,255,0.98))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-sky-ink)]">Key dates</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">What matters next</p>
        </div>
        <CalendarCheck className="h-4 w-4 text-[var(--haven-sky-ink)]" />
      </div>

      <div className="mt-4 space-y-3">
        {[
          ["Apr 22", "Receipt notice expected", "Completed"],
          ["May 03", "Travel decision window", "In progress"],
          ["May 16", "Premium processing decision point", "Coming up"]
        ].map(([date, title, status], index) => (
          <div key={title} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1rem] border border-[rgba(58,110,132,0.12)] bg-[var(--haven-white)] px-3 py-3">
            <div className={cn("h-2.5 w-2.5 rounded-full", index === 0 ? "bg-[var(--haven-sage)]" : index === 1 ? "bg-[var(--haven-sky)]" : "bg-[var(--haven-blush)]")} />
            <div>
              <p className="text-[13px] font-medium text-[var(--haven-ink)]">{title}</p>
              <p className="mt-1 text-[12px] text-[var(--haven-ink-mid)]">{status}</p>
            </div>
            <p className="text-[12px] font-semibold text-[var(--haven-ink-mid)]">{date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionPlanPreview() {
  return (
    <div className="rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(250,246,242,0.98),rgba(255,255,255,0.98))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-blush-ink)]">Action plan</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">Keep your next move calm</p>
        </div>
        <Clock3 className="h-4 w-4 text-[var(--haven-blush-ink)]" />
      </div>

      <div className="mt-4 rounded-[1rem] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-blush-ink)]">60-day support</p>
        <p className="mt-2 text-[13px] text-[var(--haven-ink)]">Day 18: preserve your documents, shortlist transfer-ready roles, and compare fallback paths.</p>
      </div>

      <div className="mt-4 space-y-3">
        {[
          "Save termination email and I-94 copy",
          "Review H-1B transfer timing",
          "Compare transfer, B-2, and departure options"
        ].map((item, index) => (
          <div key={item} className="flex items-start gap-3 rounded-[1rem] border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-3">
            <div className={cn("mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold", index === 0 ? "bg-[var(--haven-ink)] text-[var(--haven-cream)]" : "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)]")}>
              {index + 1}
            </div>
            <p className="text-[13px] leading-snug text-[var(--haven-ink)]">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunityPreview() {
  return (
    <div className="rounded-[1.25rem] bg-[linear-gradient(180deg,rgba(241,247,250,0.98),rgba(255,255,255,0.98))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-sky-ink)]">Matched community</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">People in a similar situation</p>
        </div>
        <Users className="h-4 w-4 text-[var(--haven-sky-ink)]" />
      </div>

      <div className="mt-4 space-y-3">
        {[
          {
            title: "H-1B transfer after layoff",
            detail: "India queue · day 21",
            copy: "Used premium processing once the new offer signed and avoided travel until receipt."
          },
          {
            title: "OPT to H-1B backup plan",
            detail: "Nigeria · STEM OPT",
            copy: "Compared cap-gap timing with backup status options before making the call."
          }
        ].map((story, index) => (
          <div
            key={story.title}
            className={cn(
              "rounded-[1rem] border p-3",
              index === 0 ? "border-[var(--haven-sky-mid)] bg-[var(--haven-white)]" : "border-[var(--color-border)] bg-[rgba(255,255,255,0.8)]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[var(--haven-ink)]">{story.title}</p>
              <MessageCircle className="h-4 w-4 text-[var(--haven-ink-mid)]" />
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-ink-mid)]">{story.detail}</p>
            <p className="mt-2 text-[13px] leading-snug text-[var(--haven-ink-mid)]">{story.copy}</p>
          </div>
        ))}

        <div className="rounded-[1rem] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[var(--haven-sage)]" />
            <p className="text-[13px] font-medium text-[var(--haven-ink)]">Show stories from H-1B holders in India queue facing transfer timing</p>
          </div>
        </div>
      </div>
    </div>
  );
}

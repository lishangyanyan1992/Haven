"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildFirmEngagementOverview,
  FIRM_ENGAGEMENT_STAGES,
  isValidBookingUrl
} from "@/lib/firms/engagement";
import type { FirmClientEngagementState, FirmEngagementStageKey } from "@/lib/firms/types";
import { saveFirmClientEngagementAction } from "@/server/firm-actions";
import { cn } from "@/lib/utils";

const LAWYER_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Auto-track from intake & document uploads" },
  { value: "initial_consultation:scheduled", label: "Initial consultation call — Scheduled" },
  { value: "initial_consultation:completed", label: "Initial consultation call — Completed (Next: Contract)" },
  { value: "contract_signed:in_progress", label: "Contract sent — Awaiting signature" },
  { value: "contract_signed:completed", label: "Contract signed — Completed (Next: Case prep)" },
  { value: "case_prep:in_progress", label: "Case preparation — In progress" },
  { value: "case_prep:completed", label: "Case preparation — Completed (Next: Filing)" },
  { value: "petition_filed:completed", label: "Petition filed — Completed" }
];

function stateToOptionValue(state: FirmClientEngagementState): string {
  if (!state.stage) return "auto";
  if (state.stage === "initial_consultation") {
    return state.stageStatus === "completed"
      ? "initial_consultation:completed"
      : "initial_consultation:scheduled";
  }
  if (state.stage === "contract_signed") {
    return state.stageStatus === "completed"
      ? "contract_signed:completed"
      : "contract_signed:in_progress";
  }
  if (state.stage === "case_prep") {
    return state.stageStatus === "completed"
      ? "case_prep:completed"
      : "case_prep:in_progress";
  }
  if (state.stage === "petition_filed") {
    return "petition_filed:completed";
  }
  return "auto";
}

function optionValueToState(
  optionValue: string,
  scheduledDate: string,
  note: string,
  bookingUrl?: string,
  bookingEmail?: string
): FirmClientEngagementState {
  const out: FirmClientEngagementState = {};
  if (optionValue !== "auto" && optionValue.includes(":")) {
    const [stage, status] = optionValue.split(":") as [
      FirmEngagementStageKey,
      "in_progress" | "scheduled" | "completed"
    ];
    out.stage = stage;
    out.stageStatus = status;
  }
  if (scheduledDate.trim()) {
    out.scheduledDate = scheduledDate.trim();
  }
  if (bookingUrl?.trim()) {
    out.bookingUrl = bookingUrl.trim();
  }
  if (bookingEmail?.trim()) {
    out.bookingEmail = bookingEmail.trim();
  }
  if (note.trim()) {
    out.note = note.trim();
  }
  return out;
}

export function EngagementStageControls({
  firmClientId,
  firmName,
  joinedAt,
  completedAt,
  reviewedAt,
  uploadedDocumentCount,
  requiredDocumentCount,
  fulfilledRequiredCount,
  initialState
}: {
  firmClientId: string;
  firmName: string;
  joinedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  uploadedDocumentCount: number;
  requiredDocumentCount: number;
  fulfilledRequiredCount: number;
  initialState: FirmClientEngagementState;
}) {
  const [selectedOption, setSelectedOption] = useState<string>(() => stateToOptionValue(initialState));
  const [scheduledDate, setScheduledDate] = useState<string>(initialState.scheduledDate ?? "");
  const [bookingUrl, setBookingUrl] = useState<string>(initialState.bookingUrl ?? "");
  const [bookingEmail, setBookingEmail] = useState<string>(initialState.bookingEmail ?? "");
  const [note, setNote] = useState<string>(initialState.note ?? "");
  const [savedState, setSavedState] = useState<FirmClientEngagementState>(initialState);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const liveDraft = optionValueToState(selectedOption, scheduledDate, note, bookingUrl, bookingEmail);
  const overview = buildFirmEngagementOverview({
    firmName,
    isConnectedToFirm: true,
    joinedAt,
    completedAt,
    reviewedAt,
    uploadedDocumentCount,
    requiredDocumentCount,
    fulfilledRequiredCount,
    engagementState: liveDraft
  });

  const isDirty =
    selectedOption !== stateToOptionValue(savedState) ||
    scheduledDate.trim() !== (savedState.scheduledDate ?? "") ||
    bookingUrl.trim() !== (savedState.bookingUrl ?? "") ||
    bookingEmail.trim() !== (savedState.bookingEmail ?? "") ||
    note.trim() !== (savedState.note ?? "");

  function handleSave() {
    setFeedback(null);
    const trimmedUrl = bookingUrl.trim();
    if (trimmedUrl && !isValidBookingUrl(trimmedUrl)) {
      setFeedback({ kind: "error", message: "Booking link must start with https:// or http:// and include a valid destination." });
      return;
    }
    const trimmedEmail = bookingEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFeedback({ kind: "error", message: "Please enter a valid email address." });
      return;
    }

    startTransition(async () => {
      const payload = optionValueToState(selectedOption, scheduledDate, note, bookingUrl, bookingEmail);
      const res = await saveFirmClientEngagementAction(firmClientId, payload);
      if (res.ok) {
        setSavedState(res.state);
        setFeedback({ kind: "ok", message: "Client engagement timeline updated." });
      } else {
        setFeedback({ kind: "error", message: res.error });
      }
    });
  }

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label">Client engagement pipeline</p>
          <h2 className="text-h3 mt-1">Sponsoring law firm milestones</h2>
          <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
            Early steps update automatically from intake and document uploads. Advance consultation, contract, and filing milestones below to update the client&apos;s Case dashboard.
          </p>
        </div>
        <span className="rounded-full bg-[var(--haven-sage-light)] px-3 py-1 text-[12px] font-semibold text-[var(--haven-ink)]">
          {overview.completedCount} of {overview.totalSteps} completed
        </span>
      </div>

      {/* Stepper preview */}
      <div className="mt-5 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {overview.steps.map((step) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          return (
            <div
              key={step.key}
              className={cn(
                "rounded-[var(--radius-lg)] border p-3 transition-colors",
                isCompleted
                  ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]"
                  : isCurrent
                    ? "border-[var(--haven-ink)] bg-[var(--haven-cream)]"
                    : "border-[var(--color-border)] bg-[var(--haven-white)] opacity-75"
              )}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                  Step {step.index + 1}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)]" />
                ) : isCurrent ? (
                  <Clock className="h-4 w-4 text-[var(--haven-ink)]" />
                ) : null}
              </div>
              <p className="mt-1.5 text-body-sm font-semibold text-[var(--haven-ink)]">{step.shortLabel}</p>
              <p className="mt-0.5 text-[11px] text-[var(--haven-ink-mid)]">{step.badgeText}</p>
            </div>
          );
        })}
      </div>

      {/* Lawyer controls */}
      <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 md:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="firm-engagement-stage">
            Milestone stage
          </label>
          <Select
            id="firm-engagement-stage"
            onChange={(e) => setSelectedOption(e.target.value)}
            value={selectedOption}
          >
            {LAWYER_STAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="field-label" htmlFor="firm-engagement-date">
            Consultation / target date <span className="font-normal text-[var(--haven-ink-light)]">(optional)</span>
          </label>
          <Input
            id="firm-engagement-date"
            onChange={(e) => setScheduledDate(e.target.value)}
            type="date"
            value={scheduledDate}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="firm-engagement-note">
            Client-facing note <span className="font-normal text-[var(--haven-ink-light)]">(optional)</span>
          </label>
          <Input
            id="firm-engagement-note"
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Call booked with Maria for Thursday at 2pm PT"
            value={note}
          />
        </div>
      </div>

      {/* Consultation scheduling override */}
      <div className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 md:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="firm-client-booking-url">
            Client booking link override <span className="font-normal text-[var(--haven-ink-light)]">(optional)</span>
          </label>
          <Input
            id="firm-client-booking-url"
            onChange={(e) => setBookingUrl(e.target.value)}
            placeholder="https://calendly.com/lawyer/custom-link"
            type="url"
            value={bookingUrl}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="firm-client-booking-email">
            Client scheduling email override <span className="font-normal text-[var(--haven-ink-light)]">(optional)</span>
          </label>
          <Input
            id="firm-client-booking-email"
            onChange={(e) => setBookingEmail(e.target.value)}
            placeholder="attorney@yourfirm.com"
            type="email"
            value={bookingEmail}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-body-sm">
          {feedback ? (
            <span
              className={
                feedback.kind === "ok"
                  ? "font-medium text-[var(--haven-success-ink)]"
                  : "font-medium text-[var(--haven-blush-ink)]"
              }
            >
              {feedback.message}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[var(--haven-ink-mid)]">
              <Sparkles className="h-3.5 w-3.5" />
              Client sees: <strong className="text-[var(--haven-ink)]">{overview.headline}</strong>
            </span>
          )}
        </div>
        <Button
          disabled={isPending || !isDirty}
          onClick={handleSave}
          size="sm"
          type="button"
        >
          {isPending ? "Saving..." : "Save engagement stage"}
        </Button>
      </div>
    </section>
  );
}

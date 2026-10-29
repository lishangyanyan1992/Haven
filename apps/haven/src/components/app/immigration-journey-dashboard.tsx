"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Flag,
  Layers,
  PencilLine,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  ImmigrationJourneyView,
  JourneyBarSegment,
  JourneyPlotPin,
  JourneyTrackTone,
  PetitionTrack,
  TacticalTimelinePin,
  TacticalTimelineView
} from "@/lib/immigration-journey";
import { saveCaseJourneyDatesAction } from "@/server/actions";
import type { ImmigrationProfile } from "@/types/domain";
import { cn } from "@/lib/utils";

const TONE_BADGE_CLASS: Record<JourneyTrackTone, string> = {
  sage: "bg-[var(--haven-sage-light)] text-[var(--haven-ink)] border-[var(--haven-sage-mid)]",
  sky: "bg-[var(--haven-sky-light)] text-[var(--haven-sky-ink)] border-[var(--haven-sky-mid)]",
  sand: "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)] border-[var(--color-border)]",
  blush: "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)] border-[var(--haven-blush)]",
  ink: "bg-[var(--haven-ink)] text-[var(--haven-cream)] border-[var(--haven-ink)]"
};

const TONE_BAR_CLASS: Record<JourneyTrackTone, string> = {
  sage: "bg-[var(--haven-sage)]",
  sky: "bg-[var(--haven-sky)]",
  sand: "bg-[#d8cfc2]",
  blush: "bg-[#d98a6c]",
  ink: "bg-[var(--haven-ink)]"
};

const TONE_PIN_CLASS: Record<JourneyTrackTone, string> = {
  sage: "border-[var(--haven-sage-strong)] bg-[var(--haven-white)] text-[var(--haven-ink)]",
  sky: "border-[var(--haven-sky-ink)] bg-[var(--haven-white)] text-[var(--haven-sky-ink)]",
  sand: "border-[var(--haven-ink-mid)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)]",
  blush: "border-[var(--haven-blush-ink)] bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]",
  ink: "border-[var(--haven-ink)] bg-[var(--haven-ink)] text-[var(--haven-cream)]"
};

const COUNTRY_OPTIONS = [
  "India",
  "China",
  "Mexico",
  "Philippines",
  "South Korea",
  "Brazil",
  "Canada",
  "United Kingdom",
  "Other"
];

const PIN_ALIASES: Record<string, string[]> = {
  "tactical-last-day": ["job-last-day"],
  "job-last-day": ["tactical-last-day"],
  "tactical-stay-end": ["job-grace-end", "visa-stay-deadline", "visa-expiry"],
  "job-grace-end": ["tactical-stay-end", "visa-stay-deadline"],
  "visa-stay-deadline": ["tactical-stay-end", "job-grace-end"],
  "visa-expiry": ["tactical-stay-end"],
  "tactical-ac21": ["job-ac21"],
  "job-ac21": ["tactical-ac21"],
  "tactical-agency": ["job-agency-deadline", "tactical-agency-deadline"],
  "tactical-agency-deadline": ["job-agency-deadline", "tactical-agency"],
  "job-agency-deadline": ["tactical-agency", "tactical-agency-deadline"],
  "tactical-renewal-open": ["visa-renewal"],
  "visa-renewal": ["tactical-renewal-open"],
  "gc-pd": ["priority_date"],
  "priority_date": ["gc-pd"],
  "gc-i140": ["i140"],
  "i140": ["gc-i140"]
};

function isPinActive(pinId: string, activeId: string | null): boolean {
  if (!activeId) return false;
  if (pinId === activeId) return true;
  if (PIN_ALIASES[pinId]?.includes(activeId)) return true;
  if (PIN_ALIASES[activeId]?.includes(pinId)) return true;
  const normA = pinId.replace(/^(tactical|visa|job|gc)-/, "");
  const normB = activeId.replace(/^(tactical|visa|job|gc)-/, "");
  return normA === normB;
}

type PinPopoverData = {
  id: string;
  label: string;
  dateLabel: string;
  percent: number;
  tone: JourneyTrackTone;
  status: "past" | "today" | "upcoming" | "urgent";
  detail: string;
  daysDiff?: number;
  isToday?: boolean;
};

function PinInspectionPopover({
  pin,
  onClose,
  onViewMatchingCard,
  position = "top"
}: {
  pin: PinPopoverData;
  onClose: () => void;
  onViewMatchingCard?: () => void;
  position?: "top" | "bottom" | "inline";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (position === "inline") {
      const invokingElement = document.activeElement as HTMLElement | null;
      const timer = setTimeout(() => {
        dialogRef.current?.focus();
      }, 0);
      return () => {
        clearTimeout(timer);
        invokingElement?.focus();
      };
    }
  }, [position]);

  const isToday = Boolean(pin.isToday || pin.id.includes("today"));
  const daysDiff = pin.daysDiff;

  const countdownText = isToday
    ? "Today"
    : typeof daysDiff === "number"
      ? daysDiff === 0
        ? "Today"
        : daysDiff > 0
          ? `${daysDiff}d left`
          : `${Math.abs(daysDiff)}d ago`
      : null;

  return (
    <div
      ref={dialogRef}
      tabIndex={position === "inline" ? -1 : undefined}
      data-pin-popover
      role="dialog"
      aria-label={`${pin.label} inspection details`}
      className={cn(
        "z-50 rounded-[var(--radius-xl)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] p-3.5 shadow-xl transition-all pointer-events-auto",
        position === "inline"
          ? "static w-full max-w-full translate-x-0 focus:outline-none"
          : "absolute w-72 max-w-[calc(100vw-32px)] -translate-x-1/2",
        position === "top"
          ? "bottom-full mb-3"
          : position === "bottom"
            ? "top-full mt-3"
            : ""
      )}
      style={
        position === "inline"
          ? undefined
          : {
              left: `clamp(148px, ${pin.percent}%, calc(100% - 148px))`
            }
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              TONE_BADGE_CLASS[pin.tone]
            )}
          >
            {isToday || pin.status === "today"
              ? "Anchor"
              : pin.status === "urgent"
                ? "Critical"
                : pin.status === "past"
                  ? "Elapsed"
                  : "Upcoming"}
          </span>
          {countdownText && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                isToday || pin.status === "urgent"
                  ? "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)] border border-[var(--haven-blush)]"
                  : "bg-[var(--haven-sand)] text-[var(--haven-ink)]"
              )}
            >
              {countdownText}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="rounded-full p-1 text-[var(--haven-ink-mid)] hover:bg-[var(--haven-sand)] hover:text-[var(--haven-ink)] transition-colors cursor-pointer"
          aria-label="Close milestone inspection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <h5 className="mt-2 text-body-sm font-bold text-[var(--haven-ink)] leading-snug">
        {pin.label}
      </h5>

      <p className="mt-0.5 text-[12px] font-medium text-[var(--haven-ink-mid)]">
        {pin.dateLabel}
      </p>

      {pin.detail && (
        <p className="mt-2 border-t border-[var(--color-border)] pt-2 text-[12px] leading-relaxed text-[var(--haven-ink-mid)]">
          {pin.detail}
        </p>
      )}

      {onViewMatchingCard && (
        <div className="mt-2.5 border-t border-[var(--color-border)] pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewMatchingCard();
            }}
            className="text-[11px] font-semibold text-[var(--haven-ink)] hover:text-[var(--haven-ink-mid)] underline underline-offset-2 cursor-pointer transition-colors"
          >
            View matching milestone ↓
          </button>
        </div>
      )}
    </div>
  );
}

export function ImmigrationJourneyDashboard({
  journey,
  profile,
  initialStatusEndDate
}: {
  journey: ImmigrationJourneyView;
  profile: ImmigrationProfile;
  initialStatusEndDate?: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showCapturedDataDrawer, setShowCapturedDataDrawer] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeInspectedPinId, setActiveInspectedPinId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeInspectedPinId) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveInspectedPinId(null);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        !target.closest("[data-pin-popover]") &&
        !target.closest("[data-pin-trigger]") &&
        !target.closest("[data-pin-match]")
      ) {
        setActiveInspectedPinId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeInspectedPinId]);

  const scrollToMilestone = (pinId: string) => {
    if (typeof document === "undefined") return;
    const targets = [
      pinId,
      ...(PIN_ALIASES[pinId] ?? []),
      pinId.replace(/^(visa|job|gc)-/, "tactical-"),
      pinId.replace(/^tactical-/, "job-"),
      pinId.replace(/^tactical-/, "visa-"),
      pinId.replace(/^tactical-/, "gc-")
    ];
    for (const t of targets) {
      const elem =
        document.getElementById(`milestone-card-${t}`) ||
        document.getElementById(`gc-stage-node-${t}`) ||
        document.querySelector(`[data-pin-match="${t}"]`);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        break;
      }
    }
  };

  const handleSelectPin = (pinId: string) => {
    setActiveInspectedPinId((prev) => (isPinActive(pinId, prev) ? null : pinId));
  };

  const { axis, visaTrack, jobTrack, greenCardTrack, overlayInsights, missingFields, tacticalWindow, protection, intakeAudit } = journey;
  const primaryTrack = greenCardTrack.tracks.find((t) => t.isPrimary) ?? greenCardTrack.tracks[0] ?? null;
  const otherTracks = greenCardTrack.tracks.filter((t) => t !== primaryTrack);

  const hasMilestoneTarget = (pinId: string): boolean => {
    const targets = [
      pinId,
      ...(PIN_ALIASES[pinId] ?? []),
      pinId.replace(/^(visa|job|gc)-/, "tactical-"),
      pinId.replace(/^tactical-/, "job-"),
      pinId.replace(/^tactical-/, "visa-"),
      pinId.replace(/^tactical-/, "gc-")
    ];
    return targets.some((t) => {
      const matchTactical = tacticalWindow.pins.some((p) => p.id === t);
      const matchGcNode = greenCardTrack.nodes.some(
        (n) =>
          n.key === t ||
          (t === "gc-pd" && n.key === "priority_date") ||
          (t === "gc-i140" && n.key === "i140")
      );
      return matchTactical || matchGcNode;
    });
  };

  const hasUrgentDeadline =
    (protection.effectiveStayDaysRemaining !== null && protection.effectiveStayDaysRemaining <= 60) ||
    (protection.urgentDeadlineDaysRemaining !== null && protection.urgentDeadlineDaysRemaining <= 60);

  const displayDaysRemaining =
    protection.effectiveStayDaysRemaining ?? protection.urgentDeadlineDaysRemaining;
  const displayEndLabel =
    protection.effectiveStayEndLabel ?? protection.urgentDeadlineLabel;

  // Consolidate Visa and Job & Sponsor into a unified work visa track
  const isGrace = jobTrack.lifecycleState === "grace_period";
  const combinedVisaJobBadge = isGrace ? jobTrack.statusBadge : visaTrack.statusBadge;
  const combinedVisaJobTone = isGrace ? jobTrack.statusTone : visaTrack.statusTone;
  const combinedVisaJobSubtitle = jobTrack.employerName
    ? `${jobTrack.jobTitle ? `${jobTrack.jobTitle} @ ` : ""}${jobTrack.employerName}${
        visaTrack.effectiveStayEndLabel
          ? ` · Stay ends ${visaTrack.effectiveStayEndLabel}`
          : visaTrack.expiryDateLabel
            ? ` · Valid through ${visaTrack.expiryDateLabel}`
            : ""
      }`
    : visaTrack.effectiveStayEndLabel
      ? `Stay through ${visaTrack.effectiveStayEndLabel}`
      : visaTrack.expiryDateLabel
        ? `Valid through ${visaTrack.expiryDateLabel}`
        : "Status validity";

  const combinedVisaJobSegments = (() => {
    if (isGrace && jobTrack.segments.length > 0) {
      const capSegment = visaTrack.segments.find((s) => s.id === "visa-cap-window");
      return capSegment ? [...jobTrack.segments, capSegment] : jobTrack.segments;
    }
    return visaTrack.segments;
  })();

  const combinedVisaJobPins = (() => {
    const pins: typeof visaTrack.pins = [];
    const seen = new Set<string>();
    const candidatePins = [...jobTrack.pins, ...visaTrack.pins];
    for (const pin of candidatePins) {
      if (
        pin.id === "visa-expiry" &&
        candidatePins.some((p) => p.id === "visa-stay-deadline" || p.id === "job-grace-end")
      ) {
        continue;
      }
      if (
        pin.id === "job-grace-end" &&
        candidatePins.some((p) => p.id === "visa-stay-deadline")
      ) {
        continue;
      }
      const key = `${pin.isoDate}-${pin.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pins.push(pin);
    }
    return pins.sort((a, b) => a.percent - b.percent);
  })();

  function handleSaveDates(formData: FormData) {
    setSaveMessage(null);
    startTransition(async () => {
      try {
        await saveCaseJourneyDatesAction(formData);
        setIsEditing(false);
        setSaveMessage("Journey dates updated across your Case timeline.");
        router.refresh();
      } catch {
        setSaveMessage("Could not save dates right now. Please try again.");
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--color-border)] bg-[var(--haven-cream)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 w-full">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-label">
                <Layers className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                Overlaid immigration journey
              </span>
              <Badge variant="community">2 tracks synchronized</Badge>
            </div>
            <CardTitle className="mt-2 text-h2">
              Where you are across Visa & Job and Green Card
            </CardTitle>
            <p className="text-body-sm mt-1 max-w-[66ch] text-[var(--color-text-secondary)]">
              Your visa validity and sponsoring employment overlaid alongside your green card queue on a shared timeline so you can see how renewals, caps, and priority dates line up.
            </p>
          </div>

          <Button
            onClick={() => {
              setSaveMessage(null);
              setIsEditing((prev) => !prev);
            }}
            size="sm"
            type="button"
            variant={isEditing ? "ghost" : "outline"}
          >
            {isEditing ? (
              <>
                <X className="mr-1.5 h-4 w-4" />
                Close editor
              </>
            ) : (
              <>
                <PencilLine className="mr-1.5 h-4 w-4" />
                Update journey dates
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {saveMessage && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm text-[var(--haven-ink)]">
            {saveMessage}
          </div>
        )}

        {missingFields.length > 0 && !isEditing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-4 py-3">
            <p className="text-body-sm text-[var(--haven-ink)]">
              Add your <strong>{missingFields.join(", ")}</strong> to plot exact start and expiration bars on your overlaid timeline.
            </p>
            <button
              className="text-body-sm font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Add missing dates
            </button>
          </div>
        )}

        {/* Inline Quick-Edit Drawer */}
        {isEditing && (
          <form
            action={handleSaveDates}
            className="rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--haven-cream)] p-5 space-y-5"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
              <div>
                <p className="text-label">Quick edit</p>
                <h3 className="text-h3 mt-0.5">Update your Visa, Employment, and Green Card dates</h3>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="journey-visaType">
                  Current visa status
                </label>
                <Select defaultValue={profile.visaType ?? ""} id="journey-visaType" name="visaType">
                  {!profile.visaType && <option value="">Select visa status</option>}
                  {["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="field-label" htmlFor="journey-h1bStartDate">
                  Visa / H-1B start date
                </label>
                <Input
                  defaultValue={profile.h1bStartDate ?? ""}
                  id="journey-h1bStartDate"
                  name="h1bStartDate"
                  type="date"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="journey-statusEndDate">
                  Current visa expiration date
                </label>
                <Input
                  defaultValue={initialStatusEndDate || profile.currentVisaExpiryDate || ""}
                  id="journey-statusEndDate"
                  name="statusEndDate"
                  type="date"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="journey-employerName">
                  Sponsoring employer
                </label>
                <Input
                  defaultValue={profile.employerName ?? ""}
                  id="journey-employerName"
                  name="employerName"
                  placeholder="e.g. Nimbus AI"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="journey-jobTitle">
                  Job title
                </label>
                <Input
                  defaultValue={profile.jobTitle ?? ""}
                  id="journey-jobTitle"
                  name="jobTitle"
                  placeholder="e.g. Staff Software Engineer"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="journey-countryOfBirth">
                  Country of birth
                </label>
                <Select defaultValue={profile.countryOfBirth ?? ""} id="journey-countryOfBirth" name="countryOfBirth">
                  {!profile.countryOfBirth && <option value="">Select country</option>}
                  {[
                    ...(profile.countryOfBirth && !COUNTRY_OPTIONS.includes(profile.countryOfBirth)
                      ? [profile.countryOfBirth]
                      : []),
                    ...COUNTRY_OPTIONS
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="field-label" htmlFor="journey-greenCardStage">
                  Green card stage
                </label>
                <Select defaultValue={greenCardTrack.stage} id="journey-greenCardStage" name="greenCardStage">
                  <option value="not_started">Not started yet</option>
                  <option value="perm_in_progress">PERM in progress</option>
                  <option value="perm_certified">PERM certified</option>
                  <option value="i140_filed">I-140 filed</option>
                  <option value="i140_approved">I-140 approved</option>
                  <option value="i485_filed">I-485 filed</option>
                </Select>
              </div>

              <div>
                <label className="field-label" htmlFor="journey-preferenceCategory">
                  Preference category
                </label>
                <Select defaultValue={profile.preferenceCategory ?? ""} id="journey-preferenceCategory" name="preferenceCategory">
                  {!profile.preferenceCategory && <option value="">Select preference category</option>}
                  {["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="field-label" htmlFor="journey-priorityDate">
                  Priority date
                </label>
                <Input
                  defaultValue={profile.priorityDate ?? ""}
                  id="journey-priorityDate"
                  name="priorityDate"
                  type="date"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <Button onClick={() => setIsEditing(false)} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={isPending} size="sm" type="submit">
                {isPending ? "Saving..." : "Save & update overlay"}
              </Button>
            </div>
          </form>
        )}

        {/* =================================================================== */}
        {/* SYNCHRONIZED DUAL-RESOLUTION TIMELINE OVERLAY                       */}
        {/* =================================================================== */}
        <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-label">Synchronized timeline overlay</p>
                <span className="rounded-full bg-[var(--haven-sky-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-sky-ink)]">
                  Dual-resolution
                </span>
              </div>
              <h3 className="text-h3 mt-1">Visa, Job, and Green Card tracks on one shared time axis</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--haven-ink-mid)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--haven-sage)]" />
                Completed / Elapsed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[var(--haven-sky)]" />
                Active / Upcoming window
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#d98a6c]" />
                Expiring / Urgent window
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--haven-ink)]">
                <span className="h-3 w-0.5 bg-[var(--haven-ink)]" />
                Today ({axis.todayLabel})
              </span>
            </div>
          </div>

          {/* Urgent Action Spotlight Banner */}
          {hasUrgentDeadline && (
            <div className="mt-4 rounded-[var(--radius-xl)] border border-[var(--haven-blush)] bg-gradient-to-r from-[var(--haven-blush-light)] via-[var(--haven-cream)] to-[var(--haven-white)] p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--haven-blush)] text-[var(--haven-cream)] shadow-xs">
                    <CircleAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--haven-blush-ink)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--haven-cream)]">
                        Urgent Stay Window
                      </span>
                      <span className="text-[12px] font-bold text-[var(--haven-blush-ink)]">
                        {displayDaysRemaining !== null
                          ? displayDaysRemaining > 0
                            ? `${displayDaysRemaining} days remaining`
                            : displayDaysRemaining === 0
                              ? "Expires today"
                              : `Expired ${Math.abs(displayDaysRemaining)}d ago`
                          : "Action required"}
                      </span>
                    </div>
                    <h4 className="mt-1 text-h3 text-[var(--haven-ink)]">
                      {displayDaysRemaining === null || displayEndLabel === null
                        ? "Authorized stay deadline unavailable"
                        : displayDaysRemaining >= 0
                          ? protection.effectiveStayEndLabel === null
                            ? `Recorded status end date: ${displayEndLabel}`
                            : `Authorized stay deadline: ${displayEndLabel}`
                          : protection.effectiveStayEndLabel === null
                            ? `Recorded status end date passed on ${displayEndLabel}`
                            : `Authorized stay deadline passed on ${displayEndLabel}`}
                    </h4>
                    <p className="mt-1 text-body-sm leading-relaxed text-[var(--color-text-secondary)] max-w-[70ch]">
                      {protection.reconciliationNotice ??
                        `Under 8 CFR § 214.1(l)(2), you have ${displayDaysRemaining ?? 0} days remaining to file a change of status, submit an H-1B transfer petition, or arrange departure.`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end shrink-0">
                  <Link
                    className={cn(
                      buttonVariants({ variant: "default", size: "sm" }),
                      "bg-[var(--haven-ink)] text-[var(--haven-cream)] hover:bg-[var(--haven-ink-mid)] shadow-xs"
                    )}
                    href="/advisor"
                  >
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Consult attorney on options
                  </Link>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "border-[var(--color-border-strong)] text-[var(--haven-ink)] hover:bg-[var(--haven-white)]"
                    )}
                    href="/documents"
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    Upload I-94 records
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Macro Horizon Section */}
          <div className="mt-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                Macro Horizon (Multi-Year Trajectory)
              </span>
              <span className="text-[11px] text-[var(--haven-ink-light)] hidden sm:inline">
                Shaded box marks the immediate focus zone (90 days back to 180 days ahead)
              </span>
            </div>

            {/* Shared Time Axis Header */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
              <div className="hidden lg:flex items-end pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                  Journey track
                </span>
              </div>

              <div className="relative h-8 select-none">
                {/* Focus zone indicator bar in header */}
                {axis.macroBracket && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-1 rounded-sm bg-[var(--haven-ink)]/[0.06] border-x border-dashed border-[var(--haven-ink)]/30 pointer-events-none"
                    style={{
                      left: `${axis.macroBracket.startPercent}%`,
                      width: `${Math.max(2, axis.macroBracket.endPercent - axis.macroBracket.startPercent)}%`
                    }}
                  />
                )}

                {/* Axis ticks */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--color-border-mid)]" />
                {axis.ticks.map((tick, idx) => (
                  <div
                    key={`${tick.label}-${idx}`}
                    className="absolute bottom-1 -translate-x-1/2 text-[11px] font-medium text-[var(--haven-ink-light)]"
                    style={{ left: `${tick.percent}%` }}
                  >
                    {tick.label}
                  </div>
                ))}

                {/* Prominent Today Badge at Top of Axis */}
                <div
                  className="absolute -top-1 z-10 -translate-x-1/2"
                  style={{ left: `${axis.todayPercent}%` }}
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-ink)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--haven-cream)] shadow-sm whitespace-nowrap">
                    <Flag className="h-2.5 w-2.5" />
                    You are here
                  </span>
                </div>
              </div>
            </div>

            {/* Two Overlaid Macro Swimlanes */}
            <div className="mt-2 divide-y divide-[var(--color-border)]">
              <OverlaySwimlane
                badge={combinedVisaJobBadge}
                badgeTone={combinedVisaJobTone}
                macroBracket={axis.macroBracket}
                pins={combinedVisaJobPins}
                segments={combinedVisaJobSegments}
                subtitle={combinedVisaJobSubtitle}
                title={`Visa · ${visaTrack.visaType} & Sponsor`}
                todayPercent={axis.todayPercent}
                activePinId={activeInspectedPinId}
                onSelectPin={handleSelectPin}
                onScrollToMilestone={scrollToMilestone}
                hasMilestoneTarget={hasMilestoneTarget}
              />

              <OverlaySwimlane
                badge={greenCardTrack.statusBadge}
                badgeTone={greenCardTrack.statusTone}
                macroBracket={axis.macroBracket}
                pins={greenCardTrack.pins}
                segments={greenCardTrack.segments}
                subtitle={`${greenCardTrack.categoryLabel}${greenCardTrack.priorityDateLabel ? ` · PD ${greenCardTrack.priorityDateLabel}` : ""}`}
                title="Green Card"
                todayPercent={axis.todayPercent}
                activePinId={activeInspectedPinId}
                onSelectPin={handleSelectPin}
                onScrollToMilestone={scrollToMilestone}
                hasMilestoneTarget={hasMilestoneTarget}
              />
            </div>
          </div>

          {/* Tactical 90-Day Zoom Window */}
          <TacticalTimelineWindow
            tacticalWindow={tacticalWindow}
            activePinId={activeInspectedPinId}
            onSelectPin={handleSelectPin}
            onScrollToMilestone={scrollToMilestone}
          />
        </div>

        {/* =================================================================== */}
        {/* RECONCILED JOURNEY TRACK SUMMARY CARDS                              */}
        {/* =================================================================== */}
        <div className="space-y-3">
          <div>
            <p className="text-label">Track reconciliation & next steps</p>
            <h3 className="text-h3 mt-0.5">Key dates and legal protections by track</h3>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Card 1: Visa & Sponsoring Employer Card */}
            <div className="flex flex-col justify-between rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-xs">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-label">
                    <Briefcase className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                    Track 1 · {visaTrack.visaType} & Sponsoring Employer
                  </span>
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", TONE_BADGE_CLASS[combinedVisaJobTone])}>
                    {combinedVisaJobBadge}
                  </span>
                </div>

                <h3 className="mt-3 text-h3 text-[var(--haven-ink)]">
                  {jobTrack.jobTitle ? `${jobTrack.jobTitle} @ ` : ""}{jobTrack.employerName ?? `${visaTrack.visaType} Status`}
                </h3>
                <p className="mt-1 text-body-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {isGrace ? jobTrack.summary : visaTrack.summary}
                </p>

                {visaTrack.reconciliationNotice && (
                  <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-3 py-2 text-[12px] font-medium leading-relaxed text-[var(--haven-blush-ink)]">
                    {visaTrack.reconciliationNotice}
                  </div>
                )}

                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-3 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--haven-ink-mid)]">Visa category</dt>
                    <dd className="font-semibold text-[var(--haven-ink)]">{visaTrack.visaType}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--haven-ink-mid)]">Sponsoring employer</dt>
                    <dd className="font-semibold text-[var(--haven-ink)]">{jobTrack.employerName ?? "Not recorded"}</dd>
                  </div>
                  {jobTrack.jobTitle && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">Job title</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{jobTrack.jobTitle}</dd>
                    </div>
                  )}
                  {visaTrack.startDateLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">Status start date</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{visaTrack.startDateLabel}</dd>
                    </div>
                  )}
                  {jobTrack.lastWorkDayLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">Last day of work</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{jobTrack.lastWorkDayLabel}</dd>
                    </div>
                  )}
                  {jobTrack.graceEndLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">60-day calendar limit</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{jobTrack.graceEndLabel}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--haven-ink-mid)]">I-94 / Expiration date</dt>
                    <dd className="font-semibold text-[var(--haven-ink)]">{visaTrack.expiryDateLabel ?? "Not set"}</dd>
                  </div>
                  {visaTrack.effectiveStayEndLabel && (
                    <div className="flex items-center justify-between gap-2 sm:col-span-2 rounded-md bg-[var(--haven-sand)]/60 px-2.5 py-1">
                      <dt className="text-[var(--haven-ink)] font-semibold">Effective authorized stay</dt>
                      <dd className="font-bold text-[var(--haven-ink)]">
                        {visaTrack.effectiveStayEndLabel}
                        {visaTrack.effectiveStayDaysRemaining !== null ? ` (${visaTrack.effectiveStayDaysRemaining}d left)` : ""}
                      </dd>
                    </div>
                  )}
                  {jobTrack.portabilityLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">AC21 portability</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{jobTrack.portabilityLabel}</dd>
                    </div>
                  )}
                  {visaTrack.capDateLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">6-year statutory max</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{visaTrack.capDateLabel}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-3">
                <Link
                  className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                  href="/advisor"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Consult attorney on bridge options
                </Link>
                <Link
                  className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                  href="/documents"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Upload I-94 & visa records
                </Link>
              </div>
            </div>

            {/* Card 2: Green Card Track Card */}
            <div className="flex flex-col justify-between rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-xs">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-label">
                    <Compass className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                    Track 2 · Green Card & Immigrant Petition
                  </span>
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", TONE_BADGE_CLASS[greenCardTrack.statusTone])}>
                    {greenCardTrack.statusBadge}
                  </span>
                </div>

                <h3 className="mt-3 text-h3 text-[var(--haven-ink)]">{greenCardTrack.headline}</h3>
                <p className="mt-1 text-body-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {greenCardTrack.summary}
                </p>

                {greenCardTrack.retainedPriorityDateLabel && (
                  <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-3 text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--haven-ink)] flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--haven-sage-strong)]" />
                        Retained Priority Date (8 CFR § 204.5(e))
                      </span>
                      <span className="font-bold text-[var(--haven-ink)]">{greenCardTrack.retainedPriorityDateLabel}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--haven-ink-mid)] leading-relaxed">
                      Kept from {greenCardTrack.retainedSponsorName ?? "an earlier employer's approved I-140"}.{" "}
                      {greenCardTrack.activePetitionSponsor
                        ? `Sets your place in line while ${greenCardTrack.activePetitionSponsor} completes PERM and a new I-140.`
                        : "It carries over to your next employer's green card."}
                    </p>
                  </div>
                )}

                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-3 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--haven-ink-mid)]">Preference category</dt>
                    <dd className="font-semibold text-[var(--haven-ink)]">{greenCardTrack.categoryLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[var(--haven-ink-mid)]">Priority date</dt>
                    <dd className="font-semibold text-[var(--haven-ink)]">
                      {greenCardTrack.priorityDateLabel ?? "Not locked yet"}
                    </dd>
                  </div>
                  {greenCardTrack.bulletinCutoffLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">Visa Bulletin cutoff</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{greenCardTrack.bulletinCutoffLabel}</dd>
                    </div>
                  )}
                  {greenCardTrack.estimatedRangeLabel && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--haven-ink-mid)]">Projected horizon</dt>
                      <dd className="font-semibold text-[var(--haven-ink)]">{greenCardTrack.estimatedRangeLabel}</dd>
                    </div>
                  )}
                </dl>

              </div>

              <div className="mt-5 border-t border-[var(--color-border)] pt-3">
                <a
                  className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                  href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Check official Visa Bulletin
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* GREEN CARD 5-STAGE PROGRESSION                                      */}
        {/* =================================================================== */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-label">Permanent residency stages</p>
              <h3 className="text-h3 mt-0.5">
                {greenCardTrack.tracks.length > 1 ? "Your green cards" : "Green card milestone progression"}
              </h3>
              {greenCardTrack.priorityDateLabel && (
                <p className="mt-1 text-body-sm text-[var(--haven-ink-mid)]">
                  Priority date <span className="font-semibold text-[var(--haven-ink)]">{greenCardTrack.priorityDateLabel}</span>
                  {greenCardTrack.priorityDateSourceName ? ` · from ${greenCardTrack.priorityDateSourceName}` : ""}
                  {greenCardTrack.tracks.length > 1 ? " · carries over to whichever green card moves forward" : ""}
                </p>
              )}
            </div>
            {greenCardTrack.bulletinCutoffLabel && (
              <span className="rounded-full bg-[var(--haven-sky-light)] px-3 py-1 text-[12px] font-medium text-[var(--haven-sky-ink)]">
                Bulletin cutoff · {greenCardTrack.bulletinCutoffLabel}
              </span>
            )}
          </div>

          {greenCardTrack.tracks.length > 1 && primaryTrack && (
            <PetitionTrackHeader track={primaryTrack} />
          )}

          <div className="relative">
            <div
              aria-label="Permanent residency stages"
              className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--haven-ink)] [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]"
              role="region"
              tabIndex={0}
            >
              {greenCardTrack.nodes.map((node, index) => {
                const isCompleted = node.status === "completed";
                const isCurrent = node.status === "current";
                const isNodeActive = isPinActive(node.key, activeInspectedPinId);

                return (
                  <div
                    key={node.key}
                    id={`gc-stage-node-${node.key}`}
                    data-pin-match={node.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`Green card stage ${index + 1}: ${node.label}. ${isNodeActive ? "Inspected" : "Click to inspect"}`}
                    onClick={() =>
                      handleSelectPin(
                        node.key === "priority_date"
                          ? "gc-pd"
                          : node.key === "i140"
                            ? "gc-i140"
                            : node.key
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectPin(
                          node.key === "priority_date"
                            ? "gc-pd"
                            : node.key === "i140"
                              ? "gc-i140"
                              : node.key
                        );
                      }
                    }}
                    className={cn(
                      "relative flex flex-col justify-between rounded-[var(--radius-xl)] border p-5 transition-all shrink-0 snap-start cursor-pointer select-none",
                      "w-[300px] sm:w-[320px] md:w-[calc((100%-32px)/3)] min-w-[280px] md:min-w-0",
                      isNodeActive && "ring-2 ring-[var(--haven-ink)] ring-offset-2 -translate-y-1 shadow-md",
                      isCompleted
                        ? "border-[var(--haven-sage-mid)] bg-[var(--haven-white)] shadow-xs"
                        : isCurrent
                          ? "border-[var(--haven-ink)] bg-[var(--haven-cream)] ring-1 ring-[var(--haven-ink)] shadow-xs"
                          : "border-[var(--color-border)] bg-[var(--haven-white)] opacity-75 hover:opacity-100"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                          Stage {index + 1}
                        </span>
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-sage-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-ink)]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--haven-sage-strong)]" />
                            Completed
                          </span>
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-ink)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-cream)]">
                            <ShieldCheck className="h-3.5 w-3.5 text-[var(--haven-cream)]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-sand)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--haven-ink-mid)]">
                            <Clock className="h-3 w-3" />
                            Upcoming
                          </span>
                        )}
                      </div>

                      <p className="mt-3.5 text-h3 text-[var(--haven-ink)]">{node.shortLabel}</p>
                      <p className="mt-1 text-[13px] font-semibold text-[var(--haven-ink)]">{node.badgeText}</p>
                      <p className="mt-2 text-body-sm leading-relaxed text-[var(--color-text-secondary)]">
                        {node.detail}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-[var(--color-border)] pt-3">
                      <p
                        className={cn(
                          "text-[12px] font-medium",
                          isCompleted
                            ? "text-[var(--haven-ink)]"
                            : isCurrent
                              ? "text-[var(--haven-ink)]"
                              : "text-[var(--haven-ink-light)]"
                        )}
                      >
                        {node.dateOrMeta}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {otherTracks.length > 0 && (
            <div className="space-y-3 pt-1">
              {otherTracks.map((track) => (
                <PetitionTrackRow key={track.id} track={track} />
              ))}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* CROSS-TRACK OVERLAY INSIGHTS                                        */}
        {/* =================================================================== */}
        <div className="grid gap-3 md:grid-cols-2">
          {overlayInsights.map((insight) => (
            <div
              key={insight.id}
              className={cn(
                "rounded-[var(--radius-xl)] border p-4",
                insight.tone === "blush"
                  ? "border-[var(--haven-blush)] bg-[var(--haven-blush-light)]"
                  : insight.tone === "sage"
                    ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]"
                    : "border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)]"
              )}
            >
              <div className="flex items-center gap-2">
                {insight.tone === "blush" ? (
                  <CircleAlert className="h-4 w-4 text-[var(--haven-blush-ink)]" />
                ) : (
                  <Sparkles className="h-4 w-4 text-[var(--haven-ink)]" />
                )}
                <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{insight.title}</p>
              </div>
              <p className="mt-1.5 text-body-sm text-[var(--haven-ink-mid)]">{insight.body}</p>
            </div>
          ))}
        </div>

        {/* =================================================================== */}
        {/* INTAKE DATA AUDIT, MISSING INFORMATION & CLIENT RISK WARNINGS       */}
        {/* =================================================================== */}
        {intakeAudit && (
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-cream)]/60 p-4 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-label">Intake-to-Dashboard Diagnostic & Client Risk Audit</span>
                  {intakeAudit.criticalWarningCount > 0 ? (
                    <span className="rounded-full bg-[var(--haven-blush-ink)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--haven-cream)]">
                      {intakeAudit.criticalWarningCount} critical client warning{intakeAudit.criticalWarningCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {intakeAudit.missingCount > 0 ? (
                    <span className="rounded-full border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-blush-ink)]">
                      {intakeAudit.missingCount} missing / unverified item{intakeAudit.missingCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-ink)]">
                      All core intake items verified
                    </span>
                  )}
                </div>
                <h3 className="text-h3 mt-1.5 text-[var(--haven-ink)]">
                  What Haven captured from your intake, what is still missing, and active client warnings
                </h3>
                <p className="text-body-sm mt-1 max-w-[72ch] text-[var(--color-text-secondary)]">
                  Every warning and missing item below is derived live from your onboarding setup, deadline answers, uploaded documents, and firm checklist so you can see exactly how client risk alerts and intake gaps are surfaced.
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-3.5 py-1 text-[12px] font-semibold text-[var(--haven-ink)]">
                  {intakeAudit.capturedCount} captured · {intakeAudit.missingCount} missing · {intakeAudit.completenessPercent}% complete
                </span>
                <div className="w-44 h-2 rounded-full bg-[var(--haven-sand)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--haven-ink)] transition-all duration-300"
                    style={{ width: `${intakeAudit.completenessPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 1. Active Client Legal & Timeline Warnings */}
            {intakeAudit.clientWarnings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--haven-blush-ink)]">
                    Active Client Warnings ({intakeAudit.clientWarnings.length}) · How Haven warns clients on high-risk dates
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {intakeAudit.clientWarnings.map((warning) => {
                    const isCritical = warning.severity === "critical";
                    return (
                      <div
                        key={warning.id}
                        className={cn(
                          "flex flex-col justify-between rounded-[var(--radius-xl)] border p-4 shadow-2xs",
                          isCritical
                            ? "border-[var(--haven-blush)] bg-[var(--haven-white)] ring-1 ring-[var(--haven-blush)]/40"
                            : "border-[var(--color-border)] bg-[var(--haven-white)]"
                        )}
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                isCritical
                                  ? "bg-[var(--haven-blush-ink)] text-[var(--haven-cream)]"
                                  : "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)] border border-[var(--haven-blush)]"
                              )}
                            >
                              <CircleAlert className="h-3 w-3" />
                              {warning.badge}
                            </span>
                            <span className="rounded-full bg-[var(--haven-sand)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--haven-ink-mid)]">
                              {warning.ruleCitation}
                            </span>
                          </div>

                          <h4 className="mt-2.5 text-body-sm font-bold text-[var(--haven-ink)] leading-snug">
                            {warning.title}
                          </h4>
                          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                            {warning.body}
                          </p>
                          <div className="mt-2.5 rounded-[var(--radius-lg)] bg-[var(--haven-cream)] p-2.5 text-[11px] leading-relaxed text-[var(--haven-ink)] border border-[var(--color-border)]">
                            {warning.clientGuidance}
                          </div>
                        </div>

                        <div className="mt-3 border-t border-[var(--color-border)] pt-2.5 flex items-center justify-between">
                          <Link
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                            href={warning.actionHref}
                          >
                            {warning.actionLabel} →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Missing Information, Unuploaded Documents & Intake Verification Gaps */}
            {intakeAudit.missingItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                    Missing Information & Verification Gaps ({intakeAudit.missingItems.length}) · Labeled across your profile & vault
                  </p>
                  <span className="text-[11px] text-[var(--haven-ink-mid)]">
                    Required Firm Documents: {intakeAudit.fulfilledRequiredDocumentCount} of {intakeAudit.requiredDocumentCount} uploaded
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {intakeAudit.missingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 shadow-2xs"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              TONE_BADGE_CLASS[item.tone]
                            )}
                          >
                            {item.badge}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--haven-ink-light)]">
                            {item.category === "document"
                              ? "Document Vault"
                              : item.category === "verification"
                                ? "Attorney Verification"
                                : "Intake Field"}
                          </span>
                        </div>

                        <h4 className="mt-2 text-body-sm font-bold text-[var(--haven-ink)] leading-snug">
                          {item.title}
                        </h4>
                        <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                          {item.detail}
                        </p>
                        <p className="mt-2 text-[11px] font-medium text-[var(--haven-blush-ink)]">
                          Why it matters: {item.impact}
                        </p>
                      </div>

                      <div className="mt-3 border-t border-[var(--color-border)] pt-2.5">
                        <Link
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                          href={item.actionHref}
                        >
                          {item.actionLabel} →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Captured Intake Data Mapping (Collapsible / Scannable) */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={() => setShowCapturedDataDrawer((prev) => !prev)}
                className="flex w-full flex-wrap items-center justify-between gap-2 text-left cursor-pointer"
              >
                <div>
                  <p className="text-body-sm font-bold text-[var(--haven-ink)]">
                    Captured Intake & Resume Data Mapping ({intakeAudit.capturedFields.length} fields wired to dashboard)
                  </p>
                  <p className="text-[12px] text-[var(--haven-ink-mid)]">
                    See how each answer from your intake, deadline setup, and uploaded resumes maps into your dashboard tracks and whether an official notice verifies it.
                  </p>
                </div>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-1 text-[12px] font-semibold text-[var(--haven-ink)]">
                  {showCapturedDataDrawer ? "Hide captured data ↑" : "Inspect captured data ↓"}
                </span>
              </button>

              {showCapturedDataDrawer && (
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {intakeAudit.capturedFields.map((field) => (
                    <div
                      key={field.id}
                      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3 text-[12px]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold text-[var(--haven-ink-mid)]">{field.label}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            field.verifiedByDocument
                              ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)] border border-[var(--haven-sage-mid)]"
                              : "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)] border border-[var(--color-border)]"
                          )}
                        >
                          {field.verifiedByDocument ? "Verified in Vault" : "Self-reported · Unverified"}
                        </span>
                      </div>
                      <p className="mt-1 font-bold text-[var(--haven-ink)]">{field.value}</p>
                      <p className="mt-1 text-[11px] text-[var(--haven-ink-light)]">
                        Source: {field.sourceLabel} → {field.mapsToTrack}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TRACK_TONE_BADGE: Record<PetitionTrack["tone"], string> = {
  active: "bg-[var(--haven-sky-light)] text-[var(--haven-sky-ink)] border-[var(--haven-sky-mid)]",
  protected: "bg-[var(--haven-sage-light)] text-[var(--haven-ink)] border-[var(--haven-sage-mid)]",
  ended: "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)] border-[var(--color-border)]"
};

const TRACK_TONE_LABEL: Record<PetitionTrack["tone"], string> = {
  active: "In progress",
  protected: "Protected",
  ended: "Ended"
};

function PetitionTrackHeader({ track }: { track: PetitionTrack }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Briefcase className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
      <span className="text-body-sm font-semibold text-[var(--haven-ink)]">{track.sponsorName}</span>
      <span className="rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-2 py-0.5 text-[10px] font-semibold text-[var(--haven-ink-mid)]">
        {track.categoryLabel}
      </span>
      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", TRACK_TONE_BADGE[track.tone])}>
        {TRACK_TONE_LABEL[track.tone]}
      </span>
      <span className="text-[12px] text-[var(--haven-ink-mid)]">{track.statusLine}</span>
    </div>
  );
}

/** A compact milestone row for a green card other than the main one. */
function PetitionTrackRow({ track }: { track: PetitionTrack }) {
  const isEnded = track.tone === "ended";
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border p-4",
        isEnded
          ? "border-dashed border-[var(--color-border)] bg-[var(--haven-cream)]/60 opacity-70"
          : "border-[var(--color-border)] bg-[var(--haven-white)]"
      )}
      aria-label={`${track.sponsorName} green card: ${track.statusLine}`}
    >
      <PetitionTrackHeader track={track} />
      <ol className="mt-3 flex flex-wrap gap-1.5 sm:grid sm:grid-cols-5">
        {track.stages.map((stage) => (
          <li
            key={stage.key}
            className={cn(
              "rounded-[var(--radius-md)] border px-2 py-1.5 text-center text-[11px] font-medium",
              stage.status === "completed"
                ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                : stage.status === "current"
                  ? "border-[var(--haven-ink)] bg-[var(--haven-cream)] text-[var(--haven-ink)]"
                  : stage.status === "stopped"
                    ? "border-[var(--color-border)] bg-transparent text-[var(--haven-ink-light)] line-through"
                    : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)]"
            )}
          >
            <span className="block whitespace-nowrap sm:truncate">{stage.label}</span>
            <span className="sr-only">
              {stage.status === "completed" ? "done" : stage.status === "current" ? "current step" : stage.status === "stopped" ? "not reached, ended" : "upcoming"}
            </span>
          </li>
        ))}
      </ol>
      {track.notes && <p className="mt-2 text-[11px] italic text-[var(--haven-ink-mid)]">{track.notes}</p>}
    </div>
  );
}

function OverlaySwimlane({
  title,
  subtitle,
  badge,
  badgeTone,
  segments,
  pins,
  todayPercent,
  macroBracket,
  activePinId,
  onSelectPin,
  onScrollToMilestone,
  hasMilestoneTarget
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: JourneyTrackTone;
  segments: JourneyBarSegment[];
  pins: JourneyPlotPin[];
  todayPercent: number;
  macroBracket?: { startPercent: number; endPercent: number };
  activePinId: string | null;
  onSelectPin: (pinId: string) => void;
  onScrollToMilestone?: (pinId: string) => void;
  hasMilestoneTarget?: (pinId: string) => boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 py-4 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-center">
      {/* Left track header */}
      <div className="pr-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{title}</p>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              TONE_BADGE_CLASS[badgeTone]
            )}
          >
            {badge}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--haven-ink-mid)]">{subtitle}</p>
      </div>

      {/* Right synchronized timeline bar + pins */}
      <div className="relative">
        <div className="relative h-9 rounded-lg bg-[var(--haven-cream)] border border-[var(--color-border)] overflow-hidden">
          {/* Shaded focus zone */}
          {macroBracket && (
            <div
              aria-hidden="true"
              className="absolute inset-y-0 bg-[var(--haven-ink)]/[0.05] border-x border-dashed border-[var(--haven-ink)]/25 pointer-events-none"
              style={{
                left: `${macroBracket.startPercent}%`,
                width: `${Math.max(2, macroBracket.endPercent - macroBracket.startPercent)}%`
              }}
            />
          )}

          {/* Plotted segments */}
          {segments.map((seg) => {
            const width = Math.max(2, seg.endPercent - seg.startPercent);
            return (
              <div
                key={seg.id}
                className={cn(
                  "absolute top-2 bottom-2 rounded-md transition-all",
                  TONE_BAR_CLASS[seg.tone],
                  seg.dashed && "opacity-55 border border-dashed border-[var(--haven-ink-mid)]"
                )}
                style={{
                  left: `${seg.startPercent}%`,
                  width: `${width}%`
                }}
                title={seg.label}
              />
            );
          })}

          {/* Vertical Today marker cutting through every lane */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 z-10 w-0.5 bg-[var(--haven-ink)]"
            style={{ left: `${todayPercent}%` }}
          />
        </div>

        {/* Pin buttons overlay positioned above the bar (not clipped by overflow-hidden) */}
        <div className="absolute inset-0 pointer-events-none">
          {pins.map((pin) => {
            const isActive = isPinActive(pin.id, activePinId);
            return (
              <Fragment key={pin.id}>
                <button
                  type="button"
                  data-pin-trigger
                  data-pin-id={pin.id}
                  aria-haspopup="dialog"
                  aria-expanded={isActive}
                  aria-label={`Inspect milestone: ${pin.label}, ${pin.dateLabel}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPin(pin.id);
                  }}
                  className={cn(
                    "pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--haven-ink)]",
                    isActive
                      ? "z-40 h-4.5 w-4.5 scale-125 ring-4 ring-[var(--haven-ink)] ring-offset-2 shadow-md"
                      : "z-20 h-3.5 w-3.5 hover:scale-125 hover:z-30 hover:ring-2 hover:ring-[var(--haven-ink-mid)] shadow-xs",
                    TONE_PIN_CLASS[pin.tone]
                  )}
                  style={{ left: `${pin.percent}%` }}
                  title={`${pin.label}: ${pin.dateLabel} (Click to inspect)`}
                />
                {isActive && (
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 z-50">
                    <PinInspectionPopover
                      pin={pin}
                      onClose={() => onSelectPin(pin.id)}
                      onViewMatchingCard={
                        hasMilestoneTarget?.(pin.id)
                          ? () => onScrollToMilestone?.(pin.id)
                          : undefined
                      }
                      position="bottom"
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TacticalTimelineWindow({
  tacticalWindow,
  activePinId,
  onSelectPin,
  onScrollToMilestone
}: {
  tacticalWindow: TacticalTimelineView;
  activePinId: string | null;
  onSelectPin: (pinId: string) => void;
  onScrollToMilestone?: (pinId: string) => void;
}) {
  const activeTacticalPin = tacticalWindow.pins.find((pin) =>
    isPinActive(pin.id, activePinId)
  );
  const upcomingUrgentPin = tacticalWindow.pins.find(
    (p) => p.status === "urgent" && p.daysDiff >= 0 && !p.isToday
  );
  const urgentSpanPercent = upcomingUrgentPin ? upcomingUrgentPin.percent : null;

  return (
    <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-cream)]/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-label">Tactical focus window</span>
            <span className="inline-flex items-center rounded-full bg-[var(--haven-ink)] px-2 py-0.5 text-[10px] font-semibold text-[var(--haven-cream)]">
              90-day zoom
            </span>
            {upcomingUrgentPin && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--haven-blush-ink)]">
                <CircleAlert className="h-3 w-3" />
                Urgent window active
              </span>
            )}
          </div>
          <h4 className="text-h3 mt-1">Immediate milestones and daily countdowns</h4>
        </div>
        <p className="text-[12px] text-[var(--haven-ink-mid)] font-medium">
          {tacticalWindow.startLabel} (–45d) <span className="mx-1 text-[var(--haven-ink-light)]">→</span> {tacticalWindow.endLabel} (+45d)
        </p>
      </div>

      {/* Axis Ruler Track Section */}
      <div
        aria-label="Tactical 90-day timeline"
        className="mt-4 overflow-x-auto sm:overflow-visible pb-2 pt-2 scroll-smooth snap-x [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]"
        tabIndex={0}
      >
        <div className="relative min-w-[640px] px-4 pt-8 pb-3">
          {/* Axis Ruler Track */}
          <div className="relative h-2.5 w-full rounded-full bg-[var(--color-border-mid)]">
            {/* Shaded past half */}
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-[var(--haven-sand)] opacity-70"
              style={{ width: "50%" }}
            />
            {/* Shaded future half */}
            <div
              className="absolute inset-y-0 right-0 rounded-r-full bg-[var(--haven-sky-light)] opacity-70"
              style={{ width: "50%" }}
            />

            {/* Highlighted Urgent Window Span on Ruler */}
            {urgentSpanPercent !== null && (
              <div
                className="absolute inset-y-0 bg-[var(--haven-blush)] shadow-xs"
                style={{
                  left: "50%",
                  width: `${Math.max(2, urgentSpanPercent - 50)}%`
                }}
              />
            )}

            {/* Today Center Marker Line */}
            <div
              aria-hidden="true"
              className="absolute -top-3.5 bottom-[-16px] left-1/2 z-20 w-0.5 -translate-x-1/2 bg-[var(--haven-ink)]"
            />
          </div>

          {/* Urgent Span Callout Flag above ruler */}
          {upcomingUrgentPin && (
            <div
              className="absolute top-0.5 -translate-x-1/2 z-30 pointer-events-none"
              style={{ left: `${(50 + upcomingUrgentPin.percent) / 2}%` }}
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-blush)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--haven-cream)] shadow-xs whitespace-nowrap">
                <CircleAlert className="h-2.5 w-2.5" />
                Urgent window ({upcomingUrgentPin.daysDiff}d)
              </span>
            </div>
          )}

          {/* Pin Dots on Ruler Line */}
          <div className="relative">
            {tacticalWindow.pins.map((pin) => {
              const isActive = isPinActive(pin.id, activePinId);
              return (
                <Fragment key={`dot-${pin.id}`}>
                  <div
                    className="absolute top-[-15px] -translate-x-1/2 z-30"
                    style={{ left: `${pin.percent}%` }}
                  >
                    <button
                      type="button"
                      data-pin-trigger
                      data-pin-id={pin.id}
                      aria-haspopup="dialog"
                      aria-expanded={isActive}
                      aria-label={`Inspect milestone: ${pin.label}, ${pin.dateLabel}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPin(pin.id);
                      }}
                      className={cn(
                        "rounded-full border-2 shadow-xs transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--haven-ink)]",
                        isActive
                          ? "h-4.5 w-4.5 scale-135 ring-4 ring-[var(--haven-ink)] ring-offset-2 shadow-md z-40"
                          : "h-3.5 w-3.5 hover:scale-125 hover:ring-2 hover:ring-[var(--haven-ink-mid)]",
                        TONE_PIN_CLASS[pin.tone],
                        pin.isToday && "h-4 w-4 ring-2 ring-[var(--haven-ink)] ring-offset-1"
                      )}
                      title={`${pin.label}: ${pin.dateLabel} (${pin.detail}) - Click to inspect`}
                    />
                  </div>
                  {isActive && (
                    <div className="hidden pointer-events-none absolute inset-x-0 top-[-15px] z-50 sm:block">
                      <PinInspectionPopover
                        pin={pin}
                        onClose={() => onSelectPin(pin.id)}
                        onViewMatchingCard={() => onScrollToMilestone?.(pin.id)}
                        position="top"
                      />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* Ticks */}
          <div className="relative mt-3 h-4 select-none">
            {tacticalWindow.ticks.map((tick, i) => (
              <span
                key={`${tick.label}-${i}`}
                className={cn(
                  "absolute -translate-x-1/2 text-[11px] whitespace-nowrap",
                  tick.percent === 50
                    ? "font-bold text-[var(--haven-ink)]"
                    : "font-medium text-[var(--haven-ink-mid)]"
                )}
                style={{ left: `${tick.percent}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile inline inspection card (unclipped by scroll container) */}
      {activeTacticalPin && (
        <div className="mt-3 sm:hidden">
          <PinInspectionPopover
            pin={activeTacticalPin}
            onClose={() => onSelectPin(activeTacticalPin.id)}
            onViewMatchingCard={() => onScrollToMilestone?.(activeTacticalPin.id)}
            position="inline"
          />
        </div>
      )}

      {/* Sequential Milestone Flow Cards (Collision-Free Grid) */}
      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
            Immediate Milestones in Sequence
          </p>
          <span className="text-[11px] text-[var(--haven-ink-light)] hidden sm:inline">
            Ordered chronologically with daily countdowns · Click card or timeline pin to inspect
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tacticalWindow.pins.map((pin) => {
            const isToday = Boolean(pin.isToday);
            const isUrgent = pin.status === "urgent";
            const isPast = pin.daysDiff < 0;
            const isCardActive = isPinActive(pin.id, activePinId);

            return (
              <div
                key={`card-${pin.id}`}
                id={`milestone-card-${pin.id}`}
                data-pin-match={pin.id}
                role="button"
                tabIndex={0}
                aria-label={`Milestone card: ${pin.label}. ${isCardActive ? "Inspected" : "Click to inspect"}`}
                onClick={() => onSelectPin(pin.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPin(pin.id);
                  }
                }}
                className={cn(
                  "relative flex flex-col justify-between rounded-[var(--radius-xl)] border p-4 transition-all shadow-2xs cursor-pointer select-none",
                  isCardActive && "ring-2 ring-[var(--haven-ink)] ring-offset-2 -translate-y-1 shadow-md",
                  isToday
                    ? "border-[var(--haven-ink)] bg-[var(--haven-ink)] text-[var(--haven-cream)]"
                    : isUrgent
                      ? "border-[var(--haven-blush)] bg-gradient-to-b from-[var(--haven-blush-light)] to-[var(--haven-white)] text-[var(--haven-ink)]"
                      : isPast
                        ? "border-[var(--color-border)] bg-[var(--haven-white)]/80 text-[var(--haven-ink-mid)] opacity-85 hover:opacity-100"
                        : "border-[var(--haven-sky-mid)] bg-[var(--haven-white)] text-[var(--haven-ink)]",
                  "hover:shadow-xs hover:border-[var(--haven-ink-mid)]"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        isToday
                          ? "bg-[var(--haven-sand)] text-[var(--haven-ink)]"
                          : isUrgent
                            ? "bg-[var(--haven-blush)] text-[var(--haven-cream)]"
                            : isPast
                              ? "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)]"
                              : "bg-[var(--haven-sky-light)] text-[var(--haven-sky-ink)]"
                      )}
                    >
                      {isToday
                        ? "Today"
                        : pin.daysDiff > 0
                          ? `In ${pin.daysDiff} day${pin.daysDiff === 1 ? "" : "s"}`
                          : `${Math.abs(pin.daysDiff)}d ago`}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        isToday
                          ? "text-[var(--haven-cream)]/80"
                          : isUrgent
                            ? "text-[var(--haven-blush-ink)] font-bold"
                            : "text-[var(--haven-ink-light)]"
                      )}
                    >
                      {isToday ? "Anchor" : isUrgent ? "Critical" : isPast ? "Elapsed" : "Upcoming"}
                    </span>
                  </div>

                  <h5
                    className={cn(
                      "mt-2.5 text-body-sm font-bold leading-snug",
                      isToday ? "text-[var(--haven-cream)]" : "text-[var(--haven-ink)]"
                    )}
                  >
                    {pin.label}
                  </h5>
                  <p
                    className={cn(
                      "mt-1 text-[12px] font-medium",
                      isToday ? "text-[var(--haven-sand)]" : "text-[var(--haven-ink-mid)]"
                    )}
                  >
                    {pin.dateLabel}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-[12px] leading-relaxed",
                      isToday ? "text-[var(--haven-cream)]/85" : "text-[var(--color-text-secondary)]"
                    )}
                  >
                    {pin.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

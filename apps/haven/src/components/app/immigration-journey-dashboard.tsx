"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Compass,
  Flag,
  Layers,
  PencilLine,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type {
  ImmigrationJourneyView,
  JourneyBarSegment,
  JourneyPlotPin,
  JourneyTrackTone
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { axis, visaTrack, jobTrack, greenCardTrack, overlayInsights, missingFields } = journey;

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
              <Badge variant="community">3 tracks synchronized</Badge>
            </div>
            <CardTitle className="mt-2 text-h2">
              Where you are across Visa, Work, and Green Card
            </CardTitle>
            <p className="text-body-sm mt-1 max-w-[66ch] text-[var(--color-text-secondary)]">
              Your visa validity, sponsoring employment, and green card queue overlaid on a single timeline so you can see how renewals, caps, and priority dates line up.
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

        {/* Top 3 Summary Cards for Each Track */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 1. Visa Summary Card */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label">
                <CalendarClock className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                1. Visa status
              </span>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", TONE_BADGE_CLASS[visaTrack.statusTone])}>
                {visaTrack.statusBadge}
              </span>
            </div>
            <p className="mt-2.5 text-h3 text-[var(--haven-ink)]">{visaTrack.headline}</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{visaTrack.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-2.5 text-[11px] text-[var(--haven-ink-mid)]">
              <span>
                Started: <strong className="text-[var(--haven-ink)]">{visaTrack.startDateLabel ?? "Not set"}</strong>
              </span>
              <span>
                Expires: <strong className="text-[var(--haven-ink)]">{visaTrack.expiryDateLabel ?? "Not set"}</strong>
              </span>
              {visaTrack.capDateLabel && (
                <span>
                  6-yr cap: <strong className="text-[var(--haven-ink)]">{visaTrack.capDateLabel}</strong>
                </span>
              )}
            </div>
          </div>

          {/* 2. Job / Employment Summary Card */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label">
                <Briefcase className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                2. Job & sponsorship
              </span>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", TONE_BADGE_CLASS[jobTrack.statusTone])}>
                {jobTrack.statusBadge}
              </span>
            </div>
            <p className="mt-2.5 text-h3 text-[var(--haven-ink)]">{jobTrack.headline}</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{jobTrack.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-2.5 text-[11px] text-[var(--haven-ink-mid)]">
              {jobTrack.portabilityLabel ? (
                <span>
                  Portability: <strong className="text-[var(--haven-ink)]">{jobTrack.portabilityLabel}</strong>
                </span>
              ) : (
                <span>
                  Sponsor: <strong className="text-[var(--haven-ink)]">{jobTrack.employerName ?? "Not set"}</strong>
                </span>
              )}
            </div>
          </div>

          {/* 3. Green Card Track Summary Card */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-label">
                <Compass className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                3. Green card track
              </span>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", TONE_BADGE_CLASS[greenCardTrack.statusTone])}>
                {greenCardTrack.statusBadge}
              </span>
            </div>
            <p className="mt-2.5 text-h3 text-[var(--haven-ink)]">{greenCardTrack.headline}</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">{greenCardTrack.summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--color-border)] pt-2.5 text-[11px] text-[var(--haven-ink-mid)]">
              <span>
                Priority Date:{" "}
                <strong className="text-[var(--haven-ink)]">{greenCardTrack.priorityDateLabel ?? "Not locked yet"}</strong>
              </span>
              {greenCardTrack.estimatedRangeLabel && (
                <span>
                  Horizon: <strong className="text-[var(--haven-ink)]">{greenCardTrack.estimatedRangeLabel}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SYNCHRONIZED 3-TRACK TIMELINE OVERLAY                               */}
        {/* =================================================================== */}
        <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div>
              <p className="text-label">Synchronized timeline overlay</p>
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

          {/* Shared Time Axis Header */}
          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
            <div className="hidden lg:flex items-end pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                Journey track
              </span>
            </div>

            <div className="relative h-8 select-none">
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

          {/* Three Overlaid Swimlanes */}
          <div className="mt-2 divide-y divide-[var(--color-border)]">
            <OverlaySwimlane
              badge={visaTrack.statusBadge}
              badgeTone={visaTrack.statusTone}
              pins={visaTrack.pins}
              segments={visaTrack.segments}
              subtitle={
                visaTrack.expiryDateLabel
                  ? `Valid through ${visaTrack.expiryDateLabel}`
                  : "Add visa expiration date"
              }
              title={`Visa · ${visaTrack.visaType}`}
              todayPercent={axis.todayPercent}
            />

            <OverlaySwimlane
              badge={jobTrack.statusBadge}
              badgeTone={jobTrack.statusTone}
              pins={jobTrack.pins}
              segments={jobTrack.segments}
              subtitle={
                jobTrack.jobTitle
                  ? `${jobTrack.jobTitle}${jobTrack.employerName ? ` @ ${jobTrack.employerName}` : ""}`
                  : jobTrack.employerName ?? "Work authorization track"
              }
              title="Job & Sponsor"
              todayPercent={axis.todayPercent}
            />

            <OverlaySwimlane
              badge={greenCardTrack.statusBadge}
              badgeTone={greenCardTrack.statusTone}
              pins={greenCardTrack.pins}
              segments={greenCardTrack.segments}
              subtitle={`${greenCardTrack.categoryLabel}${greenCardTrack.priorityDateLabel ? ` · PD ${greenCardTrack.priorityDateLabel}` : ""}`}
              title="Green Card"
              todayPercent={axis.todayPercent}
            />
          </div>
        </div>

        {/* =================================================================== */}
        {/* GREEN CARD 5-STAGE PROGRESSION                                      */}
        {/* =================================================================== */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-label">Permanent residency stages</p>
              <h3 className="text-h3 mt-0.5">Green card milestone progression</h3>
            </div>
            {greenCardTrack.bulletinCutoffLabel && (
              <span className="rounded-full bg-[var(--haven-sky-light)] px-3 py-1 text-[12px] font-medium text-[var(--haven-sky-ink)]">
                Bulletin cutoff · {greenCardTrack.bulletinCutoffLabel}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {greenCardTrack.nodes.map((node, index) => {
              const isCompleted = node.status === "completed";
              const isCurrent = node.status === "current";
              return (
                <div
                  key={node.key}
                  className={cn(
                    "rounded-[var(--radius-xl)] border p-4 flex flex-col justify-between",
                    isCompleted
                      ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]"
                      : isCurrent
                        ? "border-[var(--haven-ink)] bg-[var(--haven-white)] ring-1 ring-[var(--haven-ink)]"
                        : "border-[var(--color-border)] bg-[var(--haven-white)] opacity-80"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                        Stage {index + 1}
                      </span>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage-strong)]" />
                      ) : isCurrent ? (
                        <ShieldCheck className="h-4 w-4 text-[var(--haven-ink)]" />
                      ) : null}
                    </div>
                    <p className="mt-2 text-h3 text-[var(--haven-ink)]">{node.shortLabel}</p>
                    <p className="mt-1 text-[12px] font-semibold text-[var(--haven-ink-mid)]">{node.badgeText}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                      {node.detail}
                    </p>
                  </div>
                  <p className="mt-3 border-t border-[var(--color-border)] pt-2 text-[11px] font-medium text-[var(--haven-ink-mid)]">
                    {node.dateOrMeta}
                  </p>
                </div>
              );
            })}
          </div>
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
      </CardContent>
    </Card>
  );
}

function OverlaySwimlane({
  title,
  subtitle,
  badge,
  badgeTone,
  segments,
  pins,
  todayPercent
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: JourneyTrackTone;
  segments: JourneyBarSegment[];
  pins: JourneyPlotPin[];
  todayPercent: number;
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
      <div className="space-y-2.5">
        <div className="relative h-9 rounded-lg bg-[var(--haven-cream)] border border-[var(--color-border)] overflow-hidden">
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

          {/* Pin dots along the bar */}
          {pins.map((pin) => (
            <div
              key={pin.id}
              className={cn(
                "absolute top-1/2 z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm",
                TONE_PIN_CLASS[pin.tone]
              )}
              style={{ left: `${pin.percent}%` }}
              title={`${pin.label}: ${pin.dateLabel}`}
            />
          ))}

          {/* Vertical Today marker cutting through every lane */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 z-20 w-0.5 bg-[var(--haven-ink)]"
            style={{ left: `${todayPercent}%` }}
          />
        </div>

        {/* Milestone pills below the bar */}
        {pins.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {pins.map((pin) => (
              <span
                key={pin.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]",
                  TONE_BADGE_CLASS[pin.tone]
                )}
                title={pin.detail}
              >
                <span className="font-semibold">{pin.label}:</span>
                <span>{pin.dateLabel}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

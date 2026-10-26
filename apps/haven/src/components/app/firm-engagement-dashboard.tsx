import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  ExternalLink,
  FileCheck2,
  Mail,
  MessageSquare
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FirmEngagementOverview } from "@/lib/firms/engagement";
import { cn } from "@/lib/utils";

const isExternalHref = (href: string) => /^https?:\/\//i.test(href);
const isMailtoHref = (href: string) => /^mailto:/i.test(href);

export function FirmEngagementDashboard({
  engagement
}: {
  engagement: FirmEngagementOverview;
}) {
  const {
    firmName,
    isConnectedToFirm,
    steps,
    completedCount,
    totalSteps,
    progressPercent,
    currentStep,
    nextStep,
    scheduledDate,
    attorneyNote,
    bookingUrl,
    bookingEmail,
    headline,
    summary
  } = engagement;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--color-border)] bg-[var(--haven-cream)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 w-full">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-label">
                <Building2 className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                Sponsoring law firm engagement
              </span>
              <Badge variant={isConnectedToFirm ? "active" : "pending"}>
                {isConnectedToFirm ? firmName : "Firm workflow preview"}
              </Badge>
            </div>
            <CardTitle className="mt-2 text-h2">
              {isConnectedToFirm ? `Your case with ${firmName}` : "Law firm engagement tracker"}
            </CardTitle>
            <p className="text-body-sm mt-1 max-w-[65ch] text-[var(--color-text-secondary)]">
              Track every step with your sponsoring legal team—from intake and document review to your initial consultation call, signed contract, and petition filing.
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <span className="rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-white)] px-3.5 py-1 text-body-sm font-semibold text-[var(--haven-ink)]">
              {completedCount} of {totalSteps} milestones completed
            </span>
            <div className="w-40 h-2 rounded-full bg-[var(--haven-sand)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--haven-sage)] transition-all duration-300"
                style={{ width: `${Math.max(8, progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Current & Next Step Spotlight */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2 max-w-[64ch]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--haven-ink)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-cream)]">
                  Step {currentStep.index + 1} of {totalSteps}
                </span>
                <span className="text-label text-[var(--haven-ink)]">{currentStep.badgeText}</span>
                {scheduledDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-white)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--haven-ink)]">
                    <Calendar className="h-3.5 w-3.5 text-[var(--haven-sage-strong)]" />
                    {scheduledDate}
                  </span>
                )}
              </div>

              <h3 className="text-h2 text-[var(--haven-ink)]">{headline}</h3>
              <p className="text-body-sm text-[var(--haven-ink-mid)]">{summary}</p>

              {attorneyNote && (
                <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                    Note from {firmName}
                  </p>
                  <p className="mt-1 text-body-sm font-medium text-[var(--haven-ink)]">{attorneyNote}</p>
                </div>
              )}

              {currentStep.key === "initial_consultation" && !bookingUrl && !bookingEmail && (
                <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-white)]/80 px-4 py-2.5 text-body-sm text-[var(--haven-ink-mid)]">
                  {isConnectedToFirm
                    ? "Your sponsoring legal team will review your submitted file and reach out with consultation scheduling instructions."
                    : "Connect with a sponsoring law firm to unlock consultation call scheduling and retain legal representation."}
                </div>
              )}

              {nextStep && (
                <p className="pt-1 text-[12px] font-medium text-[var(--haven-ink-mid)]">
                  Up next after this:{" "}
                  <span className="font-semibold text-[var(--haven-ink)]">
                    Step {nextStep.index + 1} · {nextStep.label}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {currentStep.key === "initial_consultation" ? (
                <>
                  {bookingUrl ? (
                    <a
                      className={buttonVariants({ variant: "default", size: "sm" })}
                      href={bookingUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Book consultation call
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  ) : bookingEmail ? (
                    <a
                      className={buttonVariants({ variant: "default", size: "sm" })}
                      href={`mailto:${bookingEmail}?subject=${encodeURIComponent(`Initial consultation call - ${firmName}`)}`}
                    >
                      <Mail className="mr-1.5 h-3.5 w-3.5" />
                      Email to schedule call
                    </a>
                  ) : null}

                  {bookingUrl && bookingEmail ? (
                    <a
                      className="text-body-sm font-medium text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)] px-1"
                      href={`mailto:${bookingEmail}?subject=${encodeURIComponent(`Initial consultation call - ${firmName}`)}`}
                    >
                      or email {bookingEmail} to schedule
                    </a>
                  ) : null}
                </>
              ) : currentStep.actionHref && currentStep.actionLabel ? (
                <Link
                  className={buttonVariants({ variant: "default", size: "sm" })}
                  href={currentStep.actionHref}
                >
                  {currentStep.actionLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              ) : null}
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href="/documents"
              >
                <FileCheck2 className="mr-1.5 h-4 w-4" />
                Document Vault
              </Link>
              <Link
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                href="/advisor"
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Prep questions in Ask
              </Link>
            </div>
          </div>
        </div>

        {/* 6-Step Engagement Pipeline Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {steps.map((step) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";

            return (
              <div
                key={step.key}
                className={cn(
                  "relative flex flex-col justify-between rounded-[var(--radius-xl)] border p-4 transition-colors",
                  isCompleted
                    ? "border-[var(--haven-sage-mid)] bg-[var(--haven-white)]"
                    : isCurrent
                      ? "border-[var(--haven-ink)] bg-[var(--haven-cream)] ring-1 ring-[var(--haven-ink)]"
                      : "border-[var(--color-border)] bg-[var(--haven-white)] opacity-75"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">
                      Step {step.index + 1}
                    </span>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-sage-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--haven-ink)]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--haven-sage)]" />
                        {step.badgeText}
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-ink)] px-2 py-0.5 text-[11px] font-semibold text-[var(--haven-cream)]">
                        <CircleDot className="h-3 w-3" />
                        {step.badgeText}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--haven-sand)] px-2 py-0.5 text-[11px] font-medium text-[var(--haven-ink-mid)]">
                        <Clock className="h-3 w-3" />
                        {step.badgeText}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-h3 text-[var(--haven-ink)]">{step.label}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
                    {step.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-[var(--color-border)] pt-2.5">
                  {step.metaText ? (
                    <p
                      className={cn(
                        "text-[11px] font-medium",
                        isCompleted
                          ? "text-[var(--haven-ink)]"
                          : isCurrent
                            ? "text-[var(--haven-ink)]"
                            : "text-[var(--haven-ink-light)]"
                      )}
                    >
                      {step.metaText}
                    </p>
                  ) : null}

                  {step.actionHref && step.actionLabel && !isCompleted ? (
                    isExternalHref(step.actionHref) ? (
                      <a
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                        href={step.actionHref}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {step.actionLabel}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : isMailtoHref(step.actionHref) ? (
                      <a
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                        href={step.actionHref}
                      >
                        {step.actionLabel}
                        <Mail className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-4 hover:text-[var(--haven-ink-mid)]"
                        href={step.actionHref}
                      >
                        {step.actionLabel}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

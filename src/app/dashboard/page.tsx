import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowRight, CalendarClock, MessageCircle, ShieldAlert, Timer } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mergeSnapshotProfile } from "@/lib/haven";
import { ONBOARDING_OVERRIDE_COOKIE, parseOverrideCookie, persistProfileDraft } from "@/lib/profile-sync";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ImmigrationProfile } from "@/types/domain";

const readinessMeta = {
  high: { label: "High readiness", variant: "active" as const, progress: "88%" },
  medium: { label: "Medium readiness", variant: "pending" as const, progress: "62%" },
  low: { label: "Needs attention", variant: "urgent" as const, progress: "34%" }
};

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ setup?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const overrideValue = cookieStore.get(ONBOARDING_OVERRIDE_COOKIE)?.value;
  const overrideDraft = parseOverrideCookie(overrideValue);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  let shouldUseOverrideFallback = Boolean(overrideDraft);

  if (user && overrideDraft) {
    try {
      await persistProfileDraft(user.id, overrideDraft);
      shouldUseOverrideFallback = false;
    } catch {
      shouldUseOverrideFallback = true;
    }
  }

  let snapshot = await getSnapshot();

  if (shouldUseOverrideFallback && overrideDraft) {
    try {
      const profile: ImmigrationProfile = {
        ...snapshot.profile,
        visaType: String(overrideDraft.visaType ?? snapshot.profile.visaType) as ImmigrationProfile["visaType"],
        countryOfBirth: String(overrideDraft.countryOfBirth ?? snapshot.profile.countryOfBirth),
        primaryGoal: String(overrideDraft.primaryGoal ?? snapshot.profile.primaryGoal) as ImmigrationProfile["primaryGoal"],
        employerName: overrideDraft.employerName ? String(overrideDraft.employerName) : snapshot.profile.employerName,
        jobTitle: overrideDraft.jobTitle ? String(overrideDraft.jobTitle) : snapshot.profile.jobTitle,
        h1bStartDate: overrideDraft.h1bStartDate ? String(overrideDraft.h1bStartDate) : snapshot.profile.h1bStartDate,
        employerSize: overrideDraft.employerSize
          ? String(overrideDraft.employerSize) as ImmigrationProfile["employerSize"]
          : snapshot.profile.employerSize,
        preferenceCategory: String(overrideDraft.preferenceCategory ?? snapshot.profile.preferenceCategory) as ImmigrationProfile["preferenceCategory"],
        spouseVisaStatus: String(overrideDraft.spouseVisaStatus ?? snapshot.profile.spouseVisaStatus) as ImmigrationProfile["spouseVisaStatus"],
        topConcerns: Array.isArray(overrideDraft.topConcerns)
          ? overrideDraft.topConcerns.map(String) as ImmigrationProfile["topConcerns"]
          : snapshot.profile.topConcerns
      };

      snapshot = mergeSnapshotProfile(snapshot, profile);
    } catch {
      // Ignore malformed override cookies and keep the persisted snapshot.
    }
  }

  const { profile, dashboard } = snapshot;
  const readiness = readinessMeta[dashboard.signals.layoffReadinessScore as keyof typeof readinessMeta] ?? readinessMeta.medium;

  return (
    <AppShell activePath="/dashboard">
      <div className="space-y-6">
        {resolvedSearchParams?.setup === "local" && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-5 py-4 text-body-sm">
            Haven opened your dashboard using the setup details you just shared. If sync is still finishing, refreshed profile fields may take a moment to appear.
          </div>
        )}

        <section className="page-intro">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[70ch]">
              <p className="text-label">Your snapshot</p>
              <h1 className="text-h1 mt-4">
                Good to see you, {profile.fullName?.split(" ")[0] ?? "there"}.
              </h1>
              <p className="text-body mt-3">
                {profile.visaType} · {profile.preferenceCategory} · {profile.countryOfBirth}
                {profile.employerName ? ` · ${profile.employerName}` : ""}
              </p>
              <p className="text-body mt-4 max-w-[60ch]">
                This is a lot. Let&apos;s take it one step at a time, starting with what matters most today.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link className={buttonVariants({ variant: "default" })} href="/planner">
                Open layoff planner
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/timeline">
                View full timeline
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StatCard label="Layoff readiness" value={readiness.label} helper="Based on your I-140 and employment context." badge={<Badge variant={readiness.variant}>{dashboard.signals.layoffReadinessScore}</Badge>} />
            <StatCard label="Green card estimate" value={dashboard.signals.estimatedGreenCardDateRange ?? "Pending"} helper="Updated as bulletin movement changes." />
            <StatCard label="Community match" value={dashboard.communityMatchesLabel} helper={`Top concerns: ${profile.topConcerns.join(", ")}`} />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Priority</p>
                <CardTitle className="mt-2">What to focus on now</CardTitle>
              </div>
              <Badge variant="urgent">Current queue</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.nextActions.map((item, index) => (
                <div key={item} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--haven-sage-light)] text-sm font-medium text-[var(--haven-ink)]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-h3">{item}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card variant="urgent">
            <CardHeader>
              <div>
                <p className="text-label">Readiness</p>
                <CardTitle className="mt-2">How prepared you are right now</CardTitle>
              </div>
              <Timer className="h-5 w-5 text-[var(--haven-blush-ink)]" />
            </CardHeader>
            <CardContent>
              <div className="countdown-bar">
                <div className={dashboard.signals.layoffReadinessScore === "low" ? "countdown-bar-fill urgent" : "countdown-bar-fill"} style={{ width: readiness.progress }} />
              </div>
              <p className="text-caption mt-2">
                {dashboard.signals.layoffReadinessScore === "low"
                  ? "Time-sensitive prep deserves attention."
                  : "You have a foundation. Tighten the gaps before you need them."}
              </p>
              <div className="mt-4 space-y-3">
                {dashboard.signals.layoffReadinessReasoning.map((item, index) => (
                  <div key={item} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
                    <p className="text-body-sm">
                      {index + 1}. {item}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Timeline</p>
                <CardTitle className="mt-2">Dates and milestones to keep in view</CardTitle>
              </div>
              <CalendarClock className="h-5 w-5 text-[var(--haven-ink-mid)]" />
            </CardHeader>
            <CardContent>
              {dashboard.signals.visaBulletinPosition && (
                <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-4">
                  <p className="text-label">Visa bulletin</p>
                  <p className="text-body-sm mt-2">{dashboard.signals.visaBulletinPosition}</p>
                </div>
              )}

              <div className="timeline">
                {dashboard.timelineHighlights.map((event, index) => (
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-track">
                      <div className={cn("timeline-dot", index === 0 ? "timeline-dot-active" : "timeline-dot-done")} />
                    </div>
                    <div className="timeline-content">
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-h3">{event.title}</p>
                            <p className="text-caption mt-1">{event.dateLabel}</p>
                          </div>
                          <Badge variant={event.group === "upcoming" ? "urgent" : "pending"}>{event.group}</Badge>
                        </div>
                        <p className="text-body-sm mt-3">{event.nextAction}</p>
                        {event.communityLinkLabel && (
                          <Link className="mt-3 inline-flex items-center gap-2 text-body-sm text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/community">
                            <MessageCircle className="h-4 w-4" />
                            {event.communityLinkLabel}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Next view</p>
                <CardTitle className="mt-2">Take the detailed plan with you</CardTitle>
              </div>
              <ShieldAlert className="h-5 w-5 text-[var(--haven-ink-mid)]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
                <p className="text-h3">Layoff planner</p>
                <p className="text-body-sm mt-2">
                  You have 60-day planning data, ranked options, and a checklist already waiting for you.
                </p>
              </div>
              <Link className={buttonVariants({ variant: "outline" })} href="/planner">
                Open planner
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  helper,
  badge
}: {
  label: string;
  value: string;
  helper: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-label">{label}</p>
        {badge}
      </div>
      <p className="text-h3 mt-3">{value}</p>
      <p className="text-caption mt-2">{helper}</p>
    </div>
  );
}

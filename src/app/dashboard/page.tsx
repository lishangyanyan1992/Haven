import { cookies } from "next/headers";
import Link from "next/link";
import { CalendarClock, MessageCircle, Timer } from "lucide-react";

import { DashboardChangeHighlight, DashboardChangeProvider } from "@/components/app/dashboard-change-highlight";
import { AppShell } from "@/components/app/app-shell";
import { CrisisActivationModal } from "@/components/app/crisis-activation-modal";
import { ImmigrationUpdates } from "@/components/app/immigration-updates";
import { PriorityDateCard } from "@/components/app/priority-date-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { buildChecklist } from "@/lib/crisis-checklist";
import { getCrisisState } from "@/lib/get-crisis-state";
import { mergeSnapshotProfile } from "@/lib/haven";
import { getImmigrationUpdates } from "@/lib/immigration-updates";
import { ONBOARDING_OVERRIDE_COOKIE, parseOverrideCookie, persistProfileDraft } from "@/lib/profile-sync";
import { getDashboardPageData } from "@/lib/repositories/case-compass";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { resolveCrisisModeFromForm } from "@/server/crisis-actions";
import type { ImmigrationProfile } from "@/types/domain";

export const metadata = noIndexMetadata;

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

  const [initialSnapshot, crisisState, updates] = await Promise.all([
    getDashboardPageData(),
    getCrisisState(),
    getImmigrationUpdates()
  ]);
  let snapshot = initialSnapshot;

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

      const mergedSnapshot = mergeSnapshotProfile(havenSnapshot, profile);
      snapshot = {
        ...snapshot,
        profile: mergedSnapshot.profile,
        dashboard: {
          ...mergedSnapshot.dashboard,
          timelineHighlights: snapshot.dashboard.timelineHighlights
        }
      };
    } catch {
      // Ignore malformed override cookies and keep the persisted snapshot.
    }
  }

  const { profile, dashboard } = snapshot;
  const priorityDateIntelligence = initialSnapshot.priorityDateIntelligence;
  const showPriorityDateSection = profile.i140Approved;
  const checklistItems = buildChecklist(profile);
  const checklistProgress = crisisState ? Math.round((crisisState.completedItemKeys.length / checklistItems.length) * 100) : 0;
  const crisisProgressWidth = crisisState ? `${Math.max((crisisState.dayNumber / 60) * 100, 2)}%` : "0%";
  const changeSections = {
    overview: JSON.stringify(
      crisisState
        ? {
            mode: "crisis",
            dayNumber: crisisState.dayNumber,
            daysRemaining: crisisState.daysRemaining,
            completedItemKeys: crisisState.completedItemKeys,
            checklistItems: checklistItems.length,
            layoffDate: crisisState.layoffDate.toISOString()
          }
        : {
            mode: "snapshot",
            firstName: profile.fullName?.split(" ")[0] ?? "there",
            visaType: profile.visaType,
            preferenceCategory: profile.preferenceCategory,
            countryOfBirth: profile.countryOfBirth,
            employerName: profile.employerName ?? null
          }
    ),
    nextActions: JSON.stringify(dashboard.nextActions),
    priorityDate: JSON.stringify(showPriorityDateSection ? priorityDateIntelligence : null),
    crisisResolution: JSON.stringify(
      crisisState
        ? {
            dayNumber: crisisState.dayNumber,
            daysRemaining: crisisState.daysRemaining,
            completedItemKeys: crisisState.completedItemKeys
          }
        : null
    ),
    timeline: JSON.stringify({
      visaBulletinPosition: dashboard.signals.visaBulletinPosition ?? null,
      timelineHighlights: dashboard.timelineHighlights.map((event) => ({
        id: event.id,
        title: event.title,
        dateLabel: event.dateLabel,
        nextAction: event.nextAction,
        group: event.group,
        communityLinkLabel: event.communityLinkLabel ?? null
      }))
    }),
    officialUpdates: JSON.stringify(updates)
  };
  const dashboardStorageKey = `haven-dashboard-changes:${profile.id}`;
  const dashboardLoginKey = user?.last_sign_in_at ?? user?.id ?? "dashboard-session";

  return (
    <AppShell activePath="/dashboard" crisisState={crisisState} snapshot={snapshot}>
      <DashboardChangeProvider loginKey={dashboardLoginKey} sections={changeSections} storageKey={dashboardStorageKey}>
        <div className="space-y-6">
          {resolvedSearchParams?.setup === "local" && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-5 py-4 text-body-sm">
              Haven opened your dashboard using the setup details you just shared. If sync is still finishing, refreshed profile fields may take a moment to appear.
            </div>
          )}

          <DashboardChangeHighlight sectionId="overview">
            {crisisState ? (
              <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] p-6 md:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-[72ch]">
                    <p className="text-label text-[var(--haven-blush-ink)]">Crisis mode active</p>
                    <h1 className="text-h1 mt-4">Day {crisisState.dayNumber} of 60. Keep the next filing window in reach.</h1>
                    <p className="text-body mt-4 text-[var(--haven-blush-ink)]">
                      Haven is now prioritizing your live layoff plan. Last day of employment:{" "}
                      {crisisState.layoffDate.toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      .
                    </p>
                    <div className="mt-5 countdown-bar bg-[rgba(117,61,40,0.12)]">
                      <div className="countdown-bar-fill urgent" style={{ width: crisisProgressWidth }} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-body-sm text-[var(--haven-blush-ink)]">
                      <span>{crisisState.daysRemaining} days remaining</span>
                      <span className="opacity-50">·</span>
                      <span>
                        {crisisState.completedItemKeys.length} of {checklistItems.length} checklist items completed
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <Link className={buttonVariants({ variant: "default" })} href="/planner">
                      View checklist
                    </Link>
                    <Link className={buttonVariants({ variant: "outline" })} href="/timeline">
                      Review timeline
                    </Link>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <StatCard label="Crisis clock" value={`Day ${crisisState.dayNumber}`} helper="Tracker started when you activated crisis mode." badge={<Badge variant="urgent">Live</Badge>} />
                  <StatCard label="Checklist progress" value={`${checklistProgress}%`} helper="Persisted to your current layoff event." />
                </div>
              </section>
            ) : (
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
                  {dashboard.signals.layoffReadinessScore !== "high" ? <CrisisActivationModal /> : null}
                </div>
              </section>
            )}
          </DashboardChangeHighlight>

          <DashboardChangeHighlight sectionId="nextActions">
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
          </DashboardChangeHighlight>

          {showPriorityDateSection ? (
            <DashboardChangeHighlight sectionId="priorityDate">
              <PriorityDateCard intelligence={priorityDateIntelligence} />
            </DashboardChangeHighlight>
          ) : null}

          {crisisState ? (
            <DashboardChangeHighlight sectionId="crisisResolution">
              <Card variant="urgent">
                <CardHeader>
                  <div>
                    <p className="text-label">Resolve crisis mode</p>
                    <CardTitle className="mt-2">Mark this event resolved when your path is secured</CardTitle>
                  </div>
                  <Timer className="h-5 w-5 text-[var(--haven-blush-ink)]" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-body-sm">
                    When your next step is finalized, resolve the event so Haven returns to normal planning mode.
                  </p>
                  <form action={resolveCrisisModeFromForm} className="space-y-3">
                    <Select defaultValue="new_job" name="resolution">
                      <option value="new_job">Found a new job</option>
                      <option value="change_status">Changed status</option>
                      <option value="left_country">Left the country</option>
                      <option value="dismissed">Dismiss without resolution</option>
                    </Select>
                    <button className={buttonVariants({ variant: "destructive" })} type="submit">
                      Resolve crisis mode
                    </button>
                  </form>
                </CardContent>
              </Card>
            </DashboardChangeHighlight>
          ) : null}

          <DashboardChangeHighlight sectionId="timeline">
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
          </DashboardChangeHighlight>

          <DashboardChangeHighlight sectionId="officialUpdates">
            <ImmigrationUpdates updates={updates} />
          </DashboardChangeHighlight>
        </div>
      </DashboardChangeProvider>
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

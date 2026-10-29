import { cookies } from "next/headers";
import Link from "next/link";
import { Timer } from "lucide-react";

import { DashboardChangeHighlight, DashboardChangeProvider } from "@/components/app/dashboard-change-highlight";
import { AppShell } from "@/components/app/app-shell";
import { FirmEngagementDashboard } from "@/components/app/firm-engagement-dashboard";
import { ClientMessages } from "@/components/app/client-messages";
import { listClientConversations, type ClientConversation } from "@/lib/firms/client-messages";
import { DashboardConflictNotes } from "@/components/app/dashboard-conflict-notes";
import { ImmigrationJourneyDashboard } from "@/components/app/immigration-journey-dashboard";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { buildChecklist } from "@/lib/crisis-checklist";
import { loadDeadlineAnswers, type DeadlineAnswers } from "@/lib/deadlines";
import { getDefaultRequiredDocuments } from "@/lib/document-vault";
import { normalizePetitions } from "@/lib/petitions";
import { expandRequiredDocuments } from "@/lib/sponsor-documents";
import { buildFirmEngagementOverview } from "@/lib/firms/engagement";
import type { RequiredDocumentItem } from "@/lib/firms/types";
import { getClientFirmEngagementRecords } from "@/lib/firms/intake";
import {
  documentKindMatchesRequirement,
  getFirmRequiredDocuments,
  unionRequiredDocuments
} from "@/lib/firms/required-documents";
import { getCrisisState } from "@/lib/get-crisis-state";
import { resolveDashboardFacts } from "@/lib/dashboard-facts";
import { mergeSnapshotProfile } from "@/lib/haven";
import { buildImmigrationJourney } from "@/lib/immigration-journey";
import { getImmigrationUpdates } from "@/lib/immigration-updates";
import { ONBOARDING_OVERRIDE_COOKIE, parseOverrideCookie, persistProfileDraft } from "@/lib/profile-sync";
import { getDashboardPageData, getInboxPageData, isProfileUnavailable } from "@/lib/repositories/case-compass";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { noIndexMetadata } from "@/lib/seo";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { resolveCrisisModeFromForm } from "@/server/crisis-actions";
import type { ImmigrationProfile } from "@/types/domain";

export const metadata = noIndexMetadata;

/**
 * Primary client dashboard page rendering immigration status, action items,
 * and multiple connected law firm engagement timelines with milestones and notes.
 *
 * @param props - Next.js page props containing query parameters
 */
export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ setup?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const overrideValue = cookieStore.get(ONBOARDING_OVERRIDE_COOKIE)?.value;
  const overrideDraft = parseOverrideCookie(overrideValue);
  // Without a database (local test personas) there is no signed-in user; the
  // data loaders below already fall back to the sample snapshot.
  const user = hasSupabaseEnv
    ? (await (await createSupabaseServerClient()).auth.getUser()).data.user
    : null;
  let shouldUseOverrideFallback = Boolean(overrideDraft);

  if (user && overrideDraft) {
    try {
      await persistProfileDraft(user.id, overrideDraft);
      shouldUseOverrideFallback = false;
    } catch {
      shouldUseOverrideFallback = true;
    }
  }

  const [initialSnapshot, crisisState, updates, inboxData, savedDeadlines, firmRecords, conversations] = await Promise.all([
    getDashboardPageData(),
    getCrisisState(),
    getImmigrationUpdates(),
    getInboxPageData(),
    user ? loadDeadlineAnswers(user.id) : Promise.resolve({} as DeadlineAnswers),
    user ? getClientFirmEngagementRecords(user.id) : Promise.resolve([]),
    user
      ? listClientConversations(user.id).catch((error) => {
          console.error("[dashboard] could not load messages", error);
          return [] as ClientConversation[];
        })
      : Promise.resolve([] as ClientConversation[])
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
  // Blank when the profile has no name or could not be loaded; `?? "there"`
  // never fired on an empty string, so the greeting read "Good to see you, ."
  const firstName = profile.fullName?.trim().split(" ")[0] || "there";
  const profileUnavailable = isProfileUnavailable(profile);
  const profileSummaryLine = profileUnavailable
    ? "We couldn't load your profile just now, so nothing below is personalised. Try again in a few minutes."
    : [profile.visaType, profile.preferenceCategory, profile.countryOfBirth, profile.employerName]
        .filter(Boolean)
        .join(" · ");
  const priorityDateIntelligence = initialSnapshot.priorityDateIntelligence;
  // Shown whenever any green card gives the user a priority date, not only
  // when the single "I-140 approved" answer is on.
  const dashboardFacts = resolveDashboardFacts({
    profile,
    deadlines: savedDeadlines as Record<string, unknown>,
    layoffDate: crisisState ? crisisState.layoffDate.toISOString().slice(0, 10) : null,
    bulletin: priorityDateIntelligence
      ? {
          visaBulletinPosition: priorityDateIntelligence.visaBulletinPosition,
          estimatedGreenCardDateRange: priorityDateIntelligence.estimatedGreenCardDateRange
        }
      : null
  });
  const showPriorityDateSection = Boolean(dashboardFacts.priorityDate.iso && priorityDateIntelligence);
  const checklistItems = buildChecklist(profile);
  const checklistProgress = crisisState ? Math.round((crisisState.completedItemKeys.length / checklistItems.length) * 100) : 0;
  // Clamped at both ends now that dayNumber is a real count rather than a value
  // pinned to 1..60 — past the ceiling the bar is simply full.
  const crisisProgressScale = crisisState ? Math.min(Math.max(crisisState.dayNumber / 60, 0.02), 1) : 0;

  const manualDocuments = profileUnavailable
    ? []
    : inboxData.documents.filter((d) => d.sourceKind === "manual_upload");
  // Sponsor documents count once per sponsor, the same as the Documents page.
  const sponsorPetitions = normalizePetitions(profile.immigrantPetitions);
  const countChecklist = (items: RequiredDocumentItem[], firmId?: string) =>
    expandRequiredDocuments({
      items,
      petitions: sponsorPetitions,
      employerName: profile.employerName,
      documents: manualDocuments,
      kindMatches: (kind, key) => documentKindMatchesRequirement(kind, key, firmId)
    });

  let firmDocsFailed = false;
  let firmDocsList: Array<{
    firmId: string;
    docs: RequiredDocumentItem[];
    record: (typeof firmRecords)[number];
  }> = [];

  try {
    firmDocsList = await Promise.all(
      firmRecords.map(async (record) => {
        const docs = await getFirmRequiredDocuments(record.firmId);
        return { firmId: record.firmId, docs, record };
      })
    );
  } catch (err) {
    console.error("[dashboard] failed to load firm required documents:", err);
    firmDocsFailed = true;
  }

  if (firmDocsFailed) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16 flex flex-col items-center justify-center text-center">
        <h1 className="text-xl font-semibold text-rose-300">Unable to load dashboard requirements</h1>
        <p className="mt-2 text-sm text-slate-400">
          We encountered an issue loading requirements for your connected legal firms. Please reload to try again.
        </p>
      </div>
    );
  }

  const unionedRequiredDocs = unionRequiredDocuments(firmDocsList);

  const firmEngagements = firmDocsList.map(({ firmId, docs, record }) => {
    const firmChecklist = countChecklist(docs, firmId);
    const fulfilledRequiredCount = firmChecklist.uploadedCount;
    return buildFirmEngagementOverview({
      firmName: record.firmName,
      isConnectedToFirm: true,
      joinedAt: record.joinedAt,
      completedAt: record.completedAt,
      reviewedAt: record.reviewedAt,
      hasProfileSetup: !profileUnavailable && Boolean(profile.countryOfBirth?.trim()),
      uploadedDocumentCount: manualDocuments.length,
      requiredDocumentCount: firmChecklist.requestedCount,
      fulfilledRequiredCount,
      bookingUrl: record.bookingUrl,
      bookingEmail: record.bookingEmail,
      engagementState: record.engagementState
    });
  });

  const defaultDocs = getDefaultRequiredDocuments();
  const effectiveRequiredDocs = unionedRequiredDocs.length > 0 ? unionedRequiredDocs : defaultDocs;

  const defaultFirmEngagement =
    firmEngagements[0] ??
    buildFirmEngagementOverview({
      firmName: null,
      isConnectedToFirm: false,
      joinedAt: null,
      completedAt: null,
      reviewedAt: null,
      hasProfileSetup: !profileUnavailable && Boolean(profile.countryOfBirth?.trim()),
      uploadedDocumentCount: manualDocuments.length,
      requiredDocumentCount: countChecklist(defaultDocs).requestedCount,
      fulfilledRequiredCount: countChecklist(defaultDocs).uploadedCount,
      bookingUrl: null,
      bookingEmail: null,
      engagementState: null
    });

  const activeLayoffFromCrisis = crisisState
    ? {
        layoffDate: crisisState.layoffDate.toISOString().slice(0, 10),
        employerAtLayoff: profile.employerName ?? null,
        visaTypeAtLayoff: profile.visaType ?? null
      }
    : null;

  const deadlineMeta = (savedDeadlines ?? {}) as Record<string, unknown>;
  const pendingEmailSubjects = profileUnavailable
    ? []
    : inboxData.emailInbox
        .filter((e) => e.status === "pending_confirmation")
        .map((e) => e.subject)
        .filter(Boolean);

  const immigrationJourney = buildImmigrationJourney({
    profile,
    deadlines: savedDeadlines,
    signals: dashboard.signals,
    activeLayoffEvent: activeLayoffFromCrisis,
    priorityDateIntelligence,
    documentContext: profileUnavailable
      ? null
      : {
          uploadedDocumentKinds: manualDocuments.map((d) => d.documentKind),
          uploadedDocumentLabels: manualDocuments.map((d) => d.originalName || d.displayLabel),
          requiredDocumentKeys: effectiveRequiredDocs,
          requiredDocumentCounts: (() => {
            const c = countChecklist(effectiveRequiredDocs);
            return { requested: c.requestedCount, uploaded: c.uploadedCount };
          })(),
          pendingEmailSubjects,
          resumeContext: {
            phone: typeof deadlineMeta.inferredPhone === "string" ? deadlineMeta.inferredPhone : null,
            location: typeof deadlineMeta.inferredLocation === "string" ? deadlineMeta.inferredLocation : null,
            priorEmployers: Array.isArray(deadlineMeta.priorEmployers)
              ? (deadlineMeta.priorEmployers as string[])
              : undefined,
            concurrentRoles: Array.isArray(deadlineMeta.concurrentRoles)
              ? (deadlineMeta.concurrentRoles as string[])
              : undefined
          }
        }
  });
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
            firstName: firstName,
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
  const dashboardStorageKey = `haven-dashboard-changes:${profile.id || "no-profile"}`;
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
                    <h1 className="text-h1 mt-4">
                      {crisisState.expired
                        ? "Your 60-day window has passed. What happens next depends on what was filed."
                        : `Day ${crisisState.dayNumber} of 60. Keep the next filing window in reach.`}
                    </h1>
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
                      <div className="countdown-bar-fill urgent" style={{ transform: `scaleX(${crisisProgressScale})` }} />
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-body-sm text-[var(--haven-blush-ink)]">
                      <span>
                        {crisisState.expired
                          ? `Day ${crisisState.dayNumber} since your last day of work`
                          : `${crisisState.daysRemaining} days remaining`}
                      </span>
                      <span className="opacity-50">·</span>
                      <span>
                        {crisisState.completedItemKeys.length} of {checklistItems.length} checklist items completed
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <Link className={buttonVariants({ variant: "default" })} href="/advisor">
                      Ask Haven Advisor
                    </Link>
                    <Link className={buttonVariants({ variant: "outline" })} href="/documents">
                      Document Vault
                    </Link>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <StatCard
                    label="Crisis clock"
                    value={crisisState.expired ? "Passed" : `Day ${crisisState.dayNumber}`}
                    helper="Counted from your last day of employment."
                    badge={<Badge variant="urgent">Live</Badge>}
                  />
                  <StatCard label="Checklist progress" value={`${checklistProgress}%`} helper="Persisted to your current layoff event." />
                </div>
              </section>
            ) : (
              <section className="page-intro">
                <div className="max-w-[70ch]">
                  <p className="text-label">Case dashboard</p>
                  <h1 className="text-h1 mt-4">
                    Good to see you, {firstName}.
                  </h1>
                  {profileSummaryLine ? <p className="text-body mt-3">{profileSummaryLine}</p> : null}
                </div>
              </section>
            )}
          </DashboardChangeHighlight>

          <FirmEngagementDashboard engagement={defaultFirmEngagement} engagements={firmEngagements} />

          {conversations.length > 0 ? <ClientMessages conversations={conversations} /> : null}

          {!profileUnavailable && <DashboardConflictNotes conflicts={dashboardFacts.conflicts} />}

          <ImmigrationJourneyDashboard
            initialStatusEndDate={savedDeadlines.statusEndDate}
            journey={immigrationJourney}
            profile={profile}
          />

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

import Link from "next/link";
import {
  FileText,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { AppShellNav } from "@/components/app/app-shell-nav";
import { HavenBrand } from "@/components/app/haven-brand";
import { CrisisBanner } from "@/components/app/crisis-banner";
import { MixpanelAuthTracker } from "@/components/app/mixpanel-auth-tracker";
import { Badge } from "@/components/ui/badge";
import type { CrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";
import type { HavenWorkspaceSnapshot } from "@/types/domain";

type AppShellSnapshot = Pick<HavenWorkspaceSnapshot, "profile" | "dashboard">;

export async function AppShell({
  children,
  activePath,
  crisisState,
  snapshot
}: {
  children: ReactNode;
  activePath: string;
  crisisState?: CrisisState | null;
  snapshot?: AppShellSnapshot;
}) {
  const { profile, dashboard } = snapshot ?? await getSnapshot();
  const isCrisisActive = Boolean(crisisState);
  const crisisProgressWidth = crisisState ? `${Math.max((crisisState.dayNumber / 60) * 100, 2)}%` : "74%";

  const snapshotHeadline =
    profile.preferenceCategory && profile.preferenceCategory !== "Not sure" && profile.countryOfBirth
      ? `${profile.visaType} · ${profile.preferenceCategory} ${profile.countryOfBirth}`
      : profile.visaType ?? "H-1B";

  const snapshotBody = profile.i140Approved
    ? "I-140 approved. Your plan stays visible even when things feel noisy."
    : profile.priorityDate
      ? "Priority date on record. Haven is tracking your bulletin position."
      : "Your timeline is active. Haven tracks what matters as things change.";

  const daysUntilExpiry = dashboard.signals.daysUntilVisaExpiry;
  const snapshotCaption = daysUntilExpiry != null
    ? `${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"} until visa expiry.`
    : "Your plan is up to date.";

  const avatarInitial = profile.fullName?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <MixpanelAuthTracker destination={activePath} email={profile.email} userId={profile.id} />
      <div className="app-shell-frame grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--color-border)] bg-[var(--haven-sand)] px-4 py-5 lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 lg:block">
            <HavenBrand />
            <Badge className="hidden lg:inline-flex" variant={isCrisisActive ? "urgent" : "community"}>
              {isCrisisActive ? "Crisis mode" : "Calm mode"}
            </Badge>
          </div>

          <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
            <p className="text-label">{isCrisisActive ? "Crisis window" : "Your snapshot"}</p>
            <p className="mt-2 text-h3">
              {isCrisisActive ? `Day ${crisisState?.dayNumber} of 60` : snapshotHeadline}
            </p>
            <p className="mt-1 text-body-sm">
              {isCrisisActive
                ? `${crisisState?.daysRemaining} day${crisisState?.daysRemaining === 1 ? "" : "s"} remaining in your grace period plan.`
                : snapshotBody}
            </p>
            <div className="mt-4 countdown-bar">
              <div className={cn("countdown-bar-fill", isCrisisActive && "urgent")} style={{ width: crisisProgressWidth }} />
            </div>
            <p className="mt-2 text-caption">
              {isCrisisActive
                ? "Checklist progress and timeline now stay visible across the app."
                : snapshotCaption}
            </p>
          </div>

          <AppShellNav activePath={activePath} crisisDayNumber={crisisState?.dayNumber} />

          <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-[var(--radius-sm)] bg-[var(--haven-sky-light)] p-2 text-[var(--haven-sky-ink)]">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-h3">Trust note</p>
                <p className="mt-2 text-body-sm">
                  Haven shares information in plain language. Legal guidance belongs in the footer, not in your face.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="topbar sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)] px-4 backdrop-blur-sm md:px-6 xl:px-8 2xl:px-10">
            <div>
              <p className="text-label">Haven app</p>
              <p className="text-body-sm">Clear next steps, grounded in what people like you experienced.</p>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Badge variant="active">Belonging first</Badge>
              <div className="avatar avatar-md">{avatarInitial}</div>
            </div>
          </header>

          {crisisState ? <CrisisBanner crisisState={crisisState} /> : null}

          <main className="p-4 md:p-6 lg:p-8 xl:p-10 2xl:p-12">
            <div className="content-container-visual">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

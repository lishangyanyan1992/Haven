import Link from "next/link";
import {
  CalendarClock,
  FileText,
  LayoutDashboard,
  MessageSquareQuote,
  Settings,
  ShieldAlert,
  Users
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { HavenBrand } from "@/components/app/haven-brand";
import { CrisisBanner } from "@/components/app/crisis-banner";
import { Badge } from "@/components/ui/badge";
import type { CrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarClock },
  { href: "/planner", label: "Layoff Planner", icon: ShieldAlert },
  { href: "/advisor", label: "Advisor", icon: MessageSquareQuote },
  { href: "/community", label: "Community", icon: Users },
  { href: "/inbox", label: "Document Vault", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export async function AppShell({
  children,
  activePath,
  crisisState
}: {
  children: ReactNode;
  activePath: string;
  crisisState?: CrisisState | null;
}) {
  const { profile, dashboard } = await getSnapshot();
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
      <div className="app-shell mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[240px_1fr]">
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

          <nav className="mt-6 grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors duration-150",
                    isActive
                      ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--haven-sage)]" />
                  )}
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.href === "/dashboard" && crisisState && (
                    <Badge variant="urgent">Day {crisisState.dayNumber} / 60</Badge>
                  )}
                  {item.href === "/community" && <Badge variant="count">3</Badge>}
                </Link>
              );
            })}
          </nav>

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
          <header className="topbar sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)] px-4 backdrop-blur-sm md:px-6">
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

          <main className="p-4 md:p-6 lg:p-8">
            <div className="content-container-wide">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareQuote,
  Settings,
  ShieldAlert,
  Users
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AdvisorUsage } from "@/lib/advisor/service";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planner", label: "Layoff Planner", icon: ShieldAlert },
  { href: "/advisor", label: "Advisor", icon: MessageSquareQuote },
  { href: "/community", label: "Community", icon: Users },
  { href: "/inbox", label: "Document Vault", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShellNav({
  activePath,
  advisorUsage,
  crisisDayNumber,
  showPlanner
}: {
  activePath: string;
  advisorUsage: AdvisorUsage;
  crisisDayNumber?: number;
  showPlanner: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const currentPath = pathname || activePath;
  const visibleNavItems = navItems.filter((item) => showPlanner || item.href !== "/planner");

  useEffect(() => {
    visibleNavItems.forEach((item) => {
      if (!currentPath.startsWith(item.href)) {
        router.prefetch(item.href);
      }
    });
  }, [currentPath, router, visibleNavItems]);

  useEffect(() => {
    if (pendingHref && currentPath.startsWith(pendingHref)) {
      setPendingHref(null);
    }
  }, [currentPath, pendingHref]);

  return (
    <nav className="mt-6 grid gap-1">
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath.startsWith(item.href);
        const isPending = pendingHref === item.href;
        const isAdvisor = item.href === "/advisor";

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            aria-busy={isPending}
            onClick={() => {
              if (!currentPath.startsWith(item.href)) {
                setPendingHref(item.href);
              }
            }}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors duration-150",
              isAdvisor && "items-start py-2.5",
              isActive
                ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--haven-sage)]" />
            )}
            <Icon className={cn("h-4 w-4", isAdvisor && "mt-0.5")} />
            {isAdvisor ? (
              <div className="min-w-0 flex-1">
                <p>{item.label}</p>
                <p className="mt-0.5 text-[11px] font-normal leading-tight text-[var(--color-text-secondary)]">
                  {advisorUsage.remaining} left · {advisorUsage.renewalLabel}
                </p>
              </div>
            ) : (
              <span>{item.label}</span>
            )}
            {isPending ? <LoaderCircle className="ml-auto h-4 w-4 animate-spin" /> : null}
            {!isPending && item.href === "/dashboard" && crisisDayNumber ? (
              <Badge variant="urgent">Day {crisisDayNumber} / 60</Badge>
            ) : null}
            {!isPending && !isAdvisor && item.href === "/community" ? <Badge variant="count">3</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  MessageSquareQuote,
  Settings,
  ShieldAlert,
  Users
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarClock },
  { href: "/planner", label: "Layoff Planner", icon: ShieldAlert },
  { href: "/advisor", label: "Advisor", icon: MessageSquareQuote },
  { href: "/community", label: "Community", icon: Users },
  { href: "/inbox", label: "Document Vault", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShellNav({
  activePath,
  crisisDayNumber
}: {
  activePath: string;
  crisisDayNumber?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const currentPath = pathname || activePath;

  useEffect(() => {
    navItems.forEach((item) => {
      if (!currentPath.startsWith(item.href)) {
        router.prefetch(item.href);
      }
    });
  }, [currentPath, router]);

  useEffect(() => {
    if (pendingHref && currentPath.startsWith(pendingHref)) {
      setPendingHref(null);
    }
  }, [currentPath, pendingHref]);

  return (
    <nav className="mt-6 grid gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPath.startsWith(item.href);
        const isPending = pendingHref === item.href;

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
            {isPending ? <LoaderCircle className="ml-auto h-4 w-4 animate-spin" /> : null}
            {!isPending && item.href === "/dashboard" && crisisDayNumber ? (
              <Badge variant="urgent">Day {crisisDayNumber} / 60</Badge>
            ) : null}
            {!isPending && item.href === "/community" ? <Badge variant="count">3</Badge> : null}
          </Link>
        );
      })}
    </nav>
  );
}

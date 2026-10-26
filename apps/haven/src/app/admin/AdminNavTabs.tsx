"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavTabs() {
  const pathname = usePathname();
  const isOverview = pathname === "/admin";
  const isCommunity = pathname.startsWith("/admin/community-imports");

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
      <Link
        href="/admin"
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition ${
          isOverview
            ? "bg-[var(--haven-ink)] text-[var(--haven-cream)] font-semibold shadow-sm"
            : "bg-[var(--haven-white)] text-[var(--haven-ink)] hover:bg-[var(--haven-cream)] border border-[var(--color-border)]"
        }`}
      >
        Overview
      </Link>
      <Link
        href="/admin/community-imports"
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition ${
          isCommunity
            ? "bg-[var(--haven-ink)] text-[var(--haven-cream)] font-semibold shadow-sm"
            : "bg-[var(--haven-white)] text-[var(--haven-ink)] hover:bg-[var(--haven-cream)] border border-[var(--color-border)]"
        }`}
      >
        Community Stories
      </Link>
    </div>
  );
}

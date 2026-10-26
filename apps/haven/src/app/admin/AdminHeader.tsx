import Link from "next/link";
import { HavenBrand } from "@/components/app/haven-brand";
import { lockAdminAction } from "@/server/admin-actions";

export function AdminHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
      <div className="content-container-wide flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <HavenBrand />
          </Link>
          <span className="rounded-full bg-[var(--haven-sky-light)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-sky-ink)]">
            ADMIN
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-body-sm text-[var(--haven-ink-mid)] transition hover:text-[var(--haven-ink)]"
          >
            ← Back to App
          </Link>
          <span className="hidden text-body-sm text-[var(--haven-ink-mid)] md:inline">{email}</span>
          <form action={lockAdminAction}>
            <button className="text-body-sm font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" type="submit">
              Lock Admin
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

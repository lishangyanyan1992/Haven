import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { signOutAction } from "@/server/actions";

export function FirmHeader({ firmName, email }: { firmName: string; email: string }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
      <div className="content-container-wide flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Link href="/firm">
            <HavenBrand />
          </Link>
          <span className="hidden text-body-sm text-[var(--haven-ink-mid)] sm:inline">· {firmName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-body-sm text-[var(--haven-ink-mid)] md:inline">{email}</span>
          <form action={signOutAction}>
            <button className="text-body-sm font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { signOutAction } from "@/server/actions";
import { ResetDemoButton } from "./ResetDemoButton";

export function FirmHeader({ firmName, email, isDemo }: { firmName: string; email: string; isDemo?: boolean }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
      <div className="content-container-wide flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Link href="/firm">
            <HavenBrand />
          </Link>
          <span className="hidden text-body-sm text-[var(--haven-ink-mid)] sm:inline">· {firmName}</span>
          {isDemo ? (
            <span className="rounded-full bg-[var(--haven-blush-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--haven-blush-ink)]">
              DEMO
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {isDemo ? <ResetDemoButton /> : null}
          <span className="hidden text-body-sm text-[var(--haven-ink-mid)] md:inline">{email}</span>
          <form action={signOutAction}>
            <input type="hidden" name="role" value="lawyer" />
            <button className="text-body-sm font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

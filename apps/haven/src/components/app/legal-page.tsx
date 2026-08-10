import Link from "next/link";
import type { ReactNode } from "react";

import { HavenBrand } from "@/components/app/haven-brand";

const HAVEN_HOME_URL = "https://haven-h1b.com/";

/**
 * Shared shell for the privacy policy and terms.
 *
 * Both are reachable while signed out — a person deciding whether to hand Haven
 * their immigration history needs to read this *before* creating an account, not
 * after.
 */
export function LegalPage({
  title,
  lastUpdated,
  children
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href={HAVEN_HOME_URL} prefetch={false}>
            <HavenBrand />
          </Link>
          <p className="text-body-sm">
            <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <main className="content-container py-12 lg:py-16">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-caption text-[var(--color-text-secondary)]">Last updated {lastUpdated}</p>

        <div className="mt-8 space-y-6 text-body-sm leading-7 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>

        <p className="mt-12 text-caption text-[var(--color-text-secondary)]">
          Questions about this page? Email{" "}
          <a className="underline underline-offset-2" href="mailto:privacy@haven-h1b.com">
            privacy@haven-h1b.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}

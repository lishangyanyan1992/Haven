import type { Metadata } from "next";

import { ContributionForm } from "@/components/app/contribution-form";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Share your immigration path — Haven Community",
  description:
    "Anonymously share your H-1B layoff or status-change timeline and outcome to help others in the same situation. Aggregated and never personally identified.",
  alternates: { canonical: "/community/contribute" },
  openGraph: { url: absoluteUrl("/community/contribute") }
};

export default function ContributePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Share your path</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Your anonymized case helps others facing the same decision see what people like them actually did.
        </p>
      </header>
      <ContributionForm />
    </main>
  );
}

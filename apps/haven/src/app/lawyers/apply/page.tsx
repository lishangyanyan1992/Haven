import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { FirmClaimForm } from "@/components/app/firm-claim-form";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Get your immigration firm listed — free | Haven",
  description:
    "Are you a U.S. immigration law firm? Apply to be listed in Haven's directory for free. Help F-1, OPT, H-1B, and green-card talent find you.",
  alternates: { canonical: "/lawyers/apply" },
  openGraph: {
    url: absoluteUrl("/lawyers/apply"),
    title: "Get your immigration firm listed — free",
    description: "Apply to be listed in Haven's immigration lawyer directory. Always free."
  }
};

export default function ApplyToListPage() {
  return (
    <div className="min-h-screen">
      <PublicNavbar currentPath="/lawyers" />
      <main className="content-container-visual py-10 md:py-14">
        <div className="mx-auto max-w-3xl space-y-6">
          <Link
            className="inline-flex items-center gap-1.5 text-body-sm text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
            href="/lawyers"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All immigration firms
          </Link>

          <div>
            <h1 className="text-display max-w-[24ch]">Get your firm listed — free</h1>
            <p className="text-body mt-4 max-w-[68ch]">
              Haven helps employment-track immigrants (F-1, OPT, H-1B, green card) find immigration counsel they can
              trust. If you&rsquo;re a U.S. immigration firm, apply to be listed — there&rsquo;s no charge, ever. Share
              your specialties, languages, pricing, and evidence links so newcomers can find and vet you.
            </p>
          </div>

          <FirmClaimForm mode="apply" />
        </div>
      </main>
    </div>
  );
}

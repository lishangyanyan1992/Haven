import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export function CommunityContributionCta() {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-white)] text-[var(--haven-ink)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h3">Help others understand what people actually did.</p>
            <p className="text-body-sm mt-2 max-w-[70ch]">
              Share your immigration path anonymously. Haven uses consented submissions only in aggregated community
              insights, and no one sees your identity or raw case details.
            </p>
          </div>
        </div>
        <Link className={buttonVariants({ variant: "accent" })} href="/community/contribute">
          Share your path
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

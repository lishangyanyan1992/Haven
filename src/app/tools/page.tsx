import type { Metadata } from "next";
import Link from "next/link";
import { Heart, ShieldCheck, Wrench } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData } from "@/lib/site";
import { ToolsWorkspace } from "@/app/tools/ToolsWorkspace";

export const metadata: Metadata = {
  title: "Free Immigration Tools",
  description: "Public immigration planning tools for vaccine requirements, grace periods, priority dates, and document prep. No login required.",
  alternates: {
    canonical: "/tools"
  },
  openGraph: {
    url: absoluteUrl("/tools"),
    title: "Haven Free Immigration Tools",
    description: "Public immigration planning tools for vaccine requirements, grace periods, priority dates, and document prep. No login required."
  },
  twitter: {
    title: "Haven Free Immigration Tools",
    description: "Public immigration planning tools for vaccine requirements, grace periods, priority dates, and document prep. No login required."
  }
};

export default function ToolsPage() {
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools" }
  ]);

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
        <div className="content-container-wide flex h-16 items-center justify-between gap-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/">
              Home
            </Link>
            <Link className="text-body-sm font-medium text-[var(--haven-ink)]" href="/tools">
              Tools
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/guides">
              Guides
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/blog">
              Blog
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/about">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/login">
              Sign in
            </Link>
            <Link className={buttonVariants({ variant: "default" })} href="/register">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="content-container-wide py-16 lg:py-24">
          <div className="page-intro">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
                <Wrench className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">Free tools</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">No login required</p>
              </div>
            </div>
            <h1 className="text-display mt-5 max-w-[12ch]">Useful immigration tools you can open right away.</h1>
            <p className="text-body mt-6 max-w-[64ch]">
              This section is intentionally public. Use it for vaccine requirement checks, deadline estimates, priority-date math, and document prep before you decide whether you need the full Haven workflow.
            </p>
          </div>
        </section>

        <section className="content-container-wide pb-16 lg:pb-24">
          <ToolsWorkspace />
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--haven-sand)]">
          <div className="content-container-wide py-14 lg:py-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
              <Heart className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">Coming soon</p>
            </div>
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <h2 className="text-h1 max-w-[22ch]">Marriage green card packet builder</h2>
                <p className="text-body mt-4 max-w-[58ch]">
                  Step-by-step guidance through your I-130, I-485, I-864, I-765, and I-131 — the five interconnected forms in an Adjustment of Status application. The builder checks for cross-form inconsistencies, generates your document checklist, and flags whether your case needs a personal attorney before you spend money on filing fees.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {["Adjustment of Status", "I-130 · I-485 · I-864", "No login required"].map((tag) => (
                    <span key={tag} className="inline-flex items-center rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-white)] px-3 py-1 text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                {[
                  {
                    title: "Full AOS packet",
                    body: "I-130, I-485, I-864, I-765, I-131, and I-693 medical exam prep in a single guided flow."
                  },
                  {
                    title: "Cross-form error detection",
                    body: "Dates, names, and addresses checked for consistency across all five forms — the leading cause of RFE delays."
                  },
                  {
                    title: "Lawyer flag at intake",
                    body: "Prior visa denial, overstay, or borderline income? You'll know before you spend $2,500+ on filing fees."
                  }
                ].map(({ title, body }) => (
                  <div key={title} className="rounded-[var(--radius-lg)] border border-dashed border-[var(--haven-sky-mid)] bg-[var(--haven-white)] p-4">
                    <p className="text-h3">{title}</p>
                    <p className="text-body-sm mt-2">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

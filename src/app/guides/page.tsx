import type { Metadata } from "next";
import Link from "next/link";

import { GuideCard } from "@/components/app/guide-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
import { getAllGuides } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "H-1B Guides",
  description: "Public guides for H-1B layoffs, grace periods, transfer timelines, and job-change planning.",
  alternates: {
    canonical: "/guides"
  },
  openGraph: {
    url: absoluteUrl("/guides"),
    title: "H-1B Guides",
    description: "Public guides for H-1B layoffs, grace periods, transfer timelines, and job-change planning."
  },
  twitter: {
    title: "H-1B Guides",
    description: "Public guides for H-1B layoffs, grace periods, transfer timelines, and job-change planning."
  }
};

export default function GuidesIndexPage() {
  const guides = getAllGuides();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
        <div className="content-container-wide flex h-16 items-center justify-between gap-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <div className="flex items-center gap-3">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/">
              Home
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/blog">
              Blog
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/about">
              About
            </Link>
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
          <div className="max-w-[72ch]">
            <p className="text-label">Public guides</p>
            <h1 className="text-display mt-5 max-w-[13ch]">H-1B layoff and transfer guides built for real decisions.</h1>
            <p className="text-body mt-6 max-w-[62ch]">
              These pages target the moments when search intent turns urgent: layoffs, grace periods, employer changes, and transfer timelines that need clear next steps.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {guides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

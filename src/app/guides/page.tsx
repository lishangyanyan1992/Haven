import type { Metadata } from "next";

import { GuideCard } from "@/components/app/guide-card";
import { PublicNavbar } from "@/components/app/public-navbar";
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
      <PublicNavbar currentPath="/guides" />

      <main>
        <section className="content-container-visual py-16 lg:py-24 xl:py-28">
          <div className="max-w-[72ch]">
            <p className="text-label">Public guides</p>
            <h1 className="text-display mt-5 max-w-[13ch]">H-1B layoff and transfer guides built for real decisions.</h1>
            <p className="text-body mt-6 max-w-[62ch]">
              These pages target the moments when search intent turns urgent: layoffs, grace periods, employer changes, and transfer timelines that need clear next steps.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {guides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

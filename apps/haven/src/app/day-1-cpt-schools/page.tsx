import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, GraduationCap, ShieldCheck } from "lucide-react";

import { Day1CptDirectory } from "@/components/app/day1-cpt-directory";
import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { day1CptSchools } from "@/lib/day1-cpt-schools";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, siteIdentity } from "@/lib/site";

export const metadata: Metadata = {
  title: "Day 1 CPT Schools Directory - F-1 Graduate Programs",
  description:
    "Research U.S. schools and graduate programs that may authorize Day 1 CPT from the first semester or program start for eligible F-1 students.",
  alternates: {
    canonical: "/day-1-cpt-schools"
  },
  openGraph: {
    url: absoluteUrl("/day-1-cpt-schools"),
    title: "Haven Day 1 CPT Schools Directory",
    description:
      "A careful shortlist of U.S. schools with official pages describing first-semester, program-start, or Day 1 CPT options for eligible F-1 students."
  },
  twitter: {
    title: "Haven Day 1 CPT Schools Directory",
    description:
      "Research U.S. schools with official Day 1 CPT, first-semester CPT, or program-start CPT language."
  }
};

const checks = [
  "Confirm the exact degree, campus or residency requirement, and CPT course before applying.",
  "Ask the DSO whether CPT can start on your program start date and what documents are needed before SEVIS authorization.",
  "Do not begin work until your Form I-20 lists CPT authorization for the employer, location, dates, and full-time or part-time status.",
  "Track full-time CPT carefully: 12 months or more of full-time CPT generally makes a student ineligible for post-completion OPT."
];

export default function Day1CptSchoolsPage() {
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Day 1 CPT Schools", path: "/day-1-cpt-schools" }
  ]);

  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Day 1 CPT Schools Directory",
    description:
      "A curated research page for U.S. schools with official pages describing Day 1 CPT, first-semester CPT, or program-start CPT options for eligible F-1 students.",
    url: absoluteUrl("/day-1-cpt-schools").toString(),
    isPartOf: {
      "@type": "WebSite",
      name: siteIdentity.name,
      url: siteIdentity.url
    },
    publisher: { "@type": "Organization", name: siteIdentity.name, url: siteIdentity.url },
    about: [
      { "@type": "Thing", name: "Curricular Practical Training" },
      { "@type": "Thing", name: "F-1 student status" },
      { "@type": "Thing", name: "Day 1 CPT" }
    ]
  };

  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Schools with Day 1 CPT or first-semester CPT language",
    numberOfItems: day1CptSchools.length,
    itemListElement: day1CptSchools.map((school, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: school.name,
      url: school.website
    }))
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }} />
      <PublicNavbar currentPath="/day-1-cpt-schools" />

      <main className="content-container-visual py-10 md:py-14 lg:py-16">
        <div className="space-y-8">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="max-w-[82ch]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
                <GraduationCap className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">F-1 school research</p>
              </div>
              <h1 className="text-display mt-5 max-w-[20ch]">Find schools with Day 1 CPT options.</h1>
              <p className="text-body mt-5 max-w-[76ch]">
                This directory highlights U.S. schools whose official pages describe Day 1 CPT, first-semester CPT,
                program-start CPT, or required graduate practical training for eligible F-1 students. Each card now
                separates official confirmation, CPT start timing, nearest visible cohort date, tuition, degrees,
                and status-maintenance requirements.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className={buttonVariants({ variant: "default" })}
                  href="https://studyinthestates.dhs.gov/school-search"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Check SEVP certification
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Link className={buttonVariants({ variant: "outline" })} href="/resources/student-visa-f1-m1-j1">
                  Read student visa guide
                </Link>
              </div>
            </div>

            <aside className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-[var(--radius-md)] bg-[var(--haven-sage-light)] p-2 text-[var(--haven-ink)]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-h3">Before You Apply</p>
                  <p className="text-body-sm mt-1">Day 1 CPT depends on the program, curriculum, and DSO authorization.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {checks.map((check) => (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-3" key={check}>
                    <p className="text-body-sm">{check}</p>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <p className="text-h3">Compliance note</p>
            <p className="text-body-sm mt-2 max-w-[95ch]">
              Under 8 CFR 214.2(f)(10)(i), CPT must be an integral part of an established curriculum. The one-academic-year
              requirement has an exception for graduate studies that require immediate CPT participation, but the student
              still needs DSO authorization and an endorsed I-20 before work begins. Snapshot researched June 26, 2026;
              school dates and tuition can change quickly.
            </p>
          </section>

          <Day1CptDirectory schools={day1CptSchools} />
        </div>
      </main>
    </div>
  );
}


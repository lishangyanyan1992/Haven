import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, GraduationCap, ShieldCheck } from "lucide-react";

import { AdvisorListingCallout, Day1CptDirectory } from "@/components/app/day1-cpt-directory";
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

// ISO date this directory was last researched — also used as the page's freshness
// (dateModified) signal for search engines and AI answer engines.
const RESEARCHED_DATE = "2026-06-26";

const faqItems = [
  {
    question: "What is Day 1 CPT?",
    answer:
      "Day 1 CPT (Curricular Practical Training) lets eligible F-1 graduate students begin authorized off-campus employment from the first day or first semester of their program — instead of waiting the usual one academic year — when the practical training is an integral part of the curriculum. It always requires DSO authorization and a CPT-endorsed Form I-20 before any work begins."
  },
  {
    question: "Is Day 1 CPT legal?",
    answer:
      "Yes, when used correctly. Under 8 CFR 214.2(f)(10)(i), CPT must be an integral part of an established curriculum, and graduate programs that require immediate practical training may authorize CPT before the one-academic-year mark. Enrolling only to work, with little or no real coursework, can jeopardize F-1 status — so the program and the DSO authorization must be legitimate."
  },
  {
    question: "Does Day 1 CPT affect OPT?",
    answer:
      "It can. Twelve months or more of full-time CPT eliminates eligibility for post-completion OPT. Part-time CPT, and full-time CPT under 12 months, generally do not affect OPT eligibility. Track your full-time CPT carefully."
  },
  {
    question: "Which schools offer Day 1 CPT?",
    answer:
      "It varies by school and program. This directory lists U.S. schools whose official pages describe Day 1, first-semester, or program-start CPT for eligible F-1 graduate students, with links to the official sources. Always confirm with the school's DSO for your specific degree and intake."
  },
  {
    question: "How do I start Day 1 CPT?",
    answer:
      "Enroll in a qualifying graduate program, secure a job or internship directly related to your field, register for the required CPT or internship course, and request CPT through your DSO. Do not begin work until your Form I-20 lists CPT authorization for the employer, location, dates, and full-time or part-time status."
  }
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
    dateModified: RESEARCHED_DATE,
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
      item: {
        "@type": "CollegeOrUniversity",
        name: school.name,
        url: school.website,
        address: school.location
      }
    }))
  };

  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }} />
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
              <p className="text-body mt-5 max-w-[72ch]">
                U.S. schools whose official pages describe Day 1, first-semester, or program-start CPT for eligible F-1
                graduate students — each with the start timing, tuition, qualifying degrees, and the official sources to
                verify it yourself.
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
                  <h2 className="text-h3">Before You Apply</h2>
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

          <AdvisorListingCallout />

          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 md:p-6">
            <h2 className="text-h2">What is Day 1 CPT?</h2>
            <p className="text-body mt-3 max-w-[95ch]">
              Day 1 CPT (Curricular Practical Training) lets eligible F-1 graduate students begin authorized off-campus
              work from the first day or first semester of their program — instead of waiting the usual one academic
              year — when the practical training is an integral part of the curriculum. It always requires DSO
              authorization and a CPT-endorsed Form I-20 before work begins.
            </p>
            <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-4">
              <p className="text-body-sm max-w-[95ch]">
                <span className="font-medium text-[var(--haven-ink)]">The rule:</span> under 8 CFR 214.2(f)(10)(i), CPT
                must be an integral part of an established curriculum. The one-academic-year requirement has an exception
                for graduate studies that require immediate CPT participation. Researched June 2026; school dates and
                tuition change quickly — always confirm with the school.
              </p>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-h2">Schools with Day 1 CPT options</h2>
            <Day1CptDirectory schools={day1CptSchools} />
          </section>

          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 md:p-6">
            <h2 className="text-h2">Frequently asked questions</h2>
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {faqItems.map((item) => (
                <div className="py-4 first:pt-0 last:pb-0" key={item.question}>
                  <h3 className="text-h3">{item.question}</h3>
                  <p className="text-body-sm mt-2 max-w-[95ch]">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}


import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { LegalDirectory } from "@/components/app/legal-directory";
import { buttonVariants } from "@/components/ui/button";
import {
  getFirmPath,
  getLegalGeneratedAt,
  getLegalSources,
  isLegalSampleData
} from "@/lib/legal-directory";
import { getMergedFirms } from "@/server/legal-claims";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, siteIdentity } from "@/lib/site";

// Revalidate so a one-click status flip (pending -> claimed) in Supabase shows
// up on the public site within a minute, without a redeploy.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Immigration Lawyer Directory — Small Firms for F-1, OPT & H-1B Talent",
  description:
    "Find small U.S. immigration law firms that handle H-1B, O-1, EB-1, and NIW cases. Filter by state, practice area, language spoken, and firm size — with client ratings and bar-status badges where confirmed.",
  alternates: {
    canonical: "/lawyers"
  },
  openGraph: {
    url: absoluteUrl("/lawyers"),
    title: "Haven Immigration Lawyer Directory",
    description:
      "Small immigration firms for employment-track foreign talent — filter by practice area, language, state, and firm size."
  },
  twitter: {
    title: "Haven Immigration Lawyer Directory",
    description:
      "Small immigration firms for employment-track foreign talent — filter by practice area, language, state, and firm size."
  }
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSnapshotDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

const faqItems = [
  {
    question: "How are these firms sourced and vetted?",
    answer:
      "Firms are discovered from public business listings (Google Places), filtered to small and boutique immigration practices, and enriched with client ratings, languages, and practice focus. Where we can confirm an attorney's state-bar license is active with no public discipline, the firm shows a bar-verified badge — we're expanding that coverage. Always confirm licensing and fit with the firm directly."
  },
  {
    question: "Does a listing mean Haven endorses the firm?",
    answer:
      "No. A listing is not a referral, an endorsement, or legal advice, and Haven is not paid to list any firm. Treat the directory as a starting point: shortlist a few firms that fit your visa track and languages, then confirm licensing, scope, and fees directly before hiring."
  },
  {
    question: "Why only small firms?",
    answer:
      "Employment-track foreign talent (F-1, OPT/CPT, H-1B, EB green card) consistently reports better responsiveness and lower cost from solo and boutique immigration firms than from high-volume mills. We focus the directory on small and boutique practices to keep that signal."
  },
  {
    question: "What does the trust signal mean?",
    answer:
      "It is a relative prioritization score built from client review volume and rating, languages and practice focus coverage, profile completeness, and bar/AILA verification where confirmed. A higher score sorts more-established profiles toward the top — it is not legal advice or an endorsement of any specific firm."
  },
  {
    question: "Can I find a lawyer who speaks my language?",
    answer:
      "Yes. Use the language filter to find firms that list attorneys or staff who speak Mandarin, Spanish, Hindi, Korean, and more — often the difference between a smooth case and a stressful one."
  }
];

export default async function LawyersPage() {
  const firms = await getMergedFirms();
  const sources = getLegalSources();
  const generatedAt = getLegalGeneratedAt();
  const isSample = isLegalSampleData();
  const metroCount = new Set(firms.map((firm) => firm.metro)).size;
  const languageCount = new Set(firms.flatMap((firm) => firm.languagesSpoken)).size;
  const ratedFirms = firms.filter((firm) => firm.rating != null);
  const avgRating = ratedFirms.length
    ? ratedFirms.reduce((sum, firm) => sum + (firm.rating ?? 0), 0) / ratedFirms.length
    : 0;

  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Immigration Lawyer Directory", path: "/lawyers" }
  ]);

  const datasetData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Haven Immigration Lawyer Directory",
    description:
      "Directory of small and boutique U.S. immigration law firms that handle employment-based cases such as H-1B, O-1, EB-1, and NIW, with client ratings, languages spoken, and bar-status badges where confirmed. Built for F-1, OPT, and H-1B talent.",
    url: absoluteUrl("/lawyers").toString(),
    dateModified: generatedAt,
    isAccessibleForFree: true,
    keywords: [
      "immigration lawyer",
      "immigration attorney",
      "H-1B lawyer",
      "O-1 visa attorney",
      "EB-1 lawyer",
      "NIW attorney",
      "small immigration law firm"
    ],
    creator: { "@type": "Organization", name: siteIdentity.name, url: siteIdentity.url },
    distribution: sources.map((source) => ({
      "@type": "DataDownload",
      name: source.name,
      contentUrl: source.url
    }))
  };

  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Immigration law firms",
    numberOfItems: firms.length,
    itemListElement: firms.map((firm, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: firm.firmName,
      url: absoluteUrl(getFirmPath(firm.id)).toString()
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }} />
      <PublicNavbar currentPath="/lawyers" />

      <main className="content-container-visual py-10 md:py-14 lg:py-16">
        <div className="space-y-8">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="max-w-[78ch]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">Small immigration firms</p>
              </div>
              <h1 className="text-display mt-5 max-w-[22ch]">Find a small immigration firm that gets your visa track.</h1>
              <p className="text-body mt-5 max-w-[72ch]">
                Solo and boutique U.S. immigration firms for F-1, OPT, H-1B, and green-card talent —
                so you reach an attorney, not a high-volume mill. We surface client ratings, languages spoken, and
                practice focus, and confirm state-bar license status where we can (look for the bar-verified badge). This
                is a directory, not legal advice or an endorsement.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className={buttonVariants({ variant: "default" })} href="/jobs">
                  Find H-1B sponsors
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link className={buttonVariants({ variant: "outline" })} href="/tools/grace-period-calculator">
                  Check grace period
                </Link>
              </div>
            </div>

            <aside className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-[var(--radius-md)] bg-[var(--haven-sky-light)] p-2 text-[var(--haven-sky-ink)]">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-h3">Snapshot</p>
                  <p className="text-body-sm mt-1">Updated {formatSnapshotDate(generatedAt)}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <SnapshotMetric label="Curated firms" value={formatNumber(firms.length)} />
                <SnapshotMetric label="Metro areas" value={formatNumber(metroCount)} />
                <SnapshotMetric label="Avg client rating" value={`${avgRating.toFixed(1)}★`} />
                <SnapshotMetric label="Languages covered" value={formatNumber(languageCount)} />
              </div>
            </aside>
          </section>

          {isSample ? (
            <section className="rounded-[var(--radius-xl)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] p-5">
              <p className="text-h3">Sample data</p>
              <p className="text-body-sm mt-2 max-w-[95ch]">
                These firms are illustrative placeholders so you can preview the directory. Run the data pipeline
                (<code>scripts/legal-directory</code>) to replace them with real, bar-verified firms before publishing.
              </p>
            </section>
          ) : null}

          <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <p className="text-h3">How this directory is built</p>
            <p className="text-body-sm mt-2 max-w-[95ch]">
              Firms are discovered through public business listings and filtered to small and boutique immigration
              practices, then enriched with client ratings, languages spoken, and practice focus. Where we can confirm
              an attorney&rsquo;s state-bar license is active and free of public discipline, the firm carries a
              bar-verified badge; we&rsquo;re expanding that verification over time. Always confirm licensing, scope, and
              fees directly with the firm — a directory listing is not a referral, an endorsement, or a guarantee of
              outcome.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sources.map((source) => (
                <a
                  className="tag tag-pending min-w-0 max-w-full whitespace-normal break-words text-left"
                  href={source.url}
                  key={source.label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {source.label}
                </a>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-h3">Are you an immigration firm?</p>
              <p className="text-body-sm mt-1 max-w-[70ch]">
                Get listed in the directory and reach immigrants who need you — it&rsquo;s completely free.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "accent" })} href="/lawyers/apply">
              Get listed free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <LegalDirectory firms={firms} />

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

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--haven-cream)] px-4 py-3">
      <p className="text-caption">{label}</p>
      <p className="text-h3 mt-1">{value}</p>
    </div>
  );
}

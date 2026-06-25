import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, ShieldCheck } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { SponsorDirectory } from "@/components/app/sponsor-directory";
import { buttonVariants } from "@/components/ui/button";
import {
  getCompanyPath,
  getSponsorCompanies,
  getSponsorGeneratedAt,
  getSponsorSources
} from "@/lib/sponsor-directory";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, siteIdentity } from "@/lib/site";

export const metadata: Metadata = {
  title: "H-1B Sponsor Directory — Companies With Visa Sponsorship History",
  description:
    "Find companies with H-1B sponsorship history using recent DOL LCA filings and USCIS approval data. Compare sponsor signals, transfer volume, roles, worksites, and wages.",
  keywords: [
    "H-1B sponsor directory",
    "H-1B sponsoring companies",
    "companies that sponsor H-1B",
    "H-1B transfer employers",
    "visa sponsorship jobs",
    "LCA filings",
    "USCIS H-1B approvals"
  ],
  alternates: {
    canonical: "/jobs"
  },
  openGraph: {
    url: absoluteUrl("/jobs"),
    title: "Haven H-1B Sponsor Directory",
    description:
      "Compare companies with H-1B sponsorship history using DOL LCA filings, USCIS approval data, transfer signals, roles, worksites, and wages."
  },
  twitter: {
    title: "Haven H-1B Sponsor Directory",
    description:
      "Compare companies with H-1B sponsorship history using DOL LCA filings, USCIS approvals, transfer signals, roles, worksites, and wages."
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

function ensureHttp(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const faqItems = [
  {
    question: "Does a DOL LCA filing guarantee a company will sponsor my H-1B?",
    answer:
      "No. A certified Labor Condition Application shows the employer filed for an H-1B-class role with the Department of Labor, which is a prerequisite to an H-1B petition. It does not prove a specific current opening will be sponsored. Treat it as a prioritization signal and confirm sponsorship with the recruiter early."
  },
  {
    question: "What does the USCIS H-1B approval data show?",
    answer:
      "USCIS H-1B Employer Data Hub files report initial and continuing petition approvals and denials by employer and fiscal year. Haven surfaces FY2023 approval counts so you can see which employers have an established H-1B petition history."
  },
  {
    question: "Where does the sponsor directory data come from?",
    answer:
      "Two official government sources: the Department of Labor OFLC LCA disclosure data (FY2026 Q2) and the USCIS H-1B Employer Data Hub files (FY2023). Haven does not add private estimates — every number traces back to public filings."
  },
  {
    question: "Is this a job board?",
    answer:
      "No. It is a sponsor-history directory built to help workers — especially those in an H-1B layoff grace period — prioritize which employers to approach based on real sponsorship signals, before spending scarce time on applications."
  },
  {
    question: "How should I use this during a 60-day H-1B grace period?",
    answer:
      "Start with employers that show both recent certified LCAs and a transfer-position signal, then confirm sponsorship policy with recruiters in the first conversation. Historical filings should help you prioritize outreach; they should not replace a direct sponsorship confirmation."
  },
  {
    question: "Why does Haven show roles and worksites?",
    answer:
      "Role and worksite patterns help you see whether a company has sponsored jobs similar to your target role and location. A company with high overall volume may still be a weak fit if its filings are concentrated in unrelated roles or cities."
  }
];

export default function JobsPage() {
  const companies = getSponsorCompanies();
  const sources = getSponsorSources();
  const generatedAt = getSponsorGeneratedAt();
  const data = { companies, sources, generatedAt };
  const totalLcaCount = companies.reduce((sum, company) => sum + company.certifiedLcaCountFy2026Q2, 0);
  const totalTransferPositions = companies.reduce((sum, company) => sum + company.h1bTransferPositionsFy2026Q2, 0);
  const totalUscisApprovals = companies.reduce((sum, company) => sum + company.uscisApprovalsFy2023, 0);
  const topCompanies = [...companies]
    .sort((left, right) => right.sponsorScore - left.sponsorScore || right.certifiedLcaCountFy2026Q2 - left.certifiedLcaCountFy2026Q2)
    .slice(0, 8);

  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "H-1B Sponsor Directory", path: "/jobs" }
  ]);

  const datasetData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": absoluteUrl("/jobs#dataset").toString(),
    name: "Haven H-1B Sponsor Directory",
    description:
      "Directory of companies with recent DOL H-1B LCA filings (FY2026 Q2), H-1B transfer-position signals, common sponsored roles, worksites, wage data, and historical USCIS H-1B petition approval data (FY2023), built to help workers plan H-1B transfers.",
    url: absoluteUrl("/jobs").toString(),
    dateModified: generatedAt,
    isAccessibleForFree: true,
    keywords: ["H-1B sponsorship", "H-1B sponsors", "LCA filings", "USCIS H-1B approvals", "H-1B transfer", "visa sponsorship"],
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
    "@id": absoluteUrl("/jobs#sponsor-directory").toString(),
    name: "H-1B Sponsor Companies",
    description: "Ranked list of companies with H-1B sponsorship signals from public DOL and USCIS data.",
    numberOfItems: companies.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: companies.map((company, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(getCompanyPath(company.id)).toString(),
      item: {
        "@type": "Organization",
        name: company.companyName,
        url: absoluteUrl(getCompanyPath(company.id)).toString(),
        sameAs: company.website ? ensureHttp(company.website) : undefined,
        subjectOf: absoluteUrl(getCompanyPath(company.id)).toString(),
        additionalProperty: [
          {
            "@type": "PropertyValue",
            name: "Sponsor signal",
            value: company.sponsorScore
          },
          {
            "@type": "PropertyValue",
            name: "FY2026 Q2 certified H-1B LCAs",
            value: company.certifiedLcaCountFy2026Q2
          },
          {
            "@type": "PropertyValue",
            name: "FY2026 Q2 H-1B transfer positions",
            value: company.h1bTransferPositionsFy2026Q2
          },
          {
            "@type": "PropertyValue",
            name: "FY2023 USCIS H-1B approvals",
            value: company.uscisApprovalsFy2023
          }
        ]
      }
    }))
  };

  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "H-1B Sponsor Directory",
    description:
      "Haven's H-1B sponsor directory helps visa workers compare employers by sponsorship history, transfer signals, common roles, worksites, wages, and USCIS approval data.",
    url: absoluteUrl("/jobs").toString(),
    isPartOf: {
      "@type": "WebSite",
      name: siteIdentity.name,
      url: siteIdentity.url
    },
    publisher: { "@type": "Organization", name: siteIdentity.name, url: siteIdentity.url },
    about: [
      { "@type": "Thing", name: "H-1B sponsorship" },
      { "@type": "Thing", name: "H-1B transfer" },
      { "@type": "Thing", name: "Labor Condition Application" },
      { "@type": "Thing", name: "USCIS H-1B approvals" }
    ],
    mainEntity: { "@id": absoluteUrl("/jobs#sponsor-directory").toString() }
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }} />
      <PublicNavbar currentPath="/jobs" />

      <main className="content-container-visual py-10 md:py-14 lg:py-16">
        <div className="space-y-8">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="max-w-[78ch]">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">Official-data sponsor signals</p>
              </div>
              <h1 className="text-display mt-5 max-w-[22ch]">Find employers with H-1B sponsorship history.</h1>
              <p className="text-body mt-5 max-w-[72ch]">
                Search recent DOL LCA filings and historical USCIS approval data before you spend scarce layoff-window
                time on applications. Compare sponsor signal, H-1B transfer positions, common sponsored roles, worksites,
                wages, and approval history. This is a sponsor-history directory, not a guarantee that a specific opening
                will sponsor today.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className={buttonVariants({ variant: "default" })} href="/community/contribute">
                  Share sponsorship intel
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
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-h3">Snapshot</p>
                  <p className="text-body-sm mt-1">Generated {formatSnapshotDate(data.generatedAt)}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <SnapshotMetric label="Sponsor profiles" value={formatNumber(data.companies.length)} />
                <SnapshotMetric label="FY2026 Q2 certified LCAs" value={formatNumber(totalLcaCount)} />
                <SnapshotMetric label="H-1B transfer positions" value={formatNumber(totalTransferPositions)} />
                <SnapshotMetric label="FY2023 USCIS approvals" value={formatNumber(totalUscisApprovals)} />
              </div>
            </aside>
          </section>

          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 md:p-6">
            <div className="max-w-[86ch]">
              <h2 className="text-h2">Top H-1B sponsor signals in this dataset</h2>
              <p className="text-body-sm mt-2">
                These employers currently rank highest in Haven&rsquo;s sponsor directory because they combine recent
                certified LCA activity, H-1B transfer-position signals, and USCIS approval history. Use this as a
                shortlist for outreach, then verify sponsorship policy with each recruiter.
              </p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {topCompanies.map((company) => (
                <Link
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4 transition-colors hover:border-[var(--haven-sage-mid)] hover:bg-[var(--haven-sage-light)]"
                  href={getCompanyPath(company.id)}
                  key={company.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-h3 break-words">{company.companyName}</h3>
                      <p className="text-caption mt-1">
                        {formatNumber(company.certifiedLcaCountFy2026Q2)} certified FY2026 Q2 LCAs ·{" "}
                        {formatNumber(company.h1bTransferPositionsFy2026Q2)} transfer positions
                      </p>
                    </div>
                    <span className="shrink-0 rounded-[var(--radius-md)] bg-[var(--haven-white)] px-3 py-2 text-center">
                      <span className="block text-caption">Signal</span>
                      <span className="block text-body-sm font-semibold text-[var(--haven-ink)]">{company.sponsorScore}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <p className="text-h3">How to read this</p>
            <p className="text-body-sm mt-2 max-w-[95ch]">
              DOL LCA filings show that an employer filed labor condition applications for H-1B-class roles. USCIS data
              shows petition approval and denial history through the public Employer Data Hub archive. Neither source
              proves a company will sponsor a current job opening, so treat this as a prioritization signal and confirm
              sponsorship with recruiters early.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.sources.map((source) => (
                <a
                  className="tag tag-pending min-w-0 max-w-full whitespace-normal break-words text-left"
                  href={source.url}
                  key={source.label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {source.label} · {formatNumber(source.recordCount)} rows
                </a>
              ))}
            </div>
          </section>

          <SponsorDirectory companies={data.companies} />

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

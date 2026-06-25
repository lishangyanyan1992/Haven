import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Globe, MapPin } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import {
  getCompanyPath,
  getSponsorCompanies,
  getSponsorCompany,
  getSponsorGeneratedAt,
  getSponsorSources
} from "@/lib/sponsor-directory";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, siteIdentity } from "@/lib/site";

type CompanyPageProps = {
  params: Promise<{ company: string }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number | null) {
  if (value == null) return "Not enough data";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ensureHttp(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function formatWebsiteHost(url: string) {
  try {
    return new URL(ensureHttp(url)).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

export function generateStaticParams() {
  return getSponsorCompanies().map((company) => ({ company: company.id }));
}

export async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
  const { company: companyId } = await params;
  const company = getSponsorCompany(companyId);

  if (!company) {
    return { title: "Company not found — Haven H-1B Sponsor Directory" };
  }

  const title = `${company.companyName} — H-1B Sponsorship History & LCA Data`;
  const description = `${company.companyName} filed ${formatNumber(
    company.certifiedLcaCountFy2026Q2
  )} certified H-1B LCAs in FY2026 Q2 and had ${formatNumber(
    company.uscisApprovalsFy2023
  )} USCIS H-1B approvals in FY2023. See sponsorship signals, common roles, and worksites on Haven.`;
  const url = getCompanyPath(company.id);

  return {
    title,
    description,
    keywords: [
      `${company.companyName} H-1B sponsorship`,
      `${company.companyName} H-1B transfer`,
      `${company.companyName} LCA filings`,
      `${company.companyName} visa sponsorship`,
      "H-1B sponsor history",
      "USCIS H-1B approvals"
    ],
    alternates: { canonical: url },
    openGraph: { url: absoluteUrl(url).toString(), title, description },
    twitter: { title, description }
  };
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const { company: companyId } = await params;
  const company = getSponsorCompany(companyId);

  if (!company) {
    notFound();
  }

  const generatedAt = getSponsorGeneratedAt();
  const sources = getSponsorSources();

  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "H-1B Sponsor Directory", path: "/jobs" },
    { name: company.companyName, path: getCompanyPath(company.id) }
  ]);

  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl(`${getCompanyPath(company.id)}#organization`).toString(),
    name: company.companyName,
    url: absoluteUrl(getCompanyPath(company.id)).toString(),
    sameAs: company.website ? ensureHttp(company.website) : undefined,
    mainEntityOfPage: absoluteUrl(getCompanyPath(company.id)).toString(),
    description: `${company.companyName} is a U.S. employer with H-1B sponsorship history: ${formatNumber(
      company.certifiedLcaCountFy2026Q2
    )} certified LCAs in FY2026 Q2 and ${formatNumber(company.uscisApprovalsFy2023)} USCIS H-1B approvals in FY2023.`,
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
      },
      {
        "@type": "PropertyValue",
        name: "Median annual wage",
        value: company.medianAnnualWage ?? "Not enough data"
      }
    ],
    subjectOf: {
      "@type": "Dataset",
      "@id": absoluteUrl(`${getCompanyPath(company.id)}#dataset`).toString(),
      name: `${company.companyName} H-1B sponsorship data`,
      description: `Public DOL and USCIS sponsorship-history signals for ${company.companyName}, including certified LCAs, transfer-position signals, common roles, worksites, wages, approvals, and denials.`,
      url: absoluteUrl(getCompanyPath(company.id)).toString(),
      dateModified: generatedAt,
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: siteIdentity.name, url: siteIdentity.url },
      distribution: sources.map((source) => ({
        "@type": "DataDownload",
        name: source.name,
        contentUrl: source.url
      }))
    }
  };

  const webPageData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${company.companyName} H-1B Sponsorship History`,
    description: `${company.companyName} H-1B sponsorship profile with DOL LCA filings, H-1B transfer signals, common sponsored roles, worksites, wage data, and USCIS approval history.`,
    url: absoluteUrl(getCompanyPath(company.id)).toString(),
    isPartOf: {
      "@type": "CollectionPage",
      name: "H-1B Sponsor Directory",
      url: absoluteUrl("/jobs").toString()
    },
    publisher: { "@type": "Organization", name: siteIdentity.name, url: siteIdentity.url },
    mainEntity: { "@id": absoluteUrl(`${getCompanyPath(company.id)}#organization`).toString() },
    about: [
      { "@type": "Thing", name: "H-1B sponsorship" },
      { "@type": "Thing", name: "H-1B transfer" },
      { "@type": "Thing", name: "Labor Condition Application" }
    ]
  };

  const metrics = [
    { label: "FY2026 Q2 certified LCAs", value: formatNumber(company.certifiedLcaCountFy2026Q2) },
    { label: "H-1B transfer positions", value: formatNumber(company.h1bTransferPositionsFy2026Q2) },
    { label: "FY2023 USCIS approvals", value: formatNumber(company.uscisApprovalsFy2023) },
    { label: "Median annual wage", value: formatCurrency(company.medianAnnualWage) },
    { label: "FY2023 initial approvals", value: formatNumber(company.uscisInitialApprovalsFy2023) },
    { label: "FY2023 continuing approvals", value: formatNumber(company.uscisContinuingApprovalsFy2023) },
    { label: "FY2023 denials", value: formatNumber(company.uscisDenialsFy2023) },
    { label: "FY2026 Q2 worker positions", value: formatNumber(company.totalWorkerPositionsFy2026Q2) }
  ];

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }} />
      <PublicNavbar currentPath="/jobs" />

      <main className="content-container-visual py-10 md:py-14 lg:py-16">
        <div className="space-y-8">
          <div>
            <Link
              className="inline-flex items-center gap-1.5 text-body-sm text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
              href="/jobs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All H-1B sponsors
            </Link>
          </div>

          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="max-w-[78ch]">
              <h1 className="text-display max-w-[24ch]">{company.companyName}</h1>
              <p className="text-body mt-5 max-w-[72ch]">
                H-1B sponsorship history for {company.companyName}, compiled from official U.S. Department of Labor LCA
                filings and USCIS petition data. Latest LCA decision: {formatDate(company.latestDecisionDate)}.
              </p>
              <p className="text-body-sm mt-3 max-w-[72ch]">
                In this dataset, {company.companyName} has {formatNumber(company.certifiedLcaCountFy2026Q2)} certified
                FY2026 Q2 H-1B LCAs, {formatNumber(company.h1bTransferPositionsFy2026Q2)} H-1B transfer-position signals,
                and {formatNumber(company.uscisApprovalsFy2023)} FY2023 USCIS H-1B approvals.
              </p>
              {company.website ? (
                <a
                  className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-sky-ink)] underline-offset-4 hover:underline"
                  href={ensureHttp(company.website)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Globe className="h-4 w-4" />
                  {formatWebsiteHost(company.website)}
                </a>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link className={buttonVariants({ variant: "default" })} href="/tools/grace-period-calculator">
                  Check your grace period
                </Link>
                <Link className={buttonVariants({ variant: "outline" })} href="/community/contribute">
                  Share sponsorship intel
                </Link>
              </div>
            </div>

            <aside className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5 text-center">
              <p className="text-caption">Sponsor signal</p>
              <p className="mt-1 text-[44px] font-semibold leading-none text-[var(--haven-ink)]">{company.sponsorScore}</p>
              <p className="text-body-sm mt-3">
                Relative prioritization score from recent LCA volume and USCIS approval history. Higher means a stronger
                sponsorship track record — not a guarantee for any specific opening.
              </p>
            </aside>
          </section>

          <section>
            <h2 className="text-h2">Sponsorship signals</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-3" key={metric.label}>
                  <p className="text-caption">{metric.label}</p>
                  <p className="text-h3 mt-1">{metric.value}</p>
                </div>
              ))}
            </div>
          </section>

          {company.topRoles.length || company.topLocations.length ? (
            <section className="grid gap-4 lg:grid-cols-2">
              {company.topRoles.length ? (
                <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-[var(--haven-ink-mid)]" />
                    <h2 className="text-h3">Common sponsored roles</h2>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {company.topRoles.slice(0, 8).map((role) => (
                      <li className="flex items-center justify-between gap-3 text-body-sm" key={role.title}>
                        <span className="min-w-0 truncate text-[var(--haven-ink)]">{role.title}</span>
                        <span className="shrink-0 text-[var(--haven-ink-mid)]">{formatNumber(role.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {company.topLocations.length ? (
                <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[var(--haven-ink-mid)]" />
                    <h2 className="text-h3">Top worksites</h2>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {company.topLocations.slice(0, 8).map((location) => (
                      <li className="flex items-center justify-between gap-3 text-body-sm" key={location.location}>
                        <span className="min-w-0 truncate text-[var(--haven-ink)]">{location.location}</span>
                        <span className="shrink-0 text-[var(--haven-ink-mid)]">{formatNumber(location.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <h2 className="text-h3">About this data</h2>
            <p className="text-body-sm mt-2 max-w-[95ch]">
              These figures come from official U.S. government sources and reflect historical filings — they do not prove
              that {company.companyName} will sponsor a specific current opening. Use them to prioritize outreach, then
              confirm sponsorship with the recruiter early. Data generated {formatDate(generatedAt)}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sources.map((source) => (
                <a className="tag tag-pending" href={source.url} key={source.label} rel="noopener noreferrer" target="_blank">
                  {source.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, ShieldCheck } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { SponsorDirectory, type SponsorCompany } from "@/components/app/sponsor-directory";
import { buttonVariants } from "@/components/ui/button";
import sponsorDirectoryData from "@/data/sponsor-directory.json";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "H-1B Sponsor Directory — Find Employers With Sponsorship History",
  description:
    "Search companies with recent H-1B LCA filings and historical USCIS H-1B approval data. Built for workers planning H-1B transfers after layoffs.",
  alternates: {
    canonical: "/jobs"
  },
  openGraph: {
    url: absoluteUrl("/jobs"),
    title: "Haven H-1B Sponsor Directory",
    description:
      "Search companies with recent H-1B LCA filings and historical USCIS H-1B approval data."
  },
  twitter: {
    title: "Haven H-1B Sponsor Directory",
    description:
      "Search companies with recent H-1B LCA filings and historical USCIS H-1B approval data."
  }
};

type SponsorDirectoryData = {
  companies: SponsorCompany[];
  generatedAt: string;
  sources: Array<{
    label: string;
    name: string;
    recordCount: number;
    url: string;
  }>;
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

export default function JobsPage() {
  const data = sponsorDirectoryData as SponsorDirectoryData;
  const totalLcaCount = data.companies.reduce((sum, company) => sum + company.certifiedLcaCountFy2026Q2, 0);
  const totalTransferPositions = data.companies.reduce((sum, company) => sum + company.h1bTransferPositionsFy2026Q2, 0);
  const totalUscisApprovals = data.companies.reduce((sum, company) => sum + company.uscisApprovalsFy2023, 0);

  return (
    <div className="min-h-screen">
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
                time on applications. This is a sponsor-history directory, not a guarantee that a specific opening will
                sponsor today.
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
                <a className="tag tag-pending" href={source.url} key={source.label} rel="noopener noreferrer" target="_blank">
                  {source.label} · {formatNumber(source.recordCount)} rows
                </a>
              ))}
            </div>
          </section>

          <SponsorDirectory companies={data.companies} />
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

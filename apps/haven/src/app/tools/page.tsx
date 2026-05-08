import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, FolderOpen, Heart, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getOrganizationStructuredData } from "@/lib/site";
import { publicTools, type ToolSlug } from "@/lib/tools";
import { ToolsWorkspace } from "@/app/tools/ToolsWorkspace";

export const metadata: Metadata = {
  title: "Free Immigration Tools — H-1B Grace Period, Vaccine Finder & More",
  description:
    "Free H-1B and immigration planning tools: grace period calculator, USCIS vaccine requirement finder for Form I-693, Visa Bulletin priority date checker, and document pack builder. No login required.",
  alternates: {
    canonical: "/tools"
  },
  openGraph: {
    url: absoluteUrl("/tools"),
    title: "Free Immigration Tools — H-1B Grace Period, Vaccine Finder & More",
    description:
      "Free H-1B and immigration planning tools: grace period calculator, USCIS vaccine requirement finder for Form I-693, Visa Bulletin priority date checker, and document pack builder. No login required."
  },
  twitter: {
    title: "Free Immigration Tools — H-1B Grace Period, Vaccine Finder & More",
    description:
      "Free H-1B and immigration planning tools: grace period calculator, USCIS vaccine requirement finder for Form I-693, Visa Bulletin priority date checker, and document pack builder. No login required."
  }
};

const toolIcons: Record<ToolSlug, typeof ShieldCheck> = {
  "uscis-vaccine-finder": ShieldCheck,
  "grace-period-calculator": CalendarDays,
  "priority-date-checker": Sparkles,
  "document-pack-builder": FolderOpen
};

const situationCards = [
  {
    situation: "Just got laid off on H-1B",
    detail: "Calculate your 60-day grace period deadline based on your last day on payroll.",
    slug: "grace-period-calculator" as ToolSlug,
    toolName: "Grace period calculator"
  },
  {
    situation: "Preparing for a green card medical exam",
    detail: "See which vaccines are age-appropriate for Form I-693 before your civil surgeon appointment.",
    slug: "uscis-vaccine-finder" as ToolSlug,
    toolName: "USCIS vaccine finder"
  },
  {
    situation: "Waiting on a priority date",
    detail: "Check whether your priority date is current against the latest Visa Bulletin cutoff.",
    slug: "priority-date-checker" as ToolSlug,
    toolName: "Priority date checker"
  },
  {
    situation: "Changing employers or preparing to travel",
    detail: "Generate the document checklist for a layoff, H-1B transfer, visa stamping, or adjustment filing.",
    slug: "document-pack-builder" as ToolSlug,
    toolName: "Document pack builder"
  }
];

export default function ToolsPage() {
  const org = getOrganizationStructuredData();
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools" }
  ]);

  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Haven Free Immigration Tools",
    description:
      "Free H-1B and immigration planning tools including a grace period calculator, USCIS vaccine requirement finder, Visa Bulletin priority date checker, and document pack builder.",
    url: absoluteUrl("/tools").toString(),
    numberOfItems: publicTools.length,
    publisher: { "@type": "Organization", name: org.name, url: org.url },
    itemListElement: publicTools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.longTitle,
      description: tool.description,
      url: absoluteUrl(`/tools/${tool.slug}`).toString()
    }))
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }} />
      <PublicNavbar currentPath="/tools" />

      <main>
        {/* Hero */}
        <section className="content-container-visual py-16 lg:py-24 xl:py-28">
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
            <h1 className="text-display mt-5 max-w-[24ch]">Useful immigration tools you can open right away.</h1>
            <p className="text-body mt-6 max-w-[64ch]">
              Four free tools for the most time-sensitive immigration calculations: H-1B grace period deadlines,
              USCIS vaccine requirements for Form I-693, Visa Bulletin priority date checks, and document pack
              generation for layoffs, transfers, and adjustment of status. No account needed.
            </p>
          </div>

          {/* Which tool fits your situation */}
          <div className="mt-12">
            <p className="text-label">Which tool fits your situation?</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {situationCards.map((card) => {
                const Icon = toolIcons[card.slug];
                return (
                  <Link
                    key={card.slug}
                    href={`/tools/${card.slug}`}
                    className="group flex flex-col rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-[0_2px_12px_-4px_rgba(44,54,48,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(44,54,48,0.14)]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="text-h3 mt-4 leading-snug">{card.situation}</p>
                    <p className="text-body-sm mt-2 flex-1 text-[var(--haven-ink-mid)]">{card.detail}</p>
                    <p className="mt-4 text-[13px] font-medium text-[var(--haven-ink)] underline-offset-2 group-hover:underline">
                      {card.toolName} →
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* All tools workspace */}
        <section className="content-container-visual pb-16 lg:pb-24 xl:pb-28">
          <ToolsWorkspace />
        </section>

        {/* Coming soon */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-sand)]">
          <div className="content-container-visual py-14 lg:py-20 xl:py-24">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
              <Heart className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">Coming soon</p>
            </div>
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <h2 className="text-h1 max-w-[22ch]">Marriage green card packet builder</h2>
                <p className="text-body mt-4 max-w-[58ch]">
                  Step-by-step guidance through your I-130, I-485, I-864, I-765, and I-131 — the five interconnected
                  forms in an Adjustment of Status application. The builder checks for cross-form inconsistencies,
                  generates your document checklist, and flags whether your case needs a personal attorney before you
                  spend money on filing fees.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {["Adjustment of Status", "I-130 · I-485 · I-864", "No login required"].map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-white)] px-3 py-1 text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-3 xl:gap-4">
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
                  <div
                    key={title}
                    className="rounded-[var(--radius-lg)] border border-dashed border-[var(--haven-sky-mid)] bg-[var(--haven-white)] p-4"
                  >
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

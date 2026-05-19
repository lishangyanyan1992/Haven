import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, FolderOpen, Heart, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getOrganizationStructuredData } from "@/lib/site";
import { publicTools, type ToolSlug } from "@/lib/tools";

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

const toolCardMeta: Record<
  ToolSlug,
  {
    eyebrow: string;
    bestFor: string;
    surfaceClassName: string;
    iconClassName: string;
  }
> = {
  "uscis-vaccine-finder": {
    eyebrow: "USCIS medical exam",
    bestFor: "Green card medical exam prep before a civil surgeon visit.",
    surfaceClassName: "bg-[linear-gradient(180deg,#F8FBF6_0%,#EEF5E8_100%)]",
    iconClassName: "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
  },
  "grace-period-calculator": {
    eyebrow: "Free tool",
    bestFor: "Layoffs, employer changes, and last-day-on-payroll planning.",
    surfaceClassName: "bg-[linear-gradient(180deg,#FBFAF5_0%,#F3EDE2_100%)]",
    iconClassName: "bg-[var(--haven-sand)] text-[var(--haven-ink)]"
  },
  "priority-date-checker": {
    eyebrow: "Visa Bulletin helper",
    bestFor: "Fast checks against a published cutoff date.",
    surfaceClassName: "bg-[linear-gradient(180deg,#F4FAFD_0%,#E6F2F8_100%)]",
    iconClassName: "bg-[var(--haven-sky-light)] text-[var(--haven-sky-ink)]"
  },
  "document-pack-builder": {
    eyebrow: "Action prep",
    bestFor: "Layoff, transfer, stamping, or adjustment document triage.",
    surfaceClassName: "bg-[linear-gradient(180deg,#FBF6F4_0%,#F6E7E1_100%)]",
    iconClassName: "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
  }
};

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

          <div className="mt-12">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
              <div>
                <p className="text-label">Open each tool in its own workspace</p>
                <h2 className="text-h1 mt-4 max-w-[20ch]">Browse the tool gallery, then click through to use the live version.</h2>
              </div>
              <p className="text-body-sm max-w-[56ch] text-[var(--haven-ink-mid)] lg:justify-self-end">
                The `/tools` page is now a directory. Each card shows a small illustration of the tool layout so users can choose quickly, then open the dedicated page to interact with it.
              </p>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {publicTools.map((tool) => {
                const Icon = toolIcons[tool.slug];
                const meta = toolCardMeta[tool.slug];

                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-[0_8px_28px_-12px_rgba(44,54,48,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_38px_-14px_rgba(44,54,48,0.2)]"
                  >
                    <div className={`border-b border-[var(--color-border)] p-5 ${meta.surfaceClassName}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center rounded-full border border-[rgba(44,54,48,0.12)] bg-[rgba(255,255,255,0.72)] px-3 py-1 text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">
                          {meta.eyebrow}
                        </span>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] ${meta.iconClassName}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                      </div>
                      <div className="mt-5">
                        <ToolPreviewIllustration slug={tool.slug} />
                      </div>
                    </div>
                    <div className="flex h-full flex-col p-5">
                      <h3 className="text-h2">{tool.title}</h3>
                      <p className="text-body-sm mt-3 flex-1 text-[var(--haven-ink-mid)]">{tool.teaser}</p>
                      <p className="text-[13px] mt-4 text-[var(--haven-ink-mid)]">
                        Best for: {meta.bestFor}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--haven-ink)]">
                        Open tool
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
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

function ToolPreviewIllustration({ slug }: { slug: ToolSlug }) {
  if (slug === "uscis-vaccine-finder") {
    return (
      <div className="rounded-[calc(var(--radius-2xl)-0.5rem)] border border-[rgba(44,54,48,0.1)] bg-[rgba(255,255,255,0.82)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_136px]">
          <div className="space-y-2.5">
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
          </div>
          <div className="rounded-[18px] bg-[var(--haven-cream)] p-3">
            <div className="h-2.5 w-16 rounded-full bg-[rgba(44,54,48,0.16)]" />
            <div className="mt-3 h-7 rounded-[12px] bg-[var(--haven-white)]" />
            <div className="mt-2 h-2 w-20 rounded-full bg-[rgba(44,54,48,0.14)]" />
            <div className="mt-4 flex gap-2">
              <div className="h-6 flex-1 rounded-full bg-[var(--haven-sage-mid)]/70" />
              <div className="h-6 w-8 rounded-full bg-[rgba(44,54,48,0.08)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slug === "grace-period-calculator") {
    return (
      <div className="rounded-[calc(var(--radius-2xl)-0.5rem)] border border-[rgba(44,54,48,0.1)] bg-[rgba(255,255,255,0.82)] p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_148px]">
          <div className="space-y-2.5">
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="flex items-center gap-2 pt-1">
              <div className="h-2 w-2 rounded-full bg-[var(--haven-ink)]/45" />
              <div className="h-1.5 flex-1 rounded-full bg-[rgba(44,54,48,0.08)]" />
              <div className="h-2 w-2 rounded-full bg-[var(--haven-ink)]/45" />
            </div>
          </div>
          <div className="rounded-[18px] bg-[var(--haven-white)] p-3 shadow-[inset_0_0_0_1px_rgba(44,54,48,0.08)]">
            <div className="h-2.5 w-14 rounded-full bg-[rgba(44,54,48,0.16)]" />
            <div className="mt-3 h-10 rounded-[12px] bg-[var(--haven-sand)]" />
            <div className="mt-3 h-8 rounded-[12px] bg-[var(--haven-sage-light)]" />
          </div>
        </div>
      </div>
    );
  }

  if (slug === "priority-date-checker") {
    return (
      <div className="rounded-[calc(var(--radius-2xl)-0.5rem)] border border-[rgba(44,54,48,0.1)] bg-[rgba(255,255,255,0.82)] p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_148px]">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
            <div className="col-span-2 h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
          </div>
          <div className="rounded-[18px] bg-[var(--haven-white)] p-3 shadow-[inset_0_0_0_1px_rgba(44,54,48,0.08)]">
            <div className="h-2.5 w-12 rounded-full bg-[rgba(44,54,48,0.16)]" />
            <div className="mt-3 h-6 rounded-full bg-[var(--haven-sky-mid)]/70" />
            <div className="mt-3 h-2 w-24 rounded-full bg-[rgba(44,54,48,0.14)]" />
            <div className="mt-2 h-2 w-20 rounded-full bg-[rgba(44,54,48,0.1)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[calc(var(--radius-2xl)-0.5rem)] border border-[rgba(44,54,48,0.1)] bg-[rgba(255,255,255,0.82)] p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_148px]">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="col-span-2 h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
          <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
          <div className="h-8 rounded-[14px] bg-[rgba(44,54,48,0.08)]" />
          <div className="col-span-2 h-12 rounded-[18px] bg-[var(--haven-white)] shadow-[inset_0_0_0_1px_rgba(44,54,48,0.08)]" />
        </div>
        <div className="rounded-[18px] bg-[var(--haven-white)] p-3 shadow-[inset_0_0_0_1px_rgba(44,54,48,0.08)]">
          <div className="h-2.5 w-14 rounded-full bg-[rgba(44,54,48,0.16)]" />
          <div className="mt-3 space-y-2">
            <div className="h-2 rounded-full bg-[rgba(44,54,48,0.12)]" />
            <div className="h-2 rounded-full bg-[rgba(44,54,48,0.12)]" />
            <div className="h-2 w-4/5 rounded-full bg-[rgba(44,54,48,0.12)]" />
          </div>
          <div className="mt-4 h-8 rounded-[12px] bg-[var(--haven-blush-light)]" />
        </div>
      </div>
    </div>
  );
}

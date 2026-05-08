import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, FolderOpen, ShieldCheck, Sparkles } from "lucide-react";

import { ToolsWorkspace } from "@/app/tools/ToolsWorkspace";
import { PublicNavbar } from "@/components/app/public-navbar";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getOrganizationStructuredData } from "@/lib/site";
import { getPublicTool, publicTools, type ToolSlug } from "@/lib/tools";

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

const toolIcons: Record<ToolSlug, typeof ShieldCheck> = {
  "uscis-vaccine-finder": ShieldCheck,
  "grace-period-calculator": CalendarDays,
  "priority-date-checker": Sparkles,
  "document-pack-builder": FolderOpen
};

export async function generateStaticParams() {
  return publicTools.map((tool) => ({ slug: tool.slug }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPublicTool(slug);

  if (!tool) return {};

  return {
    title: tool.longTitle,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      url: absoluteUrl(`/tools/${tool.slug}`),
      title: tool.longTitle,
      description: tool.description
    },
    twitter: {
      title: tool.longTitle,
      description: tool.description
    }
  };
}

export default async function IndividualToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getPublicTool(slug);

  if (!tool) notFound();

  const org = getOrganizationStructuredData();
  const relatedTools = tool.relatedSlugs
    .map((s) => publicTools.find((t) => t.slug === s))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools" },
    { name: tool.title, path: `/tools/${tool.slug}` }
  ]);

  const webAppData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.longTitle,
    description: tool.description,
    url: absoluteUrl(`/tools/${tool.slug}`).toString(),
    applicationCategory: "UtilityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    publisher: { "@type": "Organization", name: org.name, url: org.url }
  };

  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer }
    }))
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }} />
      <PublicNavbar currentPath="/tools" />

      <main>
        {/* Header */}
        <section className="content-container-wide py-16 lg:py-24">
          <div className="page-intro">
            <Link
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
              href="/tools"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All free tools
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="tag tag-visa">Free tool</span>
              <span className="tag tag-visa">No login required</span>
            </div>
            <h1 className="text-display mt-5 max-w-[18ch]">{tool.longTitle}</h1>
            <p className="text-body mt-6 max-w-[64ch]">{tool.description}</p>
          </div>
        </section>

        {/* "How to use" static section — indexable by crawlers */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-sand)]">
          <div className="content-container-wide py-10 lg:py-14">
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-start">
              <div>
                <p className="text-label">How to use this tool</p>
                <h2 className="text-h2 mt-3">{tool.title}</h2>
              </div>
              <p className="text-body max-w-[68ch]">{tool.howToUse}</p>
            </div>
          </div>
        </section>

        {/* Interactive tool */}
        <section className="content-container-wide py-12 lg:py-16">
          <ToolsWorkspace toolSlugs={[tool.slug as ToolSlug]} showDirectory={false} />
        </section>

        {/* FAQ section */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-white)]">
          <div className="content-container-wide py-14 lg:py-20">
            <div className="max-w-[72ch]">
              <p className="text-label">FAQ</p>
              <h2 className="text-h1 mt-4">Common questions about this tool.</h2>
              <dl className="mt-8 flex flex-col gap-4">
                {tool.faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6"
                  >
                    <dt className="text-h2">{faq.question}</dt>
                    <dd className="text-body mt-3">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Related tools */}
        {relatedTools.length > 0 && (
          <section className="border-t border-[var(--color-border)] bg-[var(--haven-sand)]">
            <div className="content-container-wide py-14 lg:py-20">
              <p className="text-label">Related tools</p>
              <h2 className="text-h1 mt-4">Other tools that often go hand-in-hand.</h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {relatedTools.map((related) => {
                  const Icon = toolIcons[related.slug];
                  return (
                    <Link
                      key={related.slug}
                      href={`/tools/${related.slug}`}
                      className="group flex flex-col rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_4px_16px_-6px_rgba(44,54,48,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-8px_rgba(44,54,48,0.16)]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-h2 mt-4">{related.title}</h3>
                      <p className="text-body-sm mt-2 flex-1">{related.teaser}</p>
                      <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--haven-ink)]">
                        Open tool
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-cream)]">
          <div className="content-container-wide py-14 lg:py-20">
            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-10 text-[var(--haven-cream)] md:px-10 md:py-12">
              <h2 className="text-h1 max-w-[22ch] text-[var(--haven-cream)]">
                Tools for the first pass. Haven for the full decision workflow.
              </h2>
              <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
                The public tools handle immediate calculations. The full app adds a personalized timeline, layoff
                planning, and guidance organized around your actual case.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-cream)] px-6 py-3 text-[15px] font-semibold text-[var(--haven-ink)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  Get started free
                </Link>
                <Link
                  href="/tools"
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-[rgba(253,250,246,0.2)] px-6 py-3 text-[15px] font-semibold text-[var(--haven-cream)] transition-all hover:-translate-y-0.5"
                >
                  All free tools
                </Link>
              </div>
              <p className="mt-4 text-[12px] text-[rgba(253,250,246,0.45)]">Free to start · No credit card required</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

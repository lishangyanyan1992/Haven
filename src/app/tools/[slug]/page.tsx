import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";

import { ToolsWorkspace } from "@/app/tools/ToolsWorkspace";
import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData } from "@/lib/site";
import { getPublicTool, publicTools, type ToolSlug } from "@/lib/tools";

type ToolPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return publicTools.map((tool) => ({
    slug: tool.slug
  }));
}

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPublicTool(slug);

  if (!tool) {
    return {};
  }

  return {
    title: tool.longTitle,
    description: tool.description,
    alternates: {
      canonical: `/tools/${tool.slug}`
    },
    openGraph: {
      url: absoluteUrl(`/tools/${tool.slug}`),
      title: `${tool.longTitle} | Haven`,
      description: tool.description
    },
    twitter: {
      title: `${tool.longTitle} | Haven`,
      description: tool.description
    }
  };
}

export default async function IndividualToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getPublicTool(slug);

  if (!tool) {
    notFound();
  }

  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools" },
    { name: tool.title, path: `/tools/${tool.slug}` }
  ]);

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
        <div className="content-container-wide flex h-16 items-center justify-between gap-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/">
              Home
            </Link>
            <Link className="text-body-sm font-medium text-[var(--haven-ink)]" href="/tools">
              Tools
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/guides">
              Guides
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/blog">
              Blog
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/about">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/login">
              Sign in
            </Link>
            <Link className={buttonVariants({ variant: "default" })} href="/register">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="content-container-wide py-16 lg:py-24">
          <div className="page-intro">
            <Link
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
              href="/tools"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to all tools
            </Link>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
                <Share2 className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">Standalone lead magnet</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">Public URL</p>
              </div>
            </div>
            <h1 className="text-display mt-5 max-w-[14ch]">{tool.longTitle}</h1>
            <p className="text-body mt-6 max-w-[64ch]">{tool.description}</p>
          </div>
        </section>

        <section className="content-container-wide pb-16 lg:pb-24">
          <ToolsWorkspace toolSlugs={[tool.slug as ToolSlug]} showDirectory={false} />
        </section>
      </main>
    </div>
  );
}

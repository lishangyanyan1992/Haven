import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideCard } from "@/components/app/guide-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { formatGuideDate, getAllGuides, getGuide, getRelatedGuides } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getAuthorProfile } from "@/lib/site";

type GuidePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getAllGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    return {
      title: "H-1B Guides"
    };
  }

  const author = getAuthorProfile(guide.author);

  return {
    title: guide.title,
    description: guide.description,
    authors: [{ name: author.name, url: absoluteUrl(author.path).toString() }],
    alternates: {
      canonical: `/guides/${guide.slug}`
    },
    openGraph: {
      type: "article",
      url: absoluteUrl(`/guides/${guide.slug}`),
      title: guide.title,
      description: guide.description
    },
    twitter: {
      title: guide.title,
      description: guide.description
    }
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    notFound();
  }

  const author = getAuthorProfile(guide.author);
  const relatedGuides = getRelatedGuides(guide.relatedSlugs).slice(0, 3);
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: guide.title, path: `/guides/${guide.slug}` }
  ]);
  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    dateModified: new Date(guide.updatedAt).toISOString(),
    author: {
      "@type": "Person",
      name: author.name,
      description: author.description,
      url: absoluteUrl(author.path).toString()
    },
    publisher: {
      "@type": "Organization",
      name: "Haven",
      url: absoluteUrl("/").toString()
    },
    mainEntityOfPage: absoluteUrl(`/guides/${guide.slug}`).toString()
  };
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <PublicNavbar currentPath="/guides" />

      <main className="content-container-wide py-12 lg:py-20">
        <div className="mx-auto max-w-[78ch]">
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7 shadow-[0_10px_40px_-12px_rgba(44,54,48,0.14)] md:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag tag-visa">{guide.category}</span>
              <span className="text-caption">Updated {formatGuideDate(guide.updatedAt)}</span>
              <span className="text-caption">{guide.readingTime}</span>
              <span className="text-caption">By {author.name}</span>
            </div>
            <h1 className="text-display mt-5 max-w-[16ch]">{guide.title}</h1>
            <p className="text-body mt-6 max-w-[62ch]">{guide.excerpt}</p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            <article className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7 md:p-10">
              {guide.sections.map((section, index) => (
                <section key={section.heading} className={index === 0 ? "" : "mt-10"}>
                  <h2 className="text-h1">{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-body mt-4">
                      {paragraph}
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="mt-4 space-y-3 pl-5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="text-body list-disc">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}

              <section className="mt-12 border-t border-[var(--color-border)] pt-10">
                <p className="text-label">Frequently asked</p>
                <div className="mt-5 space-y-5">
                  {guide.faqs.map((faq) => (
                    <div key={faq.question} className="rounded-[var(--radius-xl)] bg-[var(--haven-sand)] p-5">
                      <h3 className="text-h3">{faq.question}</h3>
                      <p className="text-body-sm mt-2">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            </article>

            <aside className="space-y-6">
              <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-6">
                <p className="text-label">Quick takeaways</p>
                <div className="mt-4 space-y-3">
                  {guide.summaryPoints.map((point) => (
                    <p key={point} className="text-body-sm">
                      {point}
                    </p>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
                <p className="text-h3">{author.name}</p>
                <p className="text-body-sm mt-2">{author.role}</p>
                <p className="text-body-sm mt-2">{author.description}</p>
                <Link className="mt-3 inline-flex text-[13px] font-medium text-[var(--haven-ink)] underline-offset-2 hover:underline" href={author.path}>
                  Learn how Haven writes guides
                </Link>
              </div>

              <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
                <p className="text-h3">Need a clearer next step?</p>
                <p className="text-body-sm mt-2">
                  Haven turns dates, decision windows, and similar-case patterns into a plan you can actually use.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <Link className={buttonVariants({ variant: "default" })} href="/register">
                    Create your profile
                  </Link>
                  <Link className={buttonVariants({ variant: "outline" })} href="/guides">
                    All guides
                  </Link>
                </div>
              </div>
            </aside>
          </div>

          <section className="mt-14">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[56ch]">
                <p className="text-label">Related guides</p>
                <h2 className="text-h1 mt-3">Keep building the full picture.</h2>
              </div>
              <Link className={buttonVariants({ variant: "outline" })} href="/guides">
                Browse all guides
              </Link>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {relatedGuides.map((relatedGuide) => (
                <GuideCard key={relatedGuide.slug} guide={relatedGuide} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

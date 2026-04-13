import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { formatBlogDate, getAllBlogPosts, getBlogPost } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getAuthorProfile } from "@/lib/site";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: "Blog | Haven"
    };
  }

  const author = getAuthorProfile(post.author);

  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    authors: [{ name: author.name, url: absoluteUrl(author.path).toString() }],
    alternates: {
      canonical: `/blog/${post.slug}`
    },
    openGraph: {
      type: "article",
      url: absoluteUrl(`/blog/${post.slug}`),
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      publishedTime: new Date(post.publishedAt).toISOString(),
      authors: [post.author],
      images: post.image
        ? [
            {
              url: absoluteUrl(post.image.src).toString(),
              width: post.image.width,
              height: post.image.height,
              alt: post.image.alt
            }
          ]
        : undefined
    },
    twitter: {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      images: post.image ? [absoluteUrl(post.image.src).toString()] : undefined
    }
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const author = getAuthorProfile(post.author);
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` }
  ]);
  const blogPostingData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription ?? post.excerpt,
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.publishedAt).toISOString(),
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
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`).toString()
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingData) }} />
      <PublicNavbar currentPath="/blog" />

      <main className="content-container-wide py-12 lg:py-20">
        <div className="mx-auto max-w-[78ch]">
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7 shadow-[0_10px_40px_-12px_rgba(44,54,48,0.14)] md:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag tag-visa">{post.category}</span>
              <span className="text-caption">{formatBlogDate(post.publishedAt)}</span>
              <span className="text-caption">{post.readingTime}</span>
              <span className="text-caption">By {author.name}</span>
            </div>
            <h1 className="text-display mt-5 max-w-[16ch]">{post.title}</h1>
            <p className="text-body mt-6 max-w-[62ch]">{post.excerpt}</p>
            {post.image ? (
              <figure className="mt-8 overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-cream)]">
                <Image
                  src={post.image.src}
                  alt={post.image.alt}
                  width={post.image.width}
                  height={post.image.height}
                  className="h-auto w-full"
                  priority
                />
                {post.image.caption ? (
                  <figcaption className="border-t border-[var(--color-border)] px-5 py-4 text-body-sm">
                    {post.image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            <article className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7 md:p-10">
              {post.sections.map((section, index) => (
                <section key={section.heading ?? index} className={index === 0 ? "" : "mt-10"}>
                  {section.heading ? <h2 className="text-h1">{section.heading}</h2> : null}
                  {section.paragraphs?.map((paragraph) => (
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
                  {section.note ? (
                    <div className="mt-5 rounded-[var(--radius-xl)] bg-[var(--haven-sky-light)] px-4 py-4">
                      <p className="text-body-sm text-[var(--haven-sky-ink)]">{section.note}</p>
                    </div>
                  ) : null}
                </section>
              ))}
              {post.sources?.length ? (
                <section className="mt-12 border-t border-[var(--color-border)] pt-10">
                  <p className="text-label">Sources</p>
                  <div className="mt-5 space-y-4">
                    {post.sources.map((source) => (
                      <div key={source.url} className="rounded-[var(--radius-xl)] bg-[var(--haven-sand)] p-5">
                        <p className="text-h3">{source.title}</p>
                        <p className="text-body-sm mt-2">{source.publisher}</p>
                        <a
                          className="mt-3 inline-flex text-[13px] font-medium text-[var(--haven-ink)] underline-offset-2 hover:underline"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>

            <aside className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-6">
              <p className="text-label">Key takeaways</p>
              <div className="mt-4 space-y-3">
                {post.keyTakeaways.map((takeaway) => (
                  <p key={takeaway} className="text-body-sm">
                    {takeaway}
                  </p>
                ))}
              </div>
              <div className="mt-8 border-t border-[var(--color-border)] pt-6">
                <p className="text-h3">{author.name}</p>
                <p className="text-body-sm mt-2">{author.role}</p>
                <p className="text-body-sm mt-2">{author.description}</p>
                <Link className="mt-3 inline-flex text-[13px] font-medium text-[var(--haven-ink)] underline-offset-2 hover:underline" href={author.path}>
                  More about Haven
                </Link>
              </div>
              <div className="mt-8 border-t border-[var(--color-border)] pt-6">
                <p className="text-h3">Want tools, not just articles?</p>
                <p className="text-body-sm mt-2">
                  Haven turns timelines, action windows, and next steps into something you can actually use.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <Link className={buttonVariants({ variant: "default" })} href="/register">
                    Create your profile
                  </Link>
                  <Link className={buttonVariants({ variant: "outline" })} href="/blog">
                    Back to blog
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

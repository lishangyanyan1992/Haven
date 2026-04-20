import type { Metadata } from "next";
import Link from "next/link";

import { BlogCard } from "@/components/app/blog-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import { getAllBlogPosts, fromBlogCategorySlug, getBlogPostsByCategory, getFeaturedBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { getOrganizationStructuredData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog — H-1B Layoffs, Visa Transfers & Immigration Planning",
  description:
    "Practical immigration articles for H-1B holders, F-1/OPT graduates, and employment-based green card applicants. Covers layoffs, grace periods, transfers, USCIS policy, and priority date planning.",
  alternates: {
    canonical: "/blog"
  },
  openGraph: {
    url: absoluteUrl("/blog"),
    title: "Haven Blog — Immigration Planning for H-1B & Green Card Holders",
    description:
      "Practical immigration articles for H-1B holders, F-1/OPT graduates, and employment-based green card applicants. Covers layoffs, grace periods, transfers, USCIS policy, and priority date planning.",
    images: [
      {
        url: absoluteUrl("/blog/haven-blog-cover.svg").toString(),
        width: 1600,
        height: 900,
        alt: "Haven blog — immigration planning guides"
      }
    ]
  },
  twitter: {
    title: "Haven Blog — Immigration Planning for H-1B & Green Card Holders",
    description:
      "Practical immigration articles for H-1B holders, F-1/OPT graduates, and employment-based green card applicants. Covers layoffs, grace periods, transfers, USCIS policy, and priority date planning.",
    images: [absoluteUrl("/blog/haven-blog-cover.svg").toString()]
  }
};

type BlogIndexPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    view?: string | string[];
  }>;
};

function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getBlogIndexHref(options: { view?: "category" | "date"; categorySlug?: string }): string {
  const params = new URLSearchParams();
  if (options.view === "date") params.set("view", "date");
  if (options.view !== "date" && options.categorySlug) params.set("category", options.categorySlug);
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const posts = getAllBlogPosts();
  const featuredPosts = getFeaturedBlogPosts();
  const groupedPosts = getBlogPostsByCategory(posts);
  const selectedView = getSearchParamValue(resolvedSearchParams.view);
  const isDateView = selectedView === "date";
  const selectedCategorySlug = getSearchParamValue(resolvedSearchParams.category);
  const selectedCategory = !isDateView && selectedCategorySlug ? fromBlogCategorySlug(selectedCategorySlug) : undefined;
  const visibleGroups = selectedCategory
    ? groupedPosts.filter((group) => group.category === selectedCategory)
    : groupedPosts;
  const visiblePostCount = visibleGroups.reduce((count, group) => count + group.posts.length, 0);
  const org = getOrganizationStructuredData();

  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Haven Blog — Immigration Planning Guides",
    description:
      "Practical immigration guides for H-1B holders, F-1/OPT graduates, and employment-based green card applicants navigating layoffs, transfers, grace periods, and USCIS policy.",
    url: absoluteUrl("/blog").toString(),
    publisher: {
      "@type": "Organization",
      name: org.name,
      url: org.url
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.slice(0, 12).map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.title,
        description: post.excerpt,
        url: absoluteUrl(`/blog/${post.slug}`).toString()
      }))
    }
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageData) }}
      />
      <PublicNavbar currentPath="/blog" />

      <main>
        {/* Hero */}
        <section className="content-container-visual py-16 lg:py-24 xl:py-28">
          <div className="max-w-[82ch]">
            <p className="text-label">Haven blog</p>
            <h1 className="text-display mt-5 max-w-[28ch]">Guidance for the moments when immigration gets noisy.</h1>
            <p className="text-body mt-6 max-w-[70ch]">
              Practical, decision-oriented articles for H-1B holders, F-1/OPT graduates, and employment-based green
              card applicants. We cover layoffs, grace periods, H-1B transfers, PERM delays, priority dates, and
              USCIS policy changes — written by people who&apos;ve navigated the system firsthand.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {["H-1B layoffs", "Visa transfers", "Grace periods", "PERM & EB green card", "USCIS policy", "Citizenship"].map((topic) => (
                <span key={topic} className="tag tag-visa">{topic}</span>
              ))}
            </div>
            <p className="text-caption mt-5">
              {posts.length} articles across {groupedPosts.length} topics
            </p>
          </div>

          {/* Featured / Start here */}
          {featuredPosts.length > 0 && (
            <div className="mt-12">
              <div className="mb-5 flex items-center gap-3">
                <p className="text-label">Start here</p>
                <span className="text-caption text-[var(--haven-ink-mid)]">Most-read guides for H-1B holders</span>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {featuredPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            </div>
          )}

          {/* Filter panel */}
          <div className="mt-12 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)]/80 p-6 shadow-[0_8px_30px_-12px_rgba(44,54,48,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-label">{isDateView ? "Browse by date" : "Browse by category"}</p>
                <p className="text-body mt-2 max-w-[72ch]">
                  {isDateView
                    ? "See the full editorial library in reverse chronological order."
                    : "Filter the blog by topic, or switch to a simple date-based view."}
                </p>
              </div>
              <p className="text-caption">
                {isDateView
                  ? `${posts.length} total articles`
                  : selectedCategory
                    ? `${visiblePostCount} article${visiblePostCount === 1 ? "" : "s"} in ${selectedCategory}`
                    : `${posts.length} total articles`}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={getBlogIndexHref({ view: "category", categorySlug: selectedCategorySlug })}
                className={isDateView ? "tag tag-pending" : "tag tag-active"}
              >
                By category
              </Link>
              <Link
                href={getBlogIndexHref({ view: "date" })}
                className={isDateView ? "tag tag-active" : "tag tag-pending"}
              >
                By date
              </Link>
            </div>

            {!isDateView ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={getBlogIndexHref({ view: "category" })}
                  className={selectedCategory ? "tag tag-pending" : "tag tag-active"}
                >
                  All articles
                </Link>
                {groupedPosts.map((group) => {
                  const isSelected = group.category === selectedCategory;
                  return (
                    <Link
                      key={group.category}
                      href={getBlogIndexHref({ view: "category", categorySlug: group.categorySlug })}
                      className={isSelected ? "tag tag-active" : "tag tag-visa"}
                    >
                      {group.category} · {group.posts.length}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Articles */}
          <div className="mt-12 space-y-12">
            {isDateView ? (
              <section className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {posts.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            ) : (
              visibleGroups.map((group) => (
                <section key={group.category} id={group.categorySlug} className="space-y-6">
                  <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-[76ch]">
                      <p className="text-label">{group.category}</p>
                      <h2 className="text-h1 mt-3">{group.category}</h2>
                      <p className="text-body mt-3">{group.description}</p>
                    </div>
                    <p className="text-caption">{group.posts.length} article{group.posts.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {group.posts.map((post) => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                </section>
              ))
            )}

            {!isDateView && visibleGroups.length === 0 ? (
              <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-8">
                <p className="text-h2">No articles match that category.</p>
                <p className="text-body mt-3 max-w-[60ch]">Try another filter or return to the full blog index.</p>
                <div className="mt-6">
                  <Link href={getBlogIndexHref({ view: "category" })} className="tag tag-active">
                    View all articles
                  </Link>
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

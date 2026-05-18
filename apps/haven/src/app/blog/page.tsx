import type { Metadata } from "next";
import Link from "next/link";

import { BlogCard } from "@/components/app/blog-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import { fromBlogCategorySlug, getAllBlogPosts, getBlogCategories, getFeaturedBlogPosts, toBlogCategorySlug } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { getOrganizationStructuredData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog — Immigration Updates, Policy Notes & Editorial",
  description:
    "Haven's blog for immigration updates, policy notes, founder perspective, and selected analysis on what changed and why it matters.",
  alternates: {
    canonical: "/blog"
  },
  openGraph: {
    url: absoluteUrl("/blog"),
    title: "Haven Blog — Immigration Updates & Editorial",
    description:
      "Haven's blog for immigration updates, policy notes, founder perspective, and selected analysis on what changed and why it matters.",
    images: [
      {
        url: absoluteUrl("/blog/haven-blog-cover.svg").toString(),
        width: 1600,
        height: 900,
        alt: "Haven blog — immigration updates and editorial"
      }
    ]
  },
  twitter: {
    title: "Haven Blog — Immigration Updates & Editorial",
    description:
      "Haven's blog for immigration updates, policy notes, founder perspective, and selected analysis on what changed and why it matters.",
    images: [absoluteUrl("/blog/haven-blog-cover.svg").toString()]
  }
};

type BlogIndexPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
  }>;
};

function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getBlogIndexHref(options: { categorySlug?: string }): string {
  const params = new URLSearchParams();
  if (options.categorySlug) params.set("category", options.categorySlug);
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const posts = getAllBlogPosts();
  const featuredPosts = getFeaturedBlogPosts();
  const blogCategories = getBlogCategories(posts);
  const selectedCategorySlug = getSearchParamValue(resolvedSearchParams.category);
  const selectedCategory = selectedCategorySlug ? fromBlogCategorySlug(selectedCategorySlug, posts) : undefined;
  const visiblePosts = selectedCategory ? posts.filter((post) => post.category === selectedCategory) : posts;
  const org = getOrganizationStructuredData();

  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Haven Blog — Immigration Updates & Editorial",
    description:
      "Haven's blog for immigration updates, policy notes, founder perspective, and selected analysis on what changed and why it matters.",
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
            <h1 className="text-display mt-5 max-w-[24ch]">Updates, analysis, and editorial context when the rules keep moving.</h1>
            <p className="text-body mt-6 max-w-[70ch]">
              This is the lighter editorial stream: policy updates, visa bulletin movement, founder perspective, and
              selected commentary on the moments that change how people plan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {["Policy updates", "Visa bulletin", "Founder story", "Selected H-1B analysis"].map((topic) => (
                <span key={topic} className="tag tag-visa">{topic}</span>
              ))}
            </div>
            <p className="text-caption mt-5">
              {posts.length} articles across {blogCategories.length} topics
            </p>
          </div>

          {/* Featured / Start here */}
          {featuredPosts.length > 0 && (
            <div className="mt-12">
              <div className="mb-5 flex items-center gap-3">
                <p className="text-label">Featured</p>
                <span className="text-caption text-[var(--haven-ink-mid)]">Recent context from the editorial stream</span>
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
                <p className="text-label">Browse by date</p>
                <p className="text-body mt-2 max-w-[72ch]">
                  The blog defaults to newest-first. Use the topic filters to narrow the stream without changing the layout.
                </p>
              </div>
              <p className="text-caption">
                {selectedCategory
                  ? `${visiblePosts.length} article${visiblePosts.length === 1 ? "" : "s"} in ${selectedCategory}`
                  : `${posts.length} total articles`}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={getBlogIndexHref({})} className={selectedCategory ? "tag tag-pending" : "tag tag-active"}>
                All articles
              </Link>
              {blogCategories.map((category) => {
                const isSelected = category === selectedCategory;
                const categoryCount = posts.filter((post) => post.category === category).length;

                return (
                  <Link
                    key={category}
                    href={getBlogIndexHref({ categorySlug: toBlogCategorySlug(category) })}
                    className={isSelected ? "tag tag-active" : "tag tag-visa"}
                  >
                    {category} · {categoryCount}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-12 space-y-6">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[76ch]">
                <p className="text-label">{selectedCategory ? selectedCategory : "Latest posts"}</p>
                <h2 className="text-h1 mt-3">
                  {selectedCategory ? `${selectedCategory} articles` : "Newest articles first"}
                </h2>
                <p className="text-body mt-3">
                  {selectedCategory
                    ? "Filtered by label, still sorted by publish date so the latest changes stay at the top."
                    : "Every article in the blog stream, sorted by publish date with the newest posts first."}
                </p>
              </div>
              <p className="text-caption">{visiblePosts.length} article{visiblePosts.length === 1 ? "" : "s"}</p>
            </div>

            {visiblePosts.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visiblePosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            ) : (
              <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-8">
                <p className="text-h2">No articles match that category.</p>
                <p className="text-body mt-3 max-w-[60ch]">Try another filter or return to the full blog index.</p>
                <div className="mt-6">
                  <Link href={getBlogIndexHref({})} className="tag tag-active">
                    View all articles
                  </Link>
                </div>
              </section>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

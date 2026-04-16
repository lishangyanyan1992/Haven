import type { Metadata } from "next";
import Link from "next/link";

import { BlogCard } from "@/components/app/blog-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import { getAllBlogPosts, fromBlogCategorySlug, getBlogPostsByCategory } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides for visa timelines, layoffs, employer changes, and practical immigration planning.",
  alternates: {
    canonical: "/blog"
  },
  openGraph: {
    url: absoluteUrl("/blog"),
    title: "Haven Blog",
    description: "Guides for visa timelines, layoffs, employer changes, and practical immigration planning.",
    images: [
      {
        url: absoluteUrl("/blog/haven-blog-cover.svg").toString(),
        width: 1600,
        height: 900,
        alt: "Haven blog cover"
      }
    ]
  },
  twitter: {
    title: "Haven Blog",
    description: "Guides for visa timelines, layoffs, employer changes, and practical immigration planning.",
    images: [absoluteUrl("/blog/haven-blog-cover.svg").toString()]
  }
};

type BlogIndexPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
  }>;
};

function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function BlogIndexPage({ searchParams }: BlogIndexPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const posts = getAllBlogPosts();
  const groupedPosts = getBlogPostsByCategory(posts);
  const selectedCategorySlug = getSearchParamValue(resolvedSearchParams.category);
  const selectedCategory = selectedCategorySlug ? fromBlogCategorySlug(selectedCategorySlug) : undefined;
  const visibleGroups = selectedCategory
    ? groupedPosts.filter((group) => group.category === selectedCategory)
    : groupedPosts;
  const visiblePostCount = visibleGroups.reduce((count, group) => count + group.posts.length, 0);

  return (
    <div className="min-h-screen">
      <PublicNavbar currentPath="/blog" />

      <main>
        <section className="content-container-visual py-16 lg:py-24 xl:py-28">
          <div className="max-w-[82ch]">
            <p className="text-label">Haven blog</p>
            <h1 className="text-display mt-5 max-w-[18ch]">Guidance for the moments when immigration gets noisy.</h1>
            <p className="text-body mt-6 max-w-[70ch]">
              These articles are built to be practical: what to verify, what to track, and what usually matters next for H-1B and adjacent visa holders.
            </p>
          </div>

          <div className="mt-12 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)]/80 p-6 shadow-[0_8px_30px_-12px_rgba(44,54,48,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-label">Browse by category</p>
                <p className="text-body mt-2 max-w-[72ch]">
                  Filter the blog by topic, or browse the full editorial library grouped into categories.
                </p>
              </div>
              <p className="text-caption">
                {selectedCategory ? `${visiblePostCount} article${visiblePostCount === 1 ? "" : "s"} in ${selectedCategory}` : `${posts.length} total articles`}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/blog"
                className={selectedCategory ? "tag tag-pending" : "tag tag-active"}
              >
                All articles
              </Link>
              {groupedPosts.map((group) => {
                const isSelected = group.category === selectedCategory;

                return (
                  <Link
                    key={group.category}
                    href={`/blog?category=${group.categorySlug}`}
                    className={isSelected ? "tag tag-active" : "tag tag-visa"}
                  >
                    {group.category} · {group.posts.length}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-12 space-y-12">
            {visibleGroups.map((group) => (
              <section
                key={group.category}
                id={group.categorySlug}
                className="space-y-6"
              >
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
            ))}

            {visibleGroups.length === 0 ? (
              <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-8">
                <p className="text-h2">No articles match that category.</p>
                <p className="text-body mt-3 max-w-[60ch]">
                  Try another filter or return to the full blog index.
                </p>
                <div className="mt-6">
                  <Link href="/blog" className="tag tag-active">
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

import type { Metadata } from "next";
import Link from "next/link";

import { BlogCard } from "@/components/app/blog-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import {
  getAllResourcePosts,
  getResourcePostsByCategory,
  fromResourceCategorySlug
} from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { getOrganizationStructuredData } from "@/lib/site";

export const metadata: Metadata = {
  title: "Resources — Immigration Guides, H-1B Help & Reference Articles",
  description:
    "Practical immigration resources for H-1B holders, visa applicants, and green card families. Browse by topic across H-1B, visa basics, citizenship, inadmissibility, family immigration, employment green cards, and more.",
  alternates: {
    canonical: "/resources"
  },
  openGraph: {
    url: absoluteUrl("/resources"),
    title: "Haven Resources — Immigration Guides & Reference Articles",
    description:
      "Practical immigration resources for H-1B holders, visa applicants, and green card families. Browse by topic across H-1B, visa basics, citizenship, inadmissibility, family immigration, employment green cards, and more.",
    images: [
      {
        url: absoluteUrl("/blog/haven-blog-cover.svg").toString(),
        width: 1600,
        height: 900,
        alt: "Haven resources — immigration guides and reference articles"
      }
    ]
  },
  twitter: {
    title: "Haven Resources — Immigration Guides & Reference Articles",
    description:
      "Practical immigration resources for H-1B holders, visa applicants, and green card families. Browse by topic across H-1B, visa basics, citizenship, inadmissibility, family immigration, employment green cards, and more.",
    images: [absoluteUrl("/blog/haven-blog-cover.svg").toString()]
  }
};

type ResourcesIndexPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    view?: string | string[];
  }>;
};

function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getResourcesIndexHref(options: { view?: "category" | "date"; categorySlug?: string }): string {
  const params = new URLSearchParams();
  if (options.view === "date") params.set("view", "date");
  if (options.view !== "date" && options.categorySlug) params.set("category", options.categorySlug);
  const query = params.toString();
  return query ? `/resources?${query}` : "/resources";
}

export default async function ResourcesIndexPage({ searchParams }: ResourcesIndexPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const posts = getAllResourcePosts();
  const groupedPosts = getResourcePostsByCategory(posts);
  const selectedView = getSearchParamValue(resolvedSearchParams.view);
  const isDateView = selectedView === "date";
  const selectedCategorySlug = getSearchParamValue(resolvedSearchParams.category);
  const selectedCategory = !isDateView && selectedCategorySlug ? fromResourceCategorySlug(selectedCategorySlug, posts) : undefined;
  const visibleGroups = selectedCategory
    ? groupedPosts.filter((group) => group.category === selectedCategory)
    : groupedPosts;
  const visiblePostCount = visibleGroups.reduce((count, group) => count + group.posts.length, 0);
  const org = getOrganizationStructuredData();

  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Haven Resources — Immigration Guides & Reference Articles",
    description:
      "Practical immigration resources for H-1B holders, visa applicants, and green card families across H-1B, visa basics, citizenship, inadmissibility, family immigration, employment green cards, and more.",
    url: absoluteUrl("/resources").toString(),
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
        url: absoluteUrl(`/resources/${post.slug}`).toString()
      }))
    }
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageData) }}
      />
      <PublicNavbar currentPath="/resources" />

      <main>
        <section className="content-container-visual py-16 lg:py-24 xl:py-28">
          <div className="max-w-[82ch]">
            <p className="text-label">Haven resources</p>
            <h1 className="text-display mt-5 max-w-[22ch]">The reference library for practical immigration questions.</h1>
            <p className="text-body mt-6 max-w-[70ch]">
              This is where the detailed resource library lives: H-1B transfers and grace periods, visa basics,
              medical exam requirements, citizenship, inadmissibility, family immigration, employment green cards,
              humanitarian pathways, and tool reviews.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {["H-1B", "Visa basics", "Citizenship", "Family immigration", "Employment green card", "Medical exam"].map((topic) => (
                <span key={topic} className="tag tag-visa">{topic}</span>
              ))}
            </div>
            <p className="text-caption mt-5">
              {posts.length} resources across {groupedPosts.length} topics
            </p>
          </div>

          <div className="mt-12 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)]/80 p-6 shadow-[0_8px_30px_-12px_rgba(44,54,48,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-label">{isDateView ? "Browse by date" : "Browse by category"}</p>
                <p className="text-body mt-2 max-w-[72ch]">
                  {isDateView
                    ? "See the full resource library in reverse chronological order."
                    : "Browse the library through broader reference buckets, or switch to a simple date-based view."}
                </p>
              </div>
              <p className="text-caption">
                {isDateView
                  ? `${posts.length} total resources`
                  : selectedCategory
                    ? `${visiblePostCount} resource${visiblePostCount === 1 ? "" : "s"} in ${selectedCategory}`
                    : `${posts.length} total resources`}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={getResourcesIndexHref({ view: "category", categorySlug: selectedCategorySlug })}
                className={isDateView ? "tag tag-pending" : "tag tag-active"}
              >
                By category
              </Link>
              <Link
                href={getResourcesIndexHref({ view: "date" })}
                className={isDateView ? "tag tag-active" : "tag tag-pending"}
              >
                By date
              </Link>
            </div>

            {!isDateView ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={getResourcesIndexHref({ view: "category" })}
                  className={selectedCategory ? "tag tag-pending" : "tag tag-active"}
                >
                  All resources
                </Link>
                {groupedPosts.map((group) => {
                  const isSelected = group.category === selectedCategory;
                  return (
                    <Link
                      key={group.category}
                      href={getResourcesIndexHref({ view: "category", categorySlug: group.categorySlug })}
                      className={isSelected ? "tag tag-active" : "tag tag-visa"}
                    >
                      {group.category} · {group.posts.length}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

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
                    <p className="text-caption">{group.posts.length} resource{group.posts.length === 1 ? "" : "s"}</p>
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
                <p className="text-h2">No resources match that category.</p>
                <p className="text-body mt-3 max-w-[60ch]">Try another filter or return to the full resources index.</p>
                <div className="mt-6">
                  <Link href={getResourcesIndexHref({ view: "category" })} className="tag tag-active">
                    View all resources
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

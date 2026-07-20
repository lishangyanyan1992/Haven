import type { Metadata } from "next";

import { BlogCard } from "@/components/app/blog-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import { ResourcesExplorer } from "@/components/app/resources-explorer";
import { getAllResourcePosts, getResourcePostsByCategory } from "@/lib/blog";
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

export default function ResourcesIndexPage() {
  const posts = getAllResourcePosts();
  const groupedPosts = getResourcePostsByCategory(posts);
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

          <ResourcesExplorer
            totalCount={posts.length}
            categories={groupedPosts.map((group) => ({
              category: group.category,
              slug: group.categorySlug,
              count: group.posts.length
            }))}
            groups={groupedPosts.map((group) => ({
              slug: group.categorySlug,
              node: (
                <section id={group.categorySlug} className="space-y-6">
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
              )
            }))}
            dateView={
              <section className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {posts.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </div>
              </section>
            }
          />
        </section>
      </main>
    </div>
  );
}

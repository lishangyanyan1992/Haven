import type { Metadata } from "next";

import { BlogCard } from "@/components/app/blog-card";
import { BlogExplorer } from "@/components/app/blog-explorer";
import { PublicNavbar } from "@/components/app/public-navbar";
import { getAllBlogPosts, getBlogCategories, getFeaturedBlogPosts, toBlogCategorySlug } from "@/lib/blog";
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

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();
  const featuredPosts = getFeaturedBlogPosts();
  const blogCategories = getBlogCategories(posts);
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

          <BlogExplorer
            totalCount={posts.length}
            categories={blogCategories.map((category) => ({
              category,
              slug: toBlogCategorySlug(category),
              count: posts.filter((post) => post.category === category).length
            }))}
            posts={posts.map((post) => ({
              slug: post.slug,
              categorySlug: toBlogCategorySlug(post.category),
              node: <BlogCard post={post} />
            }))}
          />
        </section>
      </main>
    </div>
  );
}

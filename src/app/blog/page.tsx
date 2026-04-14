import type { Metadata } from "next";

import { BlogCard } from "@/components/app/blog-card";
import { PublicNavbar } from "@/components/app/public-navbar";
import { getAllBlogPosts } from "@/lib/blog";
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

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

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

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

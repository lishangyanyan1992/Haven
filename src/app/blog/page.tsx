import type { Metadata } from "next";
import Link from "next/link";

import { BlogCard } from "@/components/app/blog-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
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
    description: "Guides for visa timelines, layoffs, employer changes, and practical immigration planning."
  },
  twitter: {
    title: "Haven Blog",
    description: "Guides for visa timelines, layoffs, employer changes, and practical immigration planning."
  }
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
        <div className="content-container-wide flex h-16 items-center justify-between gap-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <div className="flex items-center gap-3">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/">
              Home
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/guides">
              Guides
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/about">
              About
            </Link>
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
          <div className="max-w-[72ch]">
            <p className="text-label">Haven blog</p>
            <h1 className="text-display mt-5 max-w-[14ch]">Guidance for the moments when immigration gets noisy.</h1>
            <p className="text-body mt-6 max-w-[62ch]">
              These articles are built to be practical: what to verify, what to track, and what usually matters next for H-1B and adjacent visa holders.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

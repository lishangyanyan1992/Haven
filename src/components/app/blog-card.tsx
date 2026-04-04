import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BlogPost } from "@/content/blog";
import { formatBlogDate } from "@/lib/blog";

type BlogCardProps = {
  post: BlogPost;
};

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_8px_30px_-12px_rgba(44,54,48,0.12)] transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag tag-visa">{post.category}</span>
        <span className="text-caption">{formatBlogDate(post.publishedAt)}</span>
        <span className="text-caption">{post.readingTime}</span>
      </div>
      <h3 className="text-h2 mt-4">{post.title}</h3>
      <p className="text-body mt-3 flex-1">{post.excerpt}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-[14px] font-medium text-[var(--haven-ink)]">
        Read article
        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

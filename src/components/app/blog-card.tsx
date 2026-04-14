import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { BlogPost } from "@/content/blog";
import { formatBlogDate, getBlogImage } from "@/lib/blog";

type BlogCardProps = {
  post: BlogPost;
};

export function BlogCard({ post }: BlogCardProps) {
  const image = getBlogImage(post);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-[0_8px_30px_-12px_rgba(44,54,48,0.12)] transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="border-b border-[var(--color-border)] bg-[var(--haven-cream)]">
        <Image src={image.src} alt={image.alt} width={image.width} height={image.height} className="h-auto w-full" />
      </div>
      <div className="flex h-full flex-col p-6">
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
      </div>
    </Link>
  );
}

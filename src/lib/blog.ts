import { blogPosts, type BlogPost } from "@/content/blog";

const blogDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

export function getAllBlogPosts(): BlogPost[] {
  return [...blogPosts].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

export function getRecentBlogPosts(limit = 3): BlogPost[] {
  return getAllBlogPosts().slice(0, limit);
}

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function formatBlogDate(date: string): string {
  return blogDateFormatter.format(new Date(date));
}

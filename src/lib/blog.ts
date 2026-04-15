import { blogPosts, type BlogImage, type BlogPost } from "@/content/blog";

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

export function getRelatedBlogPosts(post: BlogPost, limit = 3): BlogPost[] {
  const explicitRelated = (post.relatedSlugs ?? [])
    .map((slug) => getBlogPost(slug))
    .filter((candidate): candidate is BlogPost => Boolean(candidate))
    .filter((candidate) => candidate.slug !== post.slug);

  if (explicitRelated.length >= limit) {
    return explicitRelated.slice(0, limit);
  }

  const fallback = getAllBlogPosts().filter(
    (candidate) =>
      candidate.slug !== post.slug &&
      candidate.category === post.category &&
      !explicitRelated.some((related) => related.slug === candidate.slug)
  );

  return [...explicitRelated, ...fallback].slice(0, limit);
}

export function formatBlogDate(date: string): string {
  return blogDateFormatter.format(new Date(date));
}

export function getBlogImage(post: BlogPost): BlogImage {
  return (
    post.image ?? {
      src: "/blog/haven-blog-cover.svg",
      alt: `${post.title} | Haven blog cover`,
      width: 1600,
      height: 900
    }
  );
}

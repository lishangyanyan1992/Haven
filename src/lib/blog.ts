import { blogPosts, type BlogImage, type BlogPost } from "@/content/blog";

const blogDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

const blogCategoryOrder = [
  "Founder story",
  "Layoff planning",
  "Job changes",
  "Green card planning",
  "Permanent residency",
  "Family immigration",
  "Employment immigration",
  "Humanitarian relief",
  "Visa basics",
  "Legal basics",
  "Policy explainer",
  "Medical exam"
] as const;

const blogCategoryDescriptions: Record<string, string> = {
  "Founder story": "Why Haven exists and the lived experience behind the product.",
  "Layoff planning": "What to do next when your status timeline gets compressed.",
  "Job changes": "How to evaluate transfers, offers, and employer moves.",
  "Green card planning": "What to track when permanent-residence timelines start drifting.",
  "Permanent residency": "Less common green-card paths and how they actually work.",
  "Family immigration": "Family-based routes to permanent residence and related questions.",
  "Employment immigration": "Employer-sponsored and employment-based green-card categories.",
  "Humanitarian relief": "Asylum, refugee, and protection-based pathways explained clearly.",
  "Visa basics": "Short-term visas and nonimmigrant categories, without the noise.",
  "Legal basics": "The legal framework and terminology behind U.S. immigration rules.",
  "Policy explainer": "What changed, what it means, and what to verify next.",
  "Medical exam": "Form I-693 and medical-exam requirements that affect filings."
};

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

export function toBlogCategorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function fromBlogCategorySlug(categorySlug: string): string | undefined {
  return getBlogCategories().find((category) => toBlogCategorySlug(category) === categorySlug);
}

export function getBlogCategories(): string[] {
  const categories = Array.from(new Set(blogPosts.map((post) => post.category)));

  return categories.sort((left, right) => {
    const leftIndex = blogCategoryOrder.indexOf(left as (typeof blogCategoryOrder)[number]);
    const rightIndex = blogCategoryOrder.indexOf(right as (typeof blogCategoryOrder)[number]);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });
}

export function getBlogCategoryDescription(category: string): string {
  return blogCategoryDescriptions[category] ?? "Practical guidance grouped by topic.";
}

export function getBlogPostsByCategory(posts = getAllBlogPosts()): Array<{
  category: string;
  categorySlug: string;
  description: string;
  posts: BlogPost[];
}> {
  return getBlogCategories()
    .map((category) => ({
      category,
      categorySlug: toBlogCategorySlug(category),
      description: getBlogCategoryDescription(category),
      posts: posts.filter((post) => post.category === category)
    }))
    .filter((group) => group.posts.length > 0);
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

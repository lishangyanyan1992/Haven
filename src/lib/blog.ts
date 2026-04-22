import { blogPosts, type BlogImage, type BlogPost } from "@/content/blog";

const unlistedBlogSlugs = new Set(["why-i-started-haven"]);

const blogDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

const blogCategoryOrder = [
  "Founder story",
  "H1B",
  "Tool reviews",
  "Employment Green Card",
  "Permanent residency",
  "Family immigration",
  "Humanitarian relief and other",
  "Visa basics",
  "Immigration system basics",
  "Inadmissibility and deportability",
  "Citizenship and naturalization",
  "Policy explainer",
  "Medical exam"
] as const;

const blogCategoryDescriptions: Record<string, string> = {
  "Founder story": "Why Haven exists and the lived experience behind the product.",
  H1B: "Practical guidance for layoffs, transfers, and status planning on H-1B.",
  "Tool reviews": "Honest reviews of software, platforms, and services immigrants may actually use.",
  "Permanent residency": "Less common green-card paths and how they actually work.",
  "Family immigration": "Family-based routes to permanent residence and related questions.",
  "Employment Green Card": "Employer-sponsored and employment-based green-card categories.",
  "Humanitarian relief and other": "Asylum, refugee, protection-based, and other less common pathways explained clearly.",
  "Visa basics": "Short-term visas and nonimmigrant categories, without the noise.",
  "Immigration system basics": "Core immigration concepts, legal structure, and status vocabulary explained clearly.",
  "Inadmissibility and deportability": "What can block entry, create removal risk, or sometimes be waived.",
  "Citizenship and naturalization": "How citizenship eligibility, N-400 filing, and the naturalization process work.",
  "Policy explainer": "What changed, what it means, and what to verify next.",
  "Medical exam": "Form I-693 and medical-exam requirements that affect filings."
};

export function getAllBlogPostsIncludingUnlisted(): BlogPost[] {
  return [...blogPosts].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

export function getAllBlogPosts(): BlogPost[] {
  return getAllBlogPostsIncludingUnlisted().filter((post) => !unlistedBlogSlugs.has(post.slug));
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
  const categories = Array.from(new Set(getAllBlogPosts().map((post) => post.category)));

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

const featuredBlogSlugs = [
  "h1b-grace-period-checklist",
  "before-you-accept-h1b-transfer",
  "perm-delay-what-to-track"
];

export function getFeaturedBlogPosts(): BlogPost[] {
  return featuredBlogSlugs
    .map((slug) => getBlogPost(slug))
    .filter((post): post is BlogPost => Boolean(post));
}

export function getBlogPostWordCount(post: BlogPost): number {
  const text = post.sections
    .flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])])
    .join(" ");
  return text.split(/\s+/).filter(Boolean).length;
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

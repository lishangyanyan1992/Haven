import { blogPosts, type BlogImage, type BlogPost } from "@/content/blog";

const unlistedBlogSlugs = new Set(["why-i-started-haven"]);
const resourceCategoryNames = new Set([
  "Medical exam",
  "Citizenship and naturalization",
  "Inadmissibility and deportability",
  "Visa basics",
  "Humanitarian relief and other",
  "Family immigration",
  "Employment Green Card",
  "Tool reviews",
  "H1B"
]);
const blogOnlySlugs = new Set(["trump-100000-h1b-fee-explained"]);

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
  "Family immigration",
  "Humanitarian relief and other",
  "Visa basics",
  "Medical exam",
  "Inadmissibility and deportability",
  "Citizenship and naturalization",
  "Immigration system basics",
  "Policy update",
  "Visa bulletin"
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
  "Policy update": "Recent immigration policy changes, what changed, and what to verify next.",
  "Visa bulletin": "Monthly employment-based visa bulletin movement, retrogression, and filing strategy context.",
  "Medical exam": "Form I-693 and medical-exam requirements that affect filings."
};

const resourceCategoryOrder = [
  "H-1B and job changes",
  "Visa basics and temporary stays",
  "Employment-based green cards",
  "Family-based and self-petition green cards",
  "Citizenship and naturalization",
  "Inadmissibility, deportability, and waivers",
  "Humanitarian relief and protection",
  "Medical exam and filing prep",
  "Tools and community reviews"
] as const;

const resourceCategoryDescriptions: Record<string, string> = {
  "H-1B and job changes": "Layoffs, grace periods, transfers, and other H-1B planning moments that need fast, practical guidance.",
  "Visa basics and temporary stays": "Core visa concepts, temporary categories, and the rules people need before they file or travel.",
  "Employment-based green cards": "PERM, EB categories, sponsorship structure, and employment-based permanent residence planning.",
  "Family-based and self-petition green cards": "Family sponsorship, self-petition paths, and permanent residence options tied to relationships or abuse protections.",
  "Citizenship and naturalization": "Eligibility, filing, interview, oath, and the steps from green card holder to citizen.",
  "Inadmissibility, deportability, and waivers": "Grounds that can block entry or trigger removal, plus when waivers or relief may exist.",
  "Humanitarian relief and protection": "Asylum, refugee pathways, credible fear screening, and protection-based forms of relief.",
  "Medical exam and filing prep": "Medical exam requirements and document-prep details that affect filing readiness.",
  "Tools and community reviews": "Reviews of products, communities, and support tools immigrants may actually use."
};

export type EditorialSection = "blog" | "resources";

function getAllEditorialPostsIncludingUnlisted(): BlogPost[] {
  return [...blogPosts].sort(
    (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

export function getEditorialSection(post: BlogPost): EditorialSection {
  if (blogOnlySlugs.has(post.slug)) {
    return "blog";
  }

  return resourceCategoryNames.has(post.category) ? "resources" : "blog";
}

export function isResourcePost(post: BlogPost): boolean {
  return getEditorialSection(post) === "resources";
}

export function getPostHref(post: BlogPost): string {
  return `/${getEditorialSection(post)}/${post.slug}`;
}

export function getAllPublicPostsIncludingUnlisted(): BlogPost[] {
  return getAllEditorialPostsIncludingUnlisted();
}

export function getAllPublicPosts(): BlogPost[] {
  return getAllPublicPostsIncludingUnlisted().filter((post) => !unlistedBlogSlugs.has(post.slug));
}

export function getAllBlogPostsIncludingUnlisted(): BlogPost[] {
  return getAllEditorialPostsIncludingUnlisted().filter((post) => getEditorialSection(post) === "blog");
}

export function getAllResourcePostsIncludingUnlisted(): BlogPost[] {
  return getAllEditorialPostsIncludingUnlisted().filter((post) => getEditorialSection(post) === "resources");
}

export function getAllBlogPosts(): BlogPost[] {
  return getAllPublicPosts().filter((post) => getEditorialSection(post) === "blog");
}

export function getAllResourcePosts(): BlogPost[] {
  return getAllPublicPosts().filter((post) => getEditorialSection(post) === "resources");
}

export function getRecentBlogPosts(limit = 3): BlogPost[] {
  return getAllBlogPosts().slice(0, limit);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getBlogPost(slug: string): BlogPost | undefined {
  const post = getPostBySlug(slug);
  return post && getEditorialSection(post) === "blog" ? post : undefined;
}

export function getResourcePost(slug: string): BlogPost | undefined {
  const post = getPostBySlug(slug);
  return post && getEditorialSection(post) === "resources" ? post : undefined;
}

export function toBlogCategorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sortCategories(categories: string[]): string[] {
  return [...categories].sort((left, right) => {
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

export function fromBlogCategorySlug(categorySlug: string, posts = getAllBlogPosts()): string | undefined {
  return getBlogCategories(posts).find((category) => toBlogCategorySlug(category) === categorySlug);
}

export function getBlogCategories(posts = getAllBlogPosts()): string[] {
  const categories = Array.from(new Set(posts.map((post) => post.category)));

  return sortCategories(categories);
}

export function getBlogCategoryDescription(category: string): string {
  return blogCategoryDescriptions[category] ?? "Practical guidance grouped by topic.";
}

export function getResourceCategory(post: BlogPost): string {
  switch (post.category) {
    case "H1B":
      return "H-1B and job changes";
    case "Visa basics":
      return "Visa basics and temporary stays";
    case "Employment Green Card":
      return "Employment-based green cards";
    case "Family immigration":
      return "Family-based and self-petition green cards";
    case "Citizenship and naturalization":
      return "Citizenship and naturalization";
    case "Inadmissibility and deportability":
      return "Inadmissibility, deportability, and waivers";
    case "Humanitarian relief and other":
      return "Humanitarian relief and protection";
    case "Medical exam":
      return "Medical exam and filing prep";
    case "Tool reviews":
      return "Tools and community reviews";
    default:
      return post.category;
  }
}

export function getResourceCategories(posts = getAllResourcePosts()): string[] {
  const categories = Array.from(new Set(posts.map((post) => getResourceCategory(post))));

  return [...categories].sort((left, right) => {
    const leftIndex = resourceCategoryOrder.indexOf(left as (typeof resourceCategoryOrder)[number]);
    const rightIndex = resourceCategoryOrder.indexOf(right as (typeof resourceCategoryOrder)[number]);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });
}

export function getResourceCategoryDescription(category: string): string {
  return resourceCategoryDescriptions[category] ?? "Practical resources grouped by topic.";
}

export function fromResourceCategorySlug(categorySlug: string, posts = getAllResourcePosts()): string | undefined {
  return getResourceCategories(posts).find((category) => toBlogCategorySlug(category) === categorySlug);
}

export function getResourcePostsByCategory(posts = getAllResourcePosts()): Array<{
  category: string;
  categorySlug: string;
  description: string;
  posts: BlogPost[];
}> {
  return getResourceCategories(posts)
    .map((category) => ({
      category,
      categorySlug: toBlogCategorySlug(category),
      description: getResourceCategoryDescription(category),
      posts: posts.filter((post) => getResourceCategory(post) === category)
    }))
    .filter((group) => group.posts.length > 0);
}

export function getBlogPostsByCategory(posts = getAllBlogPosts()): Array<{
  category: string;
  categorySlug: string;
  description: string;
  posts: BlogPost[];
}> {
  return getBlogCategories(posts)
    .map((category) => ({
      category,
      categorySlug: toBlogCategorySlug(category),
      description: getBlogCategoryDescription(category),
      posts: posts.filter((post) => post.category === category)
    }))
    .filter((group) => group.posts.length > 0);
}

const featuredBlogSlugs = [
  "trump-100000-h1b-fee-explained",
  "uscis-invalid-signature-denial-rule-2026",
  "june-2026-eb-visa-bulletin-retrogression"
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
    .map((slug) => getPostBySlug(slug))
    .filter((candidate): candidate is BlogPost => Boolean(candidate))
    .filter((candidate) => candidate.slug !== post.slug);

  if (explicitRelated.length >= limit) {
    return explicitRelated.slice(0, limit);
  }

  const fallbackPosts = getEditorialSection(post) === "resources" ? getAllResourcePosts() : getAllBlogPosts();
  const fallback = fallbackPosts.filter(
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

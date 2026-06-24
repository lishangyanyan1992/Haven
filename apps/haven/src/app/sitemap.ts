import type { MetadataRoute } from "next";

import { getAllBlogPosts, getAllPublicPosts, getAllResourcePosts, getPostHref } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { getCompanyPath, getSponsorCompanies, getSponsorGeneratedAt } from "@/lib/sponsor-directory";
import { publicTools } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllBlogPosts();
  const resourcePosts = getAllResourcePosts();
  const posts = getAllPublicPosts();
  const sponsorCompanies = getSponsorCompanies();
  const sponsorGeneratedAt = new Date(getSponsorGeneratedAt());
  const latestBlogDate = blogPosts[0]?.publishedAt ?? new Date().toISOString();
  const latestResourceDate = resourcePosts[0]?.publishedAt ?? latestBlogDate;

  return [
    {
      url: absoluteUrl("/").toString(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: absoluteUrl("/blog").toString(),
      lastModified: new Date(latestBlogDate),
      changeFrequency: "weekly",
      priority: 0.8
    },
    {
      url: absoluteUrl("/resources").toString(),
      lastModified: new Date(latestResourceDate),
      changeFrequency: "weekly",
      priority: 0.85
    },
    {
      url: absoluteUrl("/about").toString(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: absoluteUrl("/tools").toString(),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85
    },
    {
      url: absoluteUrl("/jobs").toString(),
      lastModified: sponsorGeneratedAt,
      changeFrequency: "weekly",
      priority: 0.85
    },
    ...publicTools.map((tool) => ({
      url: absoluteUrl(`/tools/${tool.slug}`).toString(),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...sponsorCompanies.map((company) => ({
      url: absoluteUrl(getCompanyPath(company.id)).toString(),
      lastModified: sponsorGeneratedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(getPostHref(post)).toString(),
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7
    }))
  ];
}

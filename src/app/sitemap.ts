import type { MetadataRoute } from "next";

import { getAllBlogPosts } from "@/lib/blog";
import { getAllGuides } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";
import { publicTools } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllBlogPosts();
  const guides = getAllGuides();
  const latestBlogDate = posts[0]?.publishedAt ?? new Date().toISOString();
  const latestGuideDate = guides[0]?.updatedAt ?? new Date().toISOString();

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
      url: absoluteUrl("/guides").toString(),
      lastModified: new Date(latestGuideDate),
      changeFrequency: "weekly",
      priority: 0.85
    },
    ...publicTools.map((tool) => ({
      url: absoluteUrl(`/tools/${tool.slug}`).toString(),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`).toString(),
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7
    })),
    ...guides.map((guide) => ({
      url: absoluteUrl(`/guides/${guide.slug}`).toString(),
      lastModified: new Date(guide.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8
    }))
  ];
}

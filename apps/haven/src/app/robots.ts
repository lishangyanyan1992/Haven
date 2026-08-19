import type { MetadataRoute } from "next";

import { absoluteUrl, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/about",
        "/blog",
        "/blog/",
        "/day-1-cpt-schools",
        "/jobs",
        "/jobs/",
        "/resources",
        "/resources/",
        "/tools",
        "/tools/"
      ],
      disallow: [
        "/advisor",
        "/api/",
        "/auth/",
        "/cases",
        "/clients",
        "/community",
        "/dashboard",
        "/documents",
        "/forgot-password",
        "/gone",
        "/inbox",
        "/invite/",
        "/lawyers",
        "/login",
        "/onboarding",
        "/planner",
        "/profile",
        "/register",
        "/reports",
        "/reset-password",
        "/search",
        "/settings",
        "/tasks",
        "/timeline"
      ]
    },
    sitemap: absoluteUrl("/sitemap.xml").toString(),
    host: siteUrl.origin
  };
}

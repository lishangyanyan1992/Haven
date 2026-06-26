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
        "/community",
        "/dashboard",
        "/forgot-password",
        "/inbox",
        "/invite/",
        "/login",
        "/onboarding",
        "/planner",
        "/register",
        "/reset-password",
        "/settings",
        "/timeline"
      ]
    },
    sitemap: absoluteUrl("/sitemap.xml").toString(),
    host: siteUrl.origin
  };
}

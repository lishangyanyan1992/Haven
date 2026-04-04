import { absoluteUrl, siteUrl } from "@/lib/seo";

export type AuthorProfile = {
  name: string;
  role: string;
  description: string;
  path: string;
};

export const siteIdentity = {
  name: "Haven",
  description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders.",
  url: siteUrl.toString()
};

export const authorProfiles: Record<string, AuthorProfile> = {
  "Haven founder": {
    name: "Haven founder",
    role: "Founder",
    description:
      "Built Haven after living through two H-1B layoffs and seeing how fragmented immigration decision-making becomes under time pressure.",
    path: "/about#founder"
  },
  "Haven editorial team": {
    name: "Haven editorial team",
    role: "Editorial team",
    description:
      "Writes practical, decision-oriented guides for H-1B layoffs, transfer timing, and immigration planning tradeoffs.",
    path: "/about#editorial"
  }
};

export function getAuthorProfile(name: string): AuthorProfile {
  return (
    authorProfiles[name] ?? {
      name,
      role: "Contributor",
      description: "Contributor to Haven's immigration planning content.",
      path: "/about"
    }
  );
}

export function getOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteIdentity.name,
    url: siteIdentity.url,
    description: siteIdentity.description
  };
}

export function getWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteIdentity.name,
    url: siteIdentity.url,
    description: siteIdentity.description,
    publisher: {
      "@type": "Organization",
      name: siteIdentity.name,
      url: siteIdentity.url
    }
  };
}

export function buildBreadcrumbStructuredData(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path).toString()
    }))
  };
}

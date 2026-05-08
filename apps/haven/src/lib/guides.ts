import { guides, type Guide } from "@/content/guides";

const guideDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric"
});

export function getAllGuides(): Guide[] {
  return [...guides];
}

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function getFeaturedGuides(limit = 3): Guide[] {
  return getAllGuides().slice(0, limit);
}

export function getRelatedGuides(slugs: string[]): Guide[] {
  return slugs.map((slug) => getGuide(slug)).filter((guide): guide is Guide => Boolean(guide));
}

export function formatGuideDate(date: string): string {
  return guideDateFormatter.format(new Date(date));
}

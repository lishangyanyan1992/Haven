export type ToolSlug =
  | "uscis-vaccine-finder"
  | "grace-period-calculator"
  | "priority-date-checker"
  | "document-pack-builder";

export type PublicTool = {
  slug: ToolSlug;
  title: string;
  longTitle: string;
  description: string;
  teaser: string;
};

export const publicTools: PublicTool[] = [
  {
    slug: "uscis-vaccine-finder",
    title: "USCIS vaccine finder",
    longTitle: "USCIS vaccine requirement finder for Form I-693",
    description:
      "Check which immigration-medical vaccines are age-appropriate based on date of birth, exam date, and flu-season availability.",
    teaser:
      "See which immigration-medical vaccines are age-appropriate based on date of birth and exam timing."
  },
  {
    slug: "grace-period-calculator",
    title: "Grace period calculator",
    longTitle: "H-1B grace period calculator",
    description:
      "Estimate the likely last day of the H-1B grace period using your employment end date and I-94 expiration.",
    teaser:
      "Estimate the last day of the discretionary 60-day window using your employment end date and I-94."
  },
  {
    slug: "priority-date-checker",
    title: "Priority date checker",
    longTitle: "Visa Bulletin priority date checker",
    description:
      "Compare your priority date against a published Visa Bulletin cutoff and see whether the date itself is blocking you.",
    teaser:
      "Compare your own priority date against a published Visa Bulletin cutoff in seconds."
  },
  {
    slug: "document-pack-builder",
    title: "Document pack builder",
    longTitle: "Immigration document pack builder",
    description:
      "Generate a practical first-pass document checklist for layoffs, transfers, visa stamping, or adjustment preparation.",
    teaser:
      "Generate a practical document list for layoffs, transfers, stamping, or adjustment prep."
  }
];

export function getPublicTool(slug: string) {
  return publicTools.find((tool) => tool.slug === slug);
}

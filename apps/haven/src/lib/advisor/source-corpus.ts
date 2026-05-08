import { createHash } from "node:crypto";

import { havenSnapshot } from "@/lib/repositories/mock-data";

export interface SeedKnowledgeSource {
  slug: string;
  label: string;
  agency: string;
  baseUrl: string;
  topic: string;
  trustPriority: number;
}

export interface SeedKnowledgeDocument {
  slug: string;
  sourceSlug: string;
  title: string;
  url: string;
  topic: string;
  versionLabel: string;
  effectiveDate?: string;
  bodyMarkdown: string;
  chunks: string[];
}

export interface SeedCommunitySummary {
  title: string;
  topic: string;
  summary: string;
  legalCaveat: string;
  tags: string[];
}

export const trustedKnowledgeSources: SeedKnowledgeSource[] = [
  {
    slug: "uscis-h1b",
    label: "USCIS H-1B Specialty Occupations",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    topic: "h1b",
    trustPriority: 10
  },
  {
    slug: "uscis-green-card",
    label: "USCIS Employment-Based Green Card Process",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/green-card/green-card-processes-and-procedures",
    topic: "adjustment-of-status",
    trustPriority: 20
  },
  {
    slug: "uscis-when-to-file",
    label: "USCIS When to File Adjustment of Status",
    agency: "USCIS",
    baseUrl:
      "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/when-to-file-your-adjustment-of-status-application-for-family-sponsored-or-employment-based-110",
    topic: "visa-bulletin",
    trustPriority: 30
  },
  {
    slug: "dos-visa-bulletin",
    label: "Department of State Visa Bulletin",
    agency: "Department of State",
    baseUrl: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    topic: "visa-bulletin",
    trustPriority: 40
  },
  {
    slug: "dol-perm",
    label: "Department of Labor PERM",
    agency: "Department of Labor",
    baseUrl: "https://flag.dol.gov/programs/perm",
    topic: "perm",
    trustPriority: 50
  }
];

export const trustedKnowledgeDocuments: SeedKnowledgeDocument[] = [
  {
    slug: "uscis-h1b-specialty-occupations-overview",
    sourceSlug: "uscis-h1b",
    title: "USCIS H-1B Specialty Occupations overview",
    url: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    topic: "h1b",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS describes the H-1B route as an employer-sponsored classification for specialty occupations. Employers petition for workers, cap cases follow the registration process, and extensions, amendments, and portability all depend on properly filed petitions.",
    chunks: [
      "USCIS frames H-1B as an employer-sponsored nonimmigrant path for specialty occupations that generally requires a job offer and an employer-filed petition.",
      "Cap-subject H-1B cases run through the annual registration and selection process before the employer can file the petition.",
      "Changes in employer, role, location, or work authorization timing often depend on petition filing details, so users should confirm the filing strategy with counsel or employer immigration teams."
    ]
  },
  {
    slug: "uscis-employment-based-green-card-process",
    sourceSlug: "uscis-green-card",
    title: "USCIS employment-based green card process",
    url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures",
    topic: "adjustment-of-status",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS explains that employment-based green card processing depends on petition classification, visa availability, and eligibility to adjust status or process at a consulate. Adjustment of status availability changes based on the visa bulletin and USCIS filing chart announcements.",
    chunks: [
      "USCIS explains that employment-based permanent residence is tied to the immigrant category, the underlying petition, and whether a visa number is available.",
      "Adjustment of status is only available when the applicant is otherwise eligible and visa availability is current under the applicable chart that USCIS announces for the month.",
      "Applicants should treat visa-availability movement as dynamic rather than guaranteed, because filing windows and adjudication timing can change month to month."
    ]
  },
  {
    slug: "uscis-when-to-file-march-2026",
    sourceSlug: "uscis-when-to-file",
    title: "USCIS When to File your adjustment of status application",
    url:
      "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/when-to-file-your-adjustment-of-status-application-for-family-sponsored-or-employment-based-110",
    topic: "visa-bulletin",
    versionLabel: "March 2026",
    effectiveDate: "2026-03-01",
    bodyMarkdown:
      "USCIS publishes a monthly filing-chart decision that tells applicants whether to use Final Action Dates or Dates for Filing. It also explains how to compare a priority date to the chart and clarifies that visa bulletin timing usually posts in the second week of the prior month.",
    chunks: [
      "USCIS tells applicants to check the monthly filing-chart announcement first, because that decides whether the employment-based case may use Final Action Dates or Dates for Filing.",
      "The rule USCIS publishes is straightforward: if the chart shows 'C' or the applicant's priority date is earlier than the listed date for the country and category, the filing window may be open if all other eligibility requirements are met.",
      "USCIS notes that the Department of State usually publishes the next visa bulletin in the second week of the preceding month, so monthly tracking matters."
    ]
  },
  {
    slug: "dos-visa-bulletin-march-2026",
    sourceSlug: "dos-visa-bulletin",
    title: "Department of State Visa Bulletin",
    url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    topic: "visa-bulletin",
    versionLabel: "March 2026",
    effectiveDate: "2026-03-01",
    bodyMarkdown:
      "The Visa Bulletin is the official Department of State publication for current and historical immigrant visa cut-off dates. It publishes Final Action Dates and Dates for Filing and notes that online bulletins are informational while official copies remain authoritative.",
    chunks: [
      "The Department of State visa bulletin is the official monthly source for immigrant-visa cut-off dates, including employment-based Final Action Dates and Dates for Filing.",
      "The bulletin page explicitly separates the current bulletin from archived bulletins, which makes month-specific citations important when users ask timing questions.",
      "The bulletin explains that dates are listed in day-month-year format and that the online bulletin is informational, so users should verify the exact monthly chart when timing is high stakes."
    ]
  },
  {
    slug: "dol-perm-program-overview",
    sourceSlug: "dol-perm",
    title: "Department of Labor PERM program overview",
    url: "https://flag.dol.gov/programs/perm",
    topic: "perm",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "The Department of Labor's PERM program covers the permanent labor certification process used in many employment-based green card cases. Employers file through FLAG, recruitment and wage requirements matter, and timing can affect downstream immigrant petition and adjustment steps.",
    chunks: [
      "The Department of Labor describes PERM as the permanent labor certification process that employers use for many employment-based green card filings before the immigrant petition stage.",
      "PERM timing affects later green card milestones because the labor certification date can drive the priority-date timeline in cases that require labor certification.",
      "Because DOL and USCIS each own different parts of the workflow, users should separate labor-certification status from later petition and adjustment steps when evaluating overall case progress."
    ]
  }
];

export const curatedCommunitySummaries: SeedCommunitySummary[] = [
  {
    title: "AC21 documentation patterns from similar members",
    topic: "job-change",
    summary:
      "Members nearing the 180-day mark after I-140 approval said the most useful preparation was collecting approval notices, job descriptions, and role-comparison notes before a job search accelerated.",
    legalCaveat: "Community experiences are not legal advice and may not match your facts.",
    tags: ["AC21", "job_change", "community"]
  },
  {
    title: "Layoff first-week triage from war room posts",
    topic: "layoffs",
    summary:
      "Recent war-room posts consistently prioritized attorney outreach, document collection, and recruiter activation in the first week instead of trying to solve every long-term immigration question immediately.",
    legalCaveat: "Community experiences are not legal advice and may not match your facts.",
    tags: ["layoff", "60_day_window", "community"]
  }
];

export function getSourceHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function estimateTokenCount(content: string) {
  return Math.ceil(content.split(/\s+/).filter(Boolean).length * 1.33);
}

export function buildFallbackCommunitySummaries() {
  const cohortPosts = havenSnapshot.cohorts.flatMap((cohort) => cohort.posts);
  const warRoomPosts = havenSnapshot.warRoom.posts;

  return [
    ...curatedCommunitySummaries,
    ...cohortPosts.map((post) => ({
      title: post.title,
      topic: post.tags[0]?.toLowerCase() ?? "community",
      summary: post.body,
      legalCaveat: "Community experiences are not legal advice and may not match your facts.",
      tags: post.tags
    })),
    ...warRoomPosts.map((post) => ({
      title: post.title,
      topic: post.tags[0]?.toLowerCase() ?? "community",
      summary: post.body,
      legalCaveat: "Community experiences are not legal advice and may not match your facts.",
      tags: post.tags
    }))
  ];
}

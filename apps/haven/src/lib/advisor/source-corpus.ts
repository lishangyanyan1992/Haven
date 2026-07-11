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
    slug: "ecfr-nonimmigrant-classes",
    label: "eCFR Nonimmigrant Classes",
    agency: "DHS/eCFR",
    baseUrl: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214",
    topic: "h1b",
    trustPriority: 12
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
    slug: "uscis-adjustment-bars",
    label: "USCIS Adjustment Bars and Unauthorized Employment",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/policy-manual/volume-7-part-b-chapter-6",
    topic: "work-authorization",
    trustPriority: 22
  },
  {
    slug: "uscis-when-to-file",
    label: "USCIS Adjustment of Status Filing Charts",
    agency: "USCIS",
    baseUrl:
      "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin",
    topic: "visa-bulletin",
    trustPriority: 30
  },
  {
    slug: "uscis-ac21-job-portability",
    label: "USCIS AC21 Job Portability",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/policy-manual/volume-7-part-e-chapter-5",
    topic: "job-change",
    trustPriority: 35
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
  },
  {
    slug: "dhs-study-in-states",
    label: "DHS Study in the States",
    agency: "DHS",
    baseUrl: "https://studyinthestates.dhs.gov/",
    topic: "student-status",
    trustPriority: 60
  },
  {
    slug: "uscis-student-employment",
    label: "USCIS Student Employment",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors",
    topic: "student-status",
    trustPriority: 65
  },
  {
    slug: "uscis-cspa",
    label: "USCIS Child Status Protection Act",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/child-status-protection-act-cspa",
    topic: "cspa",
    trustPriority: 70
  },
  {
    slug: "uscis-niw",
    label: "USCIS EB-2 National Interest Waiver Policy",
    agency: "USCIS",
    baseUrl: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-5",
    topic: "self-petition",
    trustPriority: 75
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
    slug: "uscis-nonimmigrant-worker-termination-options",
    sourceSlug: "uscis-h1b",
    title: "USCIS Options for Nonimmigrant Workers Following Termination of Employment",
    url: "https://www.uscis.gov/archive/options-for-nonimmigrant-workers-following-termination-of-employment-0",
    topic: "h1b",
    versionLabel: "2026 archived guidance",
    bodyMarkdown:
      "USCIS describes options for certain nonimmigrant workers after termination of employment, including the discretionary grace period, timely filing by a new employer, change of status, and departure planning.",
    chunks: [
      "USCIS describes an up-to-60-day discretionary grace period for certain nonimmigrant workers after employment ends, but the period cannot extend beyond the authorized validity period.",
      "USCIS says eligible H-1B workers may be able to begin new employment after a new employer properly files a nonfrivolous H-1B petition, subject to portability requirements and case-specific facts.",
      "If no timely employer petition or other filing is available, USCIS lists other options such as change of status, compelling-circumstances EAD in limited cases, or departure from the United States. Users should confirm deadlines and avoid unauthorized work."
    ]
  },
  {
    slug: "ecfr-214-1-grace-period",
    sourceSlug: "ecfr-nonimmigrant-classes",
    title: "8 CFR 214.1: Nonimmigrant Grace Period",
    url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.1",
    topic: "h1b",
    versionLabel: "2026 current eCFR",
    bodyMarkdown:
      "DHS regulations describe the discretionary grace period for certain nonimmigrants after cessation of employment and state that work is not authorized during that period unless separately authorized.",
    chunks: [
      "8 CFR 214.1 describes an up-to-60-day grace period, or until the end of the authorized validity period, whichever is shorter, after cessation of employment for certain nonimmigrants.",
      "The regulation says DHS may eliminate or shorten the 60-day period as a matter of discretion, so answers should not treat the grace period as a guaranteed full 60 days.",
      "Unless separately authorized, the worker may not work during the grace period. A layoff answer should separate remaining in the United States from permission to work."
    ]
  },
  {
    slug: "ecfr-214-2-h1b-portability",
    sourceSlug: "ecfr-nonimmigrant-classes",
    title: "8 CFR 214.2: H-1B Portability",
    url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2",
    topic: "h1b",
    versionLabel: "2026 current eCFR",
    bodyMarkdown:
      "DHS regulations describe H-1B portability and the filing condition for starting new employment with a new H-1B petitioner.",
    chunks: [
      "8 CFR 214.2 describes H-1B portability: an eligible H-1B worker may start new employment when a nonfrivolous H-1B petition for new employment has been filed, or on the requested start date, whichever is later.",
      "For portability, the petition for new employment must be filed before the worker's authorized period of stay expires, and the worker must not have been employed without authorization after the last admission.",
      "An LCA or petition in preparation is not the same as a filed H-1B portability petition. In urgent layoff cases, the filing deadline and receipt strategy should be confirmed with employer counsel."
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
    slug: "uscis-adjustment-filing-charts",
    sourceSlug: "uscis-when-to-file",
    title: "USCIS Adjustment of Status Filing Charts from the Visa Bulletin",
    url:
      "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin",
    topic: "visa-bulletin",
    versionLabel: "July 2026 filing-chart index",
    effectiveDate: "2026-07-01",
    bodyMarkdown:
      "USCIS publishes a monthly adjustment-of-status filing chart decision. That USCIS page tells employment-based applicants whether they must use Final Action Dates or may use Dates for Filing for the month.",
    chunks: [
      "USCIS tells adjustment applicants to use its monthly filing-chart page to determine whether employment-based applicants must use Final Action Dates or may use Dates for Filing.",
      "For I-485 filing questions, the Department of State Visa Bulletin alone is not the final filing instruction. USCIS decides each month which chart applies for adjustment-of-status filings.",
      "If USCIS authorizes Dates for Filing for the month, a person may be able to file I-485 when the priority date is earlier than the applicable Dates for Filing cutoff, assuming all other eligibility requirements are met."
    ]
  },
  {
    slug: "uscis-ac21-job-portability-policy",
    sourceSlug: "uscis-ac21-job-portability",
    title: "USCIS Policy Manual: Job Portability after Adjustment Filing",
    url: "https://www.uscis.gov/policy-manual/volume-7-part-e-chapter-5",
    topic: "job-change",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS policy describes job portability after adjustment filing under INA 204(j), commonly associated with AC21. It is tied to a pending Form I-485 and a new job offer in the same or similar occupational classification.",
    chunks: [
      "USCIS describes job portability after adjustment filing as a protection for certain applicants whose Form I-485 has been pending long enough and who move to a same or similar occupational classification.",
      "If no Form I-485 has been filed or pending, AC21 adjustment portability generally does not solve a job-change question; the worker may need a new employer-sponsored immigrant process or another status strategy.",
      "An approved I-140 by itself is not the same as AC21 adjustment portability. The pending adjustment application and same-or-similar job analysis are central to the portability question."
    ]
  },
  {
    slug: "uscis-i485-supplement-j-job-portability",
    sourceSlug: "uscis-ac21-job-portability",
    title: "USCIS Form I-485 Supplement J",
    url: "https://www.uscis.gov/i-485supj",
    topic: "job-change",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS uses Form I-485 Supplement J to confirm a bona fide job offer or to request job portability under INA 204(j).",
    chunks: [
      "USCIS Form I-485 Supplement J is used to confirm the job offer or request job portability under INA 204(j) for adjustment applicants.",
      "For job portability, USCIS expects the new job offer to be in the same or a similar occupational classification as the job offered in the Form I-140 that is the basis of the Form I-485.",
      "Supplement J analysis is not just a job-title match. Role duties, occupational classification, skills, experience, and other facts can matter."
    ]
  },
  {
    slug: "uscis-i485-pending-travel",
    sourceSlug: "uscis-green-card",
    title: "USCIS: While Your Green Card Application Is Pending",
    url: "https://www.uscis.gov/green-card/while-your-green-card-application-is-pending-with-uscis",
    topic: "adjustment-of-status",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS explains issues that can arise while a green card application is pending, including temporary travel while Form I-485 is pending and the need to review Form I-131 instructions.",
    chunks: [
      "USCIS says applicants who need to leave the United States temporarily while Form I-485 is pending should review Form I-131 travel document instructions.",
      "USCIS describes advance parole as a travel document that allows certain noncitizens to return to the United States after temporary travel abroad.",
      "For pending I-485 travel questions, separate a pending Form I-131 request from an already approved advance parole document."
    ]
  },
  {
    slug: "uscis-adjustment-filing-instructions-travel",
    sourceSlug: "uscis-green-card",
    title: "USCIS Policy Manual: Adjustment Filing Instructions",
    url: "https://www.uscis.gov/policy-manual/volume-7-part-a-chapter-3",
    topic: "adjustment-of-status",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS Policy Manual filing instructions explain that adjustment applicants who depart the United States generally abandon their applications unless advance parole was previously granted for the absence.",
    chunks: [
      "USCIS Policy Manual guidance says adjustment applicants who depart the United States generally abandon the adjustment application unless advance parole was previously granted for that absence.",
      "For a pending I-485 travel question, the key distinction is whether advance parole has already been granted, not merely whether Form I-131 is pending.",
      "When a nonimmigrant visa stamp has expired, reentry strategy is separate from current status in the United States and should be reviewed before travel."
    ]
  },
  {
    slug: "uscis-cspa-overview",
    sourceSlug: "uscis-cspa",
    title: "USCIS Child Status Protection Act",
    url: "https://www.uscis.gov/green-card/green-card-processes-and-procedures/child-status-protection-act-cspa",
    topic: "cspa",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS explains how the Child Status Protection Act can preserve child classification for certain applicants who age out before immigration processing completes.",
    chunks: [
      "USCIS explains that CSPA can allow some applicants to remain classified as children after turning 21, but eligibility depends on case type and facts.",
      "For many family- and employment-based derivative cases, CSPA age requires knowing the child's age when a visa becomes available and subtracting the time the petition was pending.",
      "USCIS describes a sought-to-acquire requirement: the applicant generally must seek to acquire lawful permanent resident status within one year of visa availability, unless an exception applies."
    ]
  },
  {
    slug: "uscis-cspa-policy-manual",
    sourceSlug: "uscis-cspa",
    title: "USCIS Policy Manual: Child Status Protection Act",
    url: "https://www.uscis.gov/policy-manual/volume-7-part-a-chapter-7",
    topic: "cspa",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS Policy Manual guidance describes the CSPA age formula, visa availability, petition pending time, and sought-to-acquire requirement.",
    chunks: [
      "USCIS states the CSPA age formula as age at time of visa availability minus petition pending time equals CSPA age.",
      "USCIS guidance explains that visa availability and the sought-to-acquire requirement are central to CSPA analysis.",
      "For a child close to 21, the safe answer is to collect petition dates, priority date, approval date, visa availability month, filing history, and ask counsel to calculate CSPA age rather than estimating from incomplete facts."
    ]
  },
  {
    slug: "uscis-same-or-similar-ac21",
    sourceSlug: "uscis-ac21-job-portability",
    title: "USCIS Same or Similar Occupational Classifications for AC21",
    url:
      "https://www.uscis.gov/working-in-the-united-states/how-uscis-determines-same-or-similar-occupational-classifications-for-job-portability-under-ac21",
    topic: "job-change",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS explains how it determines whether a new job is in the same or similar occupational classification for AC21 portability.",
    chunks: [
      "USCIS states that to change the offer of employment or employer through this portability path, the Form I-485 must have been pending with USCIS for 180 days or more.",
      "USCIS reviews whether the new position is in the same or similar occupational classification by looking beyond title alone, including job duties, skills, experience, education, training, licenses, wages, and other evidence.",
      "A move from an individual contributor role to a management role can be fact-specific; the correct answer should not declare same-or-similar eligibility without legal review."
    ]
  },
  {
    slug: "uscis-opt-for-f1-students",
    sourceSlug: "uscis-student-employment",
    title: "USCIS Optional Practical Training for F-1 Students",
    url: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students",
    topic: "student-status",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS explains Optional Practical Training for F-1 students, including categories of OPT and the need for employment authorization.",
    chunks: [
      "USCIS explains that OPT is temporary employment directly related to an F-1 student's major area of study and generally requires authorization.",
      "For post-completion OPT, the student should not begin work merely because the application is pending; the answer should tell the student to wait for valid work authorization/EAD and coordinate with the DSO and employer.",
      "USCIS explains that F-1 students who participate in 12 months or more of full-time curricular practical training are not eligible for post-completion OPT.",
      "Practical next steps for delayed OPT include checking USCIS case status, preserving receipt and communication records, asking the employer about start-date/I-9 timing, and contacting the DSO or counsel before working."
    ]
  },
  {
    slug: "uscis-i9-f1-m1-students",
    sourceSlug: "uscis-student-employment",
    title: "USCIS Handbook for Employers: F-1 and M-1 Students",
    url:
      "https://www.uscis.gov/i-9-central/form-i-9-resources/handbook-for-employers-m-274/70-evidence-of-employment-authorization-for-certain-categories/74-exchange-visitors-and-students/742-f-1-and-m-1-nonimmigrant-students",
    topic: "student-status",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS employer guidance describes evidence of employment authorization for F-1 students, including EAD requirements for OPT.",
    chunks: [
      "USCIS employer guidance says F-1 students must obtain an EAD from USCIS before they are authorized to work pursuant to OPT.",
      "The student may not begin employment until the date shown on the EAD, which is why a pending OPT application alone is not enough for work authorization.",
      "For an OPT start-date problem, the answer should direct the student to coordinate with the employer on Form I-9 timing and contact the DSO or counsel."
    ]
  },
  {
    slug: "dhs-curricular-practical-training",
    sourceSlug: "dhs-study-in-states",
    title: "DHS Study in the States: F-1 Curricular Practical Training",
    url:
      "https://studyinthestates.dhs.gov/sevis-help-hub/student-records/fm-student-employment/f-1-curricular-practical-training-cpt",
    topic: "student-status",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "DHS Study in the States explains Curricular Practical Training for F-1 students and the DSO role in CPT authorization.",
    chunks: [
      "DHS describes CPT as F-1 practical training that must be authorized through the student's school process and tied to the curriculum.",
      "For CPT, the student should work with the DSO and ensure authorization is properly documented on the Form I-20 before employment begins.",
      "Day 1 CPT should be treated cautiously: the answer should tell the user to verify accreditation, program fit, enrollment and attendance requirements, employer-course nexus, DSO authorization, and future visa risks."
    ]
  },
  {
    slug: "uscis-niw-policy-manual",
    sourceSlug: "uscis-niw",
    title: "USCIS Policy Manual: EB-2 National Interest Waiver",
    url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-5",
    topic: "self-petition",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS Policy Manual guidance explains EB-2 eligibility and National Interest Waiver adjudication, including the Dhanasar framework.",
    chunks: [
      "USCIS explains that a National Interest Waiver request must first establish EB-2 eligibility and then show that waiving the job offer and labor certification would be in the national interest.",
      "USCIS uses the Dhanasar framework: the proposed endeavor must have substantial merit and national importance; the person must be well positioned to advance it; and, on balance, waiving the job offer requirement must benefit the United States.",
      "For an NIW denial saying the proposed endeavor was too vague, the answer should advise counsel review of the denial notice, deadlines, and whether to refile, appeal, or file a motion while strengthening the proposed endeavor and evidence under Dhanasar."
    ]
  },
  {
    slug: "uscis-niw-policy-alert",
    sourceSlug: "uscis-niw",
    title: "USCIS EB-2 National Interest Waiver Policy Update",
    url: "https://www.uscis.gov/newsroom/alerts/uscis-updates-guidance-on-eb-2-national-interest-waiver-petitions",
    topic: "self-petition",
    versionLabel: "2025 policy update",
    bodyMarkdown:
      "USCIS announced policy guidance updates on EB-2 National Interest Waiver petitions, including how officers evaluate the proposed endeavor.",
    chunks: [
      "USCIS states that NIW guidance addresses how officers evaluate whether a proposed endeavor has national importance.",
      "A vague proposed endeavor is a common weakness because the national-importance analysis focuses on the specific endeavor and its potential prospective impact.",
      "For refiling after a vague-proposed-endeavor denial, useful attorney questions include how to define the endeavor, what evidence shows national importance, and whether deadlines or appeal/motion options are better than immediate refiling."
    ]
  },
  {
    slug: "uscis-unauthorized-employment-adjustment",
    sourceSlug: "uscis-adjustment-bars",
    title: "USCIS Policy Manual: Unauthorized Employment",
    url: "https://www.uscis.gov/policy-manual/volume-7-part-b-chapter-6",
    topic: "work-authorization",
    versionLabel: "2026 evergreen",
    bodyMarkdown:
      "USCIS policy explains unauthorized employment in the adjustment-of-status context and why truthful attorney review matters when unauthorized work occurred.",
    chunks: [
      "USCIS describes unauthorized employment as service or labor performed for an employer in the United States by a person who is not authorized by the INA or USCIS to work.",
      "Unauthorized employment can create adjustment-of-status problems, so the user should not hide it or draft misleading statements for USCIS.",
      "If unauthorized work occurred, safe next steps are to stop unauthorized work, preserve dates and records, and speak with immigration counsel about truthful disclosure and possible immigration consequences."
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

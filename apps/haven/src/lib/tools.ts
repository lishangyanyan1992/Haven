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
  howToUse: string;
  faqs: Array<{ question: string; answer: string }>;
  relatedSlugs: ToolSlug[];
};

export const publicTools: PublicTool[] = [
  {
    slug: "uscis-vaccine-finder",
    title: "USCIS vaccine finder",
    longTitle: "USCIS vaccine requirement finder for Form I-693",
    description:
      "Check which immigration-medical vaccines are age-appropriate based on date of birth, exam date, and flu-season availability.",
    teaser:
      "See which immigration-medical vaccines are age-appropriate based on date of birth and exam timing.",
    howToUse:
      "Enter the applicant's date of birth and the planned medical exam date. The tool applies the CDC civil surgeon vaccination table to identify which vaccines are age-appropriate. Select whether influenza vaccine is likely available at the time of the exam — CDC only requires it during flu season, typically fall through early spring.",
    faqs: [
      {
        question: "Which vaccines are required for USCIS Form I-693?",
        answer:
          "USCIS requires vaccines recommended by the Advisory Committee on Immunization Practices (ACIP) that are appropriate for the applicant's age, medical history, and risk profile. The designated civil surgeon determines which vaccines apply using the CDC vaccination technical instructions."
      },
      {
        question: "What is Form I-693?",
        answer:
          "Form I-693 is the medical examination report completed by a USCIS-designated civil surgeon. It documents vaccination history, communicable disease screening, and other health requirements for adjustment of status (green card) applicants inside the United States."
      },
      {
        question: "Does the influenza vaccine affect my green card application?",
        answer:
          "Influenza vaccine is required when it is available in the United States — typically from fall through early spring. Civil surgeons note when it is not flu season, which is one of the few seasonal carve-outs in the vaccine requirements."
      },
      {
        question: "Can I use prior vaccination records at the medical exam?",
        answer:
          "Yes. Written vaccination records, titer results, and documented immunity can satisfy many vaccine requirements without receiving a new dose. Bring all prior vaccination records to your civil surgeon appointment."
      }
    ],
    relatedSlugs: ["document-pack-builder", "grace-period-calculator"]
  },
  {
    slug: "grace-period-calculator",
    title: "Grace period calculator",
    longTitle: "H-1B grace period calculator",
    description:
      "Estimate the likely last day of the H-1B grace period using your employment end date and I-94 expiration.",
    teaser:
      "Estimate the last day of the discretionary 60-day window using your employment end date and I-94.",
    howToUse:
      "Enter the date your employment actually ended — not the date you received notice, but the last day on payroll. Add your I-94 expiration date if you know it; the calculator caps the grace period at whichever date comes first. Use the result as a planning estimate, not a legal determination.",
    faqs: [
      {
        question: "What is the H-1B 60-day grace period?",
        answer:
          "When an H-1B holder's employment ends involuntarily, USCIS allows a discretionary grace period of up to 60 calendar days — or the remainder of the authorized stay, whichever is shorter — to find a new employer, change status, or prepare to depart the United States."
      },
      {
        question: "When does the H-1B grace period start?",
        answer:
          "The grace period starts on the day employment actually ends — the last day on payroll. It does not start on the date you were notified of termination, and it does not start on the date the employer submits a withdrawal to USCIS."
      },
      {
        question: "Does the 60-day grace period apply to voluntary resignations?",
        answer:
          "No. The discretionary 60-day grace period under 8 CFR 214.1(l) is for involuntary terminations. A voluntary resignation does not trigger the same grace period, though status may still be maintained depending on other facts."
      },
      {
        question: "Can the H-1B grace period be extended?",
        answer:
          "No. The 60-day grace period cannot be extended. If you need more time, you must file for a change of status or an H-1B transfer to a new employer before the grace period expires."
      }
    ],
    relatedSlugs: ["document-pack-builder", "priority-date-checker"]
  },
  {
    slug: "priority-date-checker",
    title: "Priority date checker",
    longTitle: "Visa Bulletin priority date checker",
    description:
      "Compare your priority date against a published Visa Bulletin cutoff and see whether the date itself is blocking you.",
    teaser:
      "Compare your own priority date against a published Visa Bulletin cutoff in seconds.",
    howToUse:
      "Select your preference category (EB-1, EB-2, EB-3, or Family-based), your country of chargeability, and which Visa Bulletin chart applies — Final Action Dates or Dates for Filing. Enter your priority date and the published cutoff date. The tool shows whether your date is current against that cutoff.",
    faqs: [
      {
        question: "What is a priority date in U.S. immigration?",
        answer:
          "A priority date is the date USCIS received your immigrant visa petition — or, for employment-based PERM cases, the date DOL received the labor certification application. It marks your place in the immigrant visa queue for your category and country."
      },
      {
        question: "What is the difference between Final Action Dates and Dates for Filing?",
        answer:
          "Final Action Dates show when a visa number is actually available to use. Dates for Filing (when published by USCIS) allow applicants to submit an I-485 adjustment of status application earlier — but a visa number must still be available before USCIS can approve the case."
      },
      {
        question: "Why does my country of birth affect my priority date cutoff?",
        answer:
          "Immigrant visa numbers are allocated per country of birth, not citizenship. Countries with historically high demand — India, China, Mexico, and the Philippines — have longer queues and earlier cutoff dates than other countries."
      },
      {
        question: "How often does the Visa Bulletin change?",
        answer:
          "USCIS publishes a new Visa Bulletin monthly. Cutoff dates typically advance each month, but significant retrogressions — where dates move backward — occasionally happen. Always check the most current bulletin before making filing decisions."
      }
    ],
    relatedSlugs: ["document-pack-builder", "uscis-vaccine-finder"]
  },
  {
    slug: "document-pack-builder",
    title: "Document pack builder",
    longTitle: "Immigration document pack builder",
    description:
      "Generate a practical first-pass document checklist for layoffs, transfers, visa stamping, or adjustment preparation.",
    teaser:
      "Generate a practical document list for layoffs, transfers, stamping, or adjustment prep.",
    howToUse:
      "Select the situation you are preparing for — H-1B layoff, employer transfer, visa stamping, or adjustment of status — and indicate your timing urgency. The tool surfaces the core document packet and the first actions that usually matter most in that scenario, including dependent documents if applicable.",
    faqs: [
      {
        question: "What documents do I need after an H-1B layoff?",
        answer:
          "The essential set includes your passport and current visa stamp, all I-94 records, every I-797 approval notice, recent pay stubs, and your employment termination notice or separation email. Collecting these in the first day or two prevents scrambling later when time is short."
      },
      {
        question: "What is included in an H-1B transfer packet?",
        answer:
          "A typical H-1B transfer packet includes the passport and current I-94, all prior I-797 approval notices, recent pay stubs and W-2s, a current resume, and the new employer's offer letter with role details. Diploma, transcripts, and prior credential evaluations may also be needed."
      },
      {
        question: "What documents are needed for visa stamping?",
        answer:
          "Core consular stamping documents include the passport, DS-160 confirmation, latest I-797 approval notice, LCA copy, employment verification letter, recent pay stubs, and the interview appointment confirmation. Some consulates also ask for a client letter if you work at a client site."
      },
      {
        question: "What is adjustment of status?",
        answer:
          "Adjustment of status (Form I-485) is the process of applying for a green card from inside the United States without needing to travel abroad for consular processing. It is available when a visa number is current for your preference category and country of chargeability."
      }
    ],
    relatedSlugs: ["grace-period-calculator", "priority-date-checker"]
  }
];

export function getPublicTool(slug: string) {
  return publicTools.find((tool) => tool.slug === slug);
}

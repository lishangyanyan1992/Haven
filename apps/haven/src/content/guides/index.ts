import type { Guide } from "@/content/guides/types";

export type { Guide, GuideFaq, GuideSection } from "@/content/guides/types";

export const guides: Guide[] = [
  {
    slug: "h1b-layoff-checklist",
    title: "H-1B layoff checklist: what to do in the first 7 days",
    excerpt:
      "A practical first-week checklist for H-1B holders who were just laid off and need to stabilize documents, deadlines, and next actions fast.",
    description:
      "Use this H-1B layoff checklist to organize the first 7 days after a layoff, confirm your timeline, and keep your immigration options open.",
    category: "Layoff workflow",
    readingTime: "7 min read",
    updatedAt: "2026-04-03",
    author: "Haven editorial team",
    summaryPoints: [
      "Confirm your actual employment end date before you count days.",
      "Collect the documents every transfer or status option will need.",
      "Keep more than one path open while you assess employers and timing."
    ],
    sections: [
      {
        heading: "1. Lock down the date that actually controls your planning",
        paragraphs: [
          "The first thing to verify is not a forum answer. It is your actual employment end date. The date of the layoff meeting, final payroll date, severance period, and termination date on company paperwork are not always identical.",
          "If you build your entire next-step plan on the wrong date, every later decision gets noisier."
        ],
        bullets: [
          "Ask HR for the final date of employment in writing.",
          "Save the separation letter, final pay stub, and any benefits notices.",
          "Write down the exact date you will use for immigration planning and why."
        ]
      },
      {
        heading: "2. Gather your reusable immigration packet",
        paragraphs: [
          "Do this before outreach starts. A clean packet speeds up recruiter conversations, legal intake, and employer transfers.",
          "Most people lose time because they start looking for documents only after an opportunity appears."
        ],
        bullets: [
          "Passport, visa stamp, and most recent I-94",
          "Latest H-1B approval notice and prior approvals if you have them",
          "Recent pay stubs, offer letter, and current resume",
          "Any green card documents tied to your current employer"
        ]
      },
      {
        heading: "3. Build a three-branch plan for the next week",
        paragraphs: [
          "A strong first-week plan usually has one preferred path and two backups. That reduces panic because you are not emotionally over-committed to a single outcome.",
          "The goal is not to decide your entire future in two days. The goal is to preserve optionality while you gather facts."
        ],
        bullets: [
          "Primary path: line up transfer-friendly employers quickly",
          "Backup path: review change-of-status or dependent options with counsel",
          "Exit path: document what a clean departure plan would require if timing collapses"
        ]
      },
      {
        heading: "4. Communicate urgency with precision",
        paragraphs: [
          "Recruiters, attorneys, and friends are more useful when the message is specific. Tell them your visa type, latest work date, role, location, and time sensitivity.",
          "Specific urgency gets faster, better help than a vague request for advice."
        ]
      }
    ],
    faqs: [
      {
        question: "What is the first thing I should do after an H-1B layoff?",
        answer:
          "Confirm your exact employment end date, then collect your immigration documents and map at least one transfer path plus one backup path."
      },
      {
        question: "Should I start applying immediately or organize documents first?",
        answer:
          "Do both in parallel, but organize the reusable document packet immediately so you do not lose time once interviews or legal requests start moving."
      }
    ],
    relatedSlugs: ["h1b-60-day-grace-period", "h1b-layoff-options", "h1b-transfer-timeline"]
  },
  {
    slug: "h1b-60-day-grace-period",
    title: "H-1B 60-day grace period: what it means and how to use it",
    excerpt:
      "A plain-language guide to how the 60-day grace period affects your decision window after a layoff, employer change, or sudden job loss.",
    description:
      "Understand the H-1B 60-day grace period, what date to track, and how to use the window to compare transfer, status, and departure options.",
    category: "Layoff workflow",
    readingTime: "6 min read",
    updatedAt: "2026-04-03",
    author: "Haven editorial team",
    summaryPoints: [
      "The grace-period conversation starts with the correct end date, not assumptions.",
      "This window is best used to compare realistic options, not to panic-refresh forums.",
      "A backup plan improves the quality of your primary plan."
    ],
    sections: [
      {
        heading: "1. Treat the 60-day window as a planning horizon",
        paragraphs: [
          "For most people, the grace period feels shorter than it looks because the first days are consumed by shock, logistics, and information gathering.",
          "That is why the right frame is not 'I have 60 days.' It is 'I need a decision system that works inside a limited window.'"
        ]
      },
      {
        heading: "2. Figure out when your countdown really starts",
        paragraphs: [
          "The biggest source of confusion is date selection. Your meeting date may not be the same as the end of paid employment. If you are unclear, ask for the answer in writing.",
          "One clarified date usually removes a surprising amount of panic."
        ],
        bullets: [
          "Ask for the final employment date, not just the layoff date.",
          "Check whether severance or payroll continuation changes the timeline.",
          "Write the planning date down in one place and use it consistently."
        ]
      },
      {
        heading: "3. Use the window to compare paths side by side",
        paragraphs: [
          "This period is most useful when you compare options on one page instead of evaluating them emotionally in fragments.",
          "People often need a transfer plan, a backup status plan, and a departure branch all visible at once."
        ],
        bullets: [
          "Transfer path: which employers can file soon enough?",
          "Status path: is there a realistic bridge if hiring slows down?",
          "Departure path: what has to happen if neither option stabilizes?"
        ]
      },
      {
        heading: "4. Avoid false certainty from generic internet timelines",
        paragraphs: [
          "A lot of public advice compresses a complex situation into one sentence. That is useful for orientation but weak for decisions.",
          "The better question is not 'What usually happens?' It is 'What is realistic in my case, with my dates, my role, and my opportunities?'"
        ]
      }
    ],
    faqs: [
      {
        question: "Does the 60-day grace period always start on the layoff meeting date?",
        answer:
          "Not necessarily. The more relevant date can be the final day of employment or payroll, so you should confirm that date in writing."
      },
      {
        question: "What should I do during the grace period?",
        answer:
          "Use it to verify your timeline, gather documents, pursue employers who can support a transfer, and understand backup status or departure options."
      }
    ],
    relatedSlugs: ["h1b-layoff-checklist", "h1b-layoff-options", "h1b-transfer-checklist"]
  },
  {
    slug: "h1b-transfer-timeline",
    title: "H-1B transfer timeline: what usually happens and what slows it down",
    excerpt:
      "A step-by-step view of the H-1B transfer timeline so you can see where delays usually appear and what to prepare early.",
    description:
      "Learn the typical H-1B transfer timeline, the key stages, and what slows down employer changes when time is tight.",
    category: "Transfer workflow",
    readingTime: "7 min read",
    updatedAt: "2026-04-03",
    author: "Haven editorial team",
    summaryPoints: [
      "The employer’s legal and document process is often the real bottleneck.",
      "Transfer speed depends on role clarity, work location, and document readiness.",
      "The earlier you understand filing timing, the less guesswork you carry."
    ],
    sections: [
      {
        heading: "1. Separate offer timing from filing timing",
        paragraphs: [
          "Candidates often hear urgency from a hiring team and assume that means immigration paperwork will move just as quickly. It may not.",
          "The timeline that matters is when legal intake starts, when the packet is complete, and when the employer is ready to file."
        ]
      },
      {
        heading: "2. Expect document collection to shape the early phase",
        paragraphs: [
          "If your packet is incomplete, everything feels delayed even before substantive legal work begins.",
          "That is why a reusable document set matters so much for transfer workflows."
        ],
        bullets: [
          "Identity and immigration records",
          "Pay documentation and current employment details",
          "Resume, title, salary, and work-location information"
        ]
      },
      {
        heading: "3. Watch the variables that commonly slow transfers down",
        paragraphs: [
          "The riskiest delays are often operational, not theoretical. Missing location details, changing start dates, compensation revisions, and employer legal queue delays all add friction.",
          "If timing is tight, ask questions about process ownership instead of assuming the company will move automatically."
        ],
        bullets: [
          "Who owns legal intake and when will it start?",
          "Has the work location been finalized?",
          "Does the employer need extra approvals before filing?"
        ]
      },
      {
        heading: "4. Keep a transfer backup even when the offer looks strong",
        paragraphs: [
          "Strong offers still slip. Teams get busy, approvals stall, or documents surface late. A backup branch prevents your whole plan from collapsing emotionally when one stage moves slower than expected.",
          "The point is not to be pessimistic. The point is to stay operational."
        ]
      }
    ],
    faqs: [
      {
        question: "What usually slows down an H-1B transfer?",
        answer:
          "The most common slowdowns are employer legal queue delays, missing documents, unresolved work-location details, and internal approvals before filing."
      },
      {
        question: "When should I ask about the filing date?",
        answer:
          "As early as possible. Filing date matters more than general enthusiasm from the hiring team when your time window is narrow."
      }
    ],
    relatedSlugs: ["h1b-transfer-checklist", "h1b-layoff-checklist", "h1b-layoff-options"]
  },
  {
    slug: "h1b-transfer-checklist",
    title: "H-1B transfer checklist: what to verify before you move jobs",
    excerpt:
      "Use this H-1B transfer checklist to pressure-test a new offer, clarify filing readiness, and avoid avoidable immigration surprises.",
    description:
      "An H-1B transfer checklist for evaluating new offers, confirming filing readiness, and reducing risk before changing employers.",
    category: "Transfer workflow",
    readingTime: "6 min read",
    updatedAt: "2026-04-03",
    author: "Haven editorial team",
    summaryPoints: [
      "Verify filing readiness, not just verbal enthusiasm from the employer.",
      "Role, location, and timing details matter as much as salary.",
      "Short-term work authorization should be reviewed alongside long-term planning."
    ],
    sections: [
      {
        heading: "1. Ask how the transfer process will actually run",
        paragraphs: [
          "The right question is not just whether the company sponsors transfers. It is how their process works in practice when timing matters.",
          "A company with a clean playbook is safer than a company with vague reassurance."
        ],
        bullets: [
          "Who handles immigration intake?",
          "How quickly can the company gather the filing packet?",
          "What dependencies could delay the filing date?"
        ]
      },
      {
        heading: "2. Confirm the details that affect the filing",
        paragraphs: [
          "Remote work assumptions, hybrid expectations, title changes, and reporting-line changes all matter. These details should be aligned before documents start moving.",
          "Small mismatches create outsized delay when time is constrained."
        ]
      },
      {
        heading: "3. Review downstream green card impact too",
        paragraphs: [
          "A transfer can be a good short-term solution and still complicate a long-term plan. If you are already in a green card process, ask what carries over and what does not.",
          "The best decision is the one that fits both the urgent timeline and the broader immigration strategy."
        ]
      },
      {
        heading: "4. Keep one backup branch visible",
        paragraphs: [
          "Even if the new employer looks strong, track a fallback branch in case the transfer drifts.",
          "You do not need to live in fear. You do need to stay prepared."
        ]
      }
    ],
    faqs: [
      {
        question: "What should I verify before accepting an H-1B transfer offer?",
        answer:
          "Verify legal intake timing, filing readiness, work location, role details, and whether the move changes any long-term green card planning assumptions."
      },
      {
        question: "Is the start date the most important date in a transfer?",
        answer:
          "Usually no. The more important operational date is when the employer can complete the packet and file."
      }
    ],
    relatedSlugs: ["h1b-transfer-timeline", "h1b-60-day-grace-period", "h1b-layoff-options"]
  },
  {
    slug: "h1b-layoff-options",
    title: "Laid off on H-1B? Compare your options before the clock gets tight",
    excerpt:
      "A decision-oriented guide to comparing transfer, change-of-status, dependent, and departure paths after an H-1B layoff.",
    description:
      "Compare H-1B layoff options side by side so you can decide faster and keep realistic backup paths open.",
    category: "Decision guide",
    readingTime: "8 min read",
    updatedAt: "2026-04-03",
    author: "Haven editorial team",
    summaryPoints: [
      "The best option depends on timing, employer readiness, and your broader case history.",
      "Comparing options side by side reduces panic and improves decisions.",
      "A backup plan is not defeat. It is part of competent planning."
    ],
    sections: [
      {
        heading: "1. Start with a comparison table, not a favorite answer",
        paragraphs: [
          "When people are under pressure, they often anchor on the first option that sounds hopeful. That can be useful emotionally, but it is weak decision-making.",
          "A more reliable move is to compare your realistic paths side by side and ask what each requires in terms of timing, cost, employer support, and risk."
        ]
      },
      {
        heading: "2. Transfer is often the cleanest path, but not always the fastest one in practice",
        paragraphs: [
          "A transfer can be the best outcome when an employer can move quickly and your documents are ready. But not every promising process becomes a filed case on time.",
          "That is why transfer planning works best when paired with a backup branch."
        ]
      },
      {
        heading: "3. Backup paths matter because uncertainty compounds",
        paragraphs: [
          "Status-change options, dependent paths, or a clean departure plan are not signs that the transfer path failed. They are part of robust planning under uncertainty.",
          "When the primary path slips, the backup should already be partially understood."
        ],
        bullets: [
          "What documents would each path require?",
          "What decision date would force a change of plan?",
          "Which branch is most realistic if hiring slows down?"
        ]
      },
      {
        heading: "4. Ask better questions before committing to one route",
        paragraphs: [
          "The fastest way to get unstuck is often to upgrade the questions you ask. Instead of asking, 'What do most people do?' ask, 'Which path fits my dates, role, support system, and timeline risk?'",
          "That question is harder, but it is the one that produces useful decisions."
        ]
      }
    ],
    faqs: [
      {
        question: "What are my options after an H-1B layoff?",
        answer:
          "Common paths include an H-1B transfer, a qualifying change of status, a dependent route if available, or a clean departure plan if the timing does not support the others."
      },
      {
        question: "Should I rely on one option only?",
        answer:
          "Usually no. The safest planning posture is one primary path plus one realistic backup while your timeline is still workable."
      }
    ],
    relatedSlugs: ["h1b-layoff-checklist", "h1b-60-day-grace-period", "h1b-transfer-timeline"]
  }
];

import type { HavenWorkspaceSnapshot } from "@/types/domain";

export const havenSnapshot: HavenWorkspaceSnapshot = {
  profile: {
    id: "user-1",
    fullName: "Priya Shah",
    email: "priya@example.com",
    visaType: "H1B",
    countryOfBirth: "India",
    currentVisaExpiryDate: "2027-08-15",
    h1bStartDate: "2022-10-01",
    permStage: "in_progress",
    permFilingDate: "2025-06-12",
    i140Approved: true,
    i140ApprovalDate: "2025-09-10",
    priorityDate: "2025-06-12",
    preferenceCategory: "EB-2",
    i485Filed: false,
    employerName: "Nimbus AI",
    employerSize: "enterprise",
    employerIndustry: "Software",
    jobTitle: "Senior Product Designer",
    employmentStatus: "employed",
    spouseVisaStatus: "H4",
    primaryGoal: "get_gc",
    topConcerns: ["layoffs", "gc_timeline", "job_change"]
  },
  dashboard: {
    nextActions: [
      "Confirm whether your I-140 has crossed the 180-day AC21 portability threshold.",
      "Prepare a layoff packet with I-797, recent paystubs, and attorney contact info.",
      "Forward your latest attorney update so Haven can confirm your PERM and I-140 dates."
    ],
    communityMatchesLabel: "8 Haven members match your H1B + EB-2 India profile",
    timelineHighlights: [
      {
        id: "event-1",
        kind: "ac21_unlock",
        group: "upcoming",
        title: "AC21 portability unlock",
        dateLabel: "Mar 9, 2026",
        nextAction: "If layoffs become a risk, target same-or-similar roles after this date.",
        explanation: "Your I-140 approval is approaching the 180-day portability threshold.",
        communityLinkLabel: "See similar job-change stories"
      },
      {
        id: "event-2",
        kind: "renewal_window",
        group: "future",
        title: "H1B renewal window opens",
        dateLabel: "Feb 15, 2027",
        nextAction: "Check with HR 6 months before expiry if filing prep has started.",
        explanation: "Haven computed this from your current visa expiry date."
      }
    ],
    signals: {
      h1bCapDate: "2028-09-30",
      daysUntilVisaExpiry: 514,
      visaBulletinPosition: "Backlogged. Monitor EB-2 movement for India.",
      estimatedGreenCardDateRange: "Estimate pending bulletin sync",
      ac21PortabilityStatus: "Available after Mar 9, 2026",
      layoffReadinessScore: "medium",
      layoffReadinessReasoning: [
        "You have an approved I-140, which increases flexibility.",
        "Your priority date is not current, so adjustment-based work authorization is not available yet.",
        "Your spouse path may provide H4 options, but timing depends on employment changes."
      ]
    }
  },
  onboardingSteps: [
    {
      id: "step-1",
      title: "Who are you?",
      description: "Collect current visa status, country of birth, and primary goal.",
      prompt: "Tell Haven your visa status and what you want most right now.",
      valuePreview: [
        "See your queue position and next immigration milestone immediately.",
        "Get routed to the right product experience for H1B, OPT, or alternative paths."
      ]
    },
    {
      id: "step-2",
      title: "Your employment",
      description: "Capture employer, role, and H1B start date.",
      prompt: "Add your employer context so Haven can compute cap and renewal windows.",
      valuePreview: [
        "Compute your H1B 6-year cap date.",
        "Surface a renewal window before your employer misses it."
      ]
    },
    {
      id: "step-3",
      title: "Your green card journey",
      description: "Capture PERM, I-140, priority date, and preference category.",
      prompt: "This powers your visa bulletin tracking and layoff planning.",
      valuePreview: [
        "See current bulletin positioning and date range estimates.",
        "Check AC21 portability timing if your I-140 is approved."
      ]
    },
    {
      id: "step-4",
      title: "Your situation",
      description: "Capture spouse status and top concerns.",
      prompt: "Haven uses this to rank the right next actions.",
      valuePreview: [
        "Generate a layoff readiness score.",
        "Route you into the layoff planner and the most relevant community cohort."
      ]
    },
    {
      id: "step-5",
      title: "Connect your documents",
      description: "Optional manual email forwarding for passive enrichment.",
      prompt: "Forward immigration emails to keep your timeline updated automatically.",
      valuePreview: [
        "Parse I-797 notices, attorney updates, and USCIS receipts.",
        "Ask for confirmation before any field is added to your profile."
      ]
    }
  ],
  timelineEvents: [
    {
      id: "timeline-1",
      kind: "h1b_cap",
      group: "future",
      title: "Estimated H1B 6-year cap date",
      dateLabel: "Sep 30, 2028",
      nextAction: "Use this to back-plan extensions and green card milestones.",
      explanation: "Derived from your H1B start date."
    },
    {
      id: "timeline-2",
      kind: "visa_bulletin_update",
      group: "now",
      title: "Latest visa bulletin update",
      dateLabel: "March 2026 bulletin",
      nextAction: "Review whether filing charts changed for EB-2 India.",
      explanation: "Haven recalculates your position each month."
    },
    {
      id: "timeline-3",
      kind: "ac21_unlock",
      group: "upcoming",
      title: "AC21 portability milestone",
      dateLabel: "Mar 9, 2026",
      nextAction: "After this date, same-or-similar job changes may preserve your I-140 benefits.",
      explanation: "180 days after I-140 approval."
    },
    {
      id: "timeline-4",
      kind: "priority_date_current",
      group: "future",
      title: "Estimated priority date movement window",
      dateLabel: "Pending live bulletin sync",
      nextAction: "Treat this as directional only; Haven will keep updating it monthly.",
      explanation: "Projection appears after Haven has live bulletin data for your profile."
    }
  ],
  planner: {
    situationSummary:
      "You are on H1B with an approved I-140, an EB-2 India priority date, and no current I-485. If a layoff happened today, your strongest path is likely an H1B transfer while preserving long-term green card progress through AC21 portability after the 180-day threshold.",
    rankedOptions: [
      {
        id: "option-1",
        title: "H1B transfer to a same-or-similar role",
        fitScore: 94,
        summary: "Best fit for staying in the US long-term while protecting green card momentum.",
        whyItFits: [
          "You already have an approved I-140.",
          "Your stated goal is long-term green card progress.",
          "Your job title supports same-or-similar role matching."
        ],
        constraints: ["Portability logic is strongest after the 180-day approval threshold.", "You still need a new employer willing to file quickly."]
      },
      {
        id: "option-2",
        title: "Move to H4 if spouse status permits",
        fitScore: 63,
        summary: "A backup path if your spouse can maintain qualifying status and timing works.",
        whyItFits: ["Your spouse is already in H4-related status planning.", "This can reduce immediate out-of-status risk in some cases."],
        constraints: ["Work authorization depends on H4 EAD eligibility and timing.", "This does not solve long-term employer sponsorship needs."]
      },
      {
        id: "option-3",
        title: "Prepare alternative visa exploration",
        fitScore: 42,
        summary: "Reserve path for O-1 or self-petition exploration if employer paths fail.",
        whyItFits: ["High-skill profile may justify future alternative-path review."],
        constraints: ["Out of scope for V1 full guidance.", "Requires attorney review."]
      }
    ],
    checklist: [
      {
        id: "check-1",
        window: "Day 1-7",
        title: "Collect your immigration packet",
        detail: "Download I-797 approvals, recent paystubs, attorney correspondence, PERM status details, and spouse-related documents."
      },
      {
        id: "check-2",
        window: "Day 7-30",
        title: "Start transfer-focused job search",
        detail: "Prioritize same-or-similar roles and confirm new employers can support H1B transfer timing."
      },
      {
        id: "check-3",
        window: "Day 30-60",
        title: "Decide transfer vs. status fallback",
        detail: "If a new employer is not secured, evaluate spouse-based fallback or departure planning with counsel."
      }
    ],
    communityContext: "Members in this cohort have shared B-2 bridge strategies, RFE rebuttals, and day-1 layoff checklists in the last 90 days.",
    disclaimer:
      "Haven provides information, not legal advice. Your immigration situation is unique. Consult a qualified immigration attorney before making decisions."
  },
  cohorts: [
    {
      id: "cohort-1",
      type: "cohort",
      name: "EB-2 India | Approved I-140 | Layoff watch",
      summary: "Small cohort for H1B users tracking portability and priority-date backlog.",
      members: [
        { id: "member-1", label: "Member A", visaType: "H1B", countryOfBirth: "India", priorityDateRange: "2024-2025", topConcern: "layoffs" },
        { id: "member-2", label: "Member B", visaType: "H1B", countryOfBirth: "India", priorityDateRange: "2025-2026", topConcern: "gc_timeline" }
      ],
      posts: [
        {
          id: "post-1",
          spaceType: "cohort",
          authorLabel: "Member A",
          title: "Used B-2 as a bridge — H1B came through",
          body: "Got laid off last May from a SaaS company. Couldn't land an offer inside 60 days so I filed B-2 COS on day 59. While that was pending I found a role at an AI startup. Attorney filed the H1B transfer and it got approved. The bridge worked. If you're on day 40+ with no offer in hand, file B-2 now — don't wait to see if something materialises. The window is real.",
          createdAt: "2026-03-18T18:00:00.000Z",
          tags: ["B2_bridge", "job_change"]
        },
        {
          id: "post-1b",
          spaceType: "cohort",
          authorLabel: "Member B",
          title: "Survived a B-2 RFE — paystubs were everything",
          body: "Laid off in May, made final rounds at three companies but no decisions before day 60. Filed B-2 on day 59. Got two offers on day 79 and 82. New employer filed H1B + H4 + EAD together in premium. Three days later: RFE about status maintenance during and after the grace period. Lawyers responded with paystubs and I-94s, approved within a week. Document every paystub, every I-94 entry. That paper trail is what cleared the RFE.",
          createdAt: "2026-03-15T10:00:00.000Z",
          tags: ["RFE", "B2_bridge", "grace_period"]
        }
      ]
    }
  ],
  warRoom: {
    id: "war-room-1",
    type: "war_room",
    name: "Layoff War Room",
    summary: "Dedicated high-urgency space for users inside a 60-day grace period or actively planning for one.",
    members: [
      { id: "member-3", label: "Member C", visaType: "H1B", countryOfBirth: "China", priorityDateRange: "2022-2023", topConcern: "layoffs" },
      { id: "member-4", label: "Member D", visaType: "H1B", countryOfBirth: "India", priorityDateRange: "2023-2024", topConcern: "layoffs" }
    ],
    posts: [
      {
        id: "post-2",
        spaceType: "war_room",
        authorLabel: "Member C",
        title: "Day 1 after layoff — what I actually did",
        body: "Got laid off after 4 years. Here's what I did in the first 24 hours: called my immigration attorney, downloaded every I-797 and paystub from the HR portal before my access cut off, and set up a job search tracker. The 60-day clock is real but it's manageable if you start moving immediately. The worst thing you can do is lose the first week to shock. Attorney call first, document pull second, job search third.",
        createdAt: "2026-03-19T12:15:00.000Z",
        tags: ["day_1", "60_day_window"]
      },
      {
        id: "post-3",
        spaceType: "war_room",
        authorLabel: "Member D",
        title: "Got the new B-2 RFE about 'job searching' — we beat it",
        body: "Filed B-2 COS after my grace period and disclosed I intended to job search while in B-2 status. Got an RFE saying job searching during B-2 isn't allowed. My attorney pushed back with one argument: B-2 is a temporary bridge. The fact that I planned to land a permanent job on the other side doesn't make the bridge permanent. USCIS approved it. If you get this RFE, don't panic — the logic in it doesn't hold up and there's a clear rebuttal.",
        createdAt: "2026-03-17T09:30:00.000Z",
        tags: ["B2", "RFE", "grace_period"]
      }
    ]
  },
  documents: [
    {
      id: "doc-1",
      displayLabel: "I-140 approval notice",
      documentKind: "i140_notice",
      sourceKind: "manual_upload",
      originalName: "i140-approval-notice.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 418233,
      uploadedAt: "2026-03-18T14:05:00.000Z",
      crisisCritical: true,
      notes: "Primary portability document."
    },
    {
      id: "doc-2",
      displayLabel: "H-1B petition packet",
      documentKind: "h1b_petition",
      sourceKind: "manual_upload",
      originalName: "h1b-petition-lca.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 732110,
      uploadedAt: "2026-03-17T09:30:00.000Z",
      crisisCritical: true,
      notes: "Includes petition and certified LCA."
    }
  ],
  emailAlias: null,
  emailInbox: [
    {
      id: "email-1",
      alias: "priya-a91f2@import.haven-h1b.com",
      sourceType: "attorney_update",
      subject: "I-140 approval notice received",
      receivedAt: "2026-03-18T14:03:00.000Z",
      extractedFields: [
        { label: "I-140 approval date", value: "2025-09-10", confidence: "high" },
        { label: "Preference category", value: "EB-2", confidence: "high" }
      ],
      status: "pending_confirmation",
      senderEmail: null,
      senderName: null,
      bodyText: null,
      threadId: null,
      contact: null
    },
    {
      id: "email-2",
      alias: "priya-a91f2@import.haven-h1b.com",
      sourceType: "uscis_receipt",
      subject: "Receipt notice for PERM filing support documents",
      receivedAt: "2026-03-11T09:42:00.000Z",
      extractedFields: [{ label: "PERM filing date", value: "2025-06-12", confidence: "medium" }],
      status: "accepted",
      senderEmail: null,
      senderName: null,
      bodyText: null,
      threadId: null,
      contact: null
    }
  ],
  emailThreads: [],
  emailContacts: []
};

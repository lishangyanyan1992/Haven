import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultRequiredDocuments } from "@/lib/document-vault";
import type { SharedAnswers } from "@/lib/firms/answers";
import type { FirmClientStatus } from "@/lib/firms/types";

export type DemoLeadTemplate = {
  fullName: string;
  email: string;
  status: FirmClientStatus;
  isNew?: boolean; // finished and unreviewed
  joinedOffsetDays?: number; // relative to refDate
  answers: SharedAnswers;
  // Relative date offsets in days from reference date:
  statusEndOffset?: number;
  lastWorkDayOffset?: number;
  agencyDeadlineOffset?: number;
  travelOffset?: number;
  // If this lead should have sample documents attached (showcase lead index 1..8)
  showcaseIndex?: number;
};

// 50 Handcrafted Personas spanning all urgency tiers and statuses
export const DEMO_LEAD_TEMPLATES: DemoLeadTemplate[] = [
  // ==========================================
  // TIER: URGENT (~10 leads)
  // ==========================================
  {
    fullName: "Arjun Menon",
    email: "arjun.menon@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -2,
    showcaseIndex: 1,
    lastWorkDayOffset: -48, // 48 days ago -> grace period ends in 12 days! (urgent: <= 15)
    answers: {
      fullName: "Arjun Menon",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "Northwind Systems",
      jobTitle: "Staff Software Engineer",
      h1bStartDate: "2021-10-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2021-11-03",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H4",
      topConcerns: ["layoffs", "visa_expiry", "gc_timeline"],
      jobEnded: "yes"
    }
  },
  {
    fullName: "Elena Rostova",
    email: "elena.rostova@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -1,
    showcaseIndex: 2,
    agencyDeadlineOffset: 6, // RFE response due in 6 days! (urgent: <= 14)
    answers: {
      fullName: "Elena Rostova",
      visaType: "O-1A",
      countryOfBirth: "Ukraine",
      primaryGoal: "get_gc",
      employerName: "Apex AI Labs",
      jobTitle: "Principal AI Researcher",
      employerSize: "startup",
      greenCardStage: "not_started",
      preferenceCategory: "EB-1A",
      spouseVisaStatus: "none",
      topConcerns: ["visa_expiry"],
      agencyDeadlineType: "rfe"
    }
  },
  {
    fullName: "Wei Chen",
    email: "wei.chen@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -5,
    showcaseIndex: 3,
    statusEndOffset: 18, // Status ends in 18 days! (urgent: <= 30)
    answers: {
      fullName: "Wei Chen",
      visaType: "F-1 OPT",
      countryOfBirth: "China",
      primaryGoal: "job_stability",
      employerName: "Kestrel Robotics",
      jobTitle: "Mechanical Engineer",
      employerSize: "mid-size",
      greenCardStage: "not_started",
      preferenceCategory: "EB-3",
      spouseVisaStatus: "H1B",
      topConcerns: ["visa_expiry", "job_change"]
    }
  },
  {
    fullName: "Siddharth Verma",
    email: "siddharth.v@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -3,
    showcaseIndex: 4,
    agencyDeadlineOffset: 9, // Biometrics / Interview in 9 days! (urgent: <= 14)
    answers: {
      fullName: "Siddharth Verma",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "CloudScale Technologies",
      jobTitle: "Lead Solutions Architect",
      h1bStartDate: "2019-04-15",
      employerSize: "enterprise",
      greenCardStage: "i485_filed",
      priorityDate: "2014-06-12",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H4 EAD",
      topConcerns: ["gc_timeline"],
      agencyDeadlineType: "interview"
    }
  },
  {
    fullName: "Camila Fernandez",
    email: "camila.f@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -4,
    travelOffset: 5, // International travel in 5 days! (urgent: <= 14)
    statusEndOffset: 120,
    answers: {
      fullName: "Camila Fernandez",
      visaType: "L-1A",
      countryOfBirth: "Mexico",
      primaryGoal: "stay_flexible",
      employerName: "Santander Global",
      jobTitle: "VP of Treasury Operations",
      employerSize: "enterprise",
      greenCardStage: "perm_in_progress",
      preferenceCategory: "EB-1C",
      spouseVisaStatus: "citizen",
      topConcerns: ["visa_expiry"],
      travelPlanned: "yes"
    }
  },
  {
    fullName: "Karthik Subramanian",
    email: "karthik.sub@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -1,
    showcaseIndex: 5,
    lastWorkDayOffset: -64, // 64 days ago -> grace period ended 4 days ago! (urgent: overdue)
    answers: {
      fullName: "Karthik Subramanian",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "explore_options",
      employerName: "FinTech Foundry",
      jobTitle: "Senior DevOps Engineer",
      h1bStartDate: "2022-02-01",
      employerSize: "startup",
      greenCardStage: "not_started",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "none",
      topConcerns: ["layoffs", "visa_expiry"],
      jobEnded: "yes"
    }
  },
  {
    fullName: "Mei-Ling Zhao",
    email: "meiling.z@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -7,
    agencyDeadlineOffset: 12, // Biometrics appointment in 12 days
    answers: {
      fullName: "Mei-Ling Zhao",
      visaType: "F-1 STEM OPT",
      countryOfBirth: "China",
      primaryGoal: "get_gc",
      employerName: "Baidu USA",
      jobTitle: "Data Scientist",
      employerSize: "enterprise",
      greenCardStage: "perm_in_progress",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "none",
      topConcerns: ["visa_expiry"],
      agencyDeadlineType: "biometrics"
    }
  },
  {
    fullName: "Lucas Silva",
    email: "lucas.silva@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -2,
    statusEndOffset: 8, // Status ends in 8 days
    answers: {
      fullName: "Lucas Silva",
      visaType: "B-2",
      countryOfBirth: "Brazil",
      primaryGoal: "explore_options",
      employerName: "",
      jobTitle: "Product Designer",
      employerSize: "startup",
      greenCardStage: "not_started",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "none",
      topConcerns: ["visa_expiry"]
    }
  },
  {
    fullName: "Ananya Deshmukh",
    email: "ananya.d@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -3,
    lastWorkDayOffset: -52, // Grace period ends in 8 days
    answers: {
      fullName: "Ananya Deshmukh",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "job_stability",
      employerName: "BioGenex",
      jobTitle: "Bioinformatics Specialist",
      h1bStartDate: "2020-08-01",
      employerSize: "mid-size",
      greenCardStage: "i140_approved",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H4",
      topConcerns: ["layoffs"],
      jobEnded: "yes"
    }
  },
  {
    fullName: "Tariq Mansoor",
    email: "tariq.m@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -8,
    agencyDeadlineOffset: 3, // Urgent RFE in 3 days
    answers: {
      fullName: "Tariq Mansoor",
      visaType: "TN",
      countryOfBirth: "Canada",
      primaryGoal: "stay_flexible",
      employerName: "Shopify Inc",
      jobTitle: "Senior Product Manager",
      employerSize: "enterprise",
      greenCardStage: "not_started",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "none",
      topConcerns: ["visa_expiry"],
      agencyDeadlineType: "rfe"
    }
  },

  // ==========================================
  // TIER: SOON (~15 leads, 15 to 90 days)
  // ==========================================
  {
    fullName: "Priya Shah",
    email: "priya.shah@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -12,
    showcaseIndex: 6,
    lastWorkDayOffset: -10, // Laid off 10 days ago -> grace period ends in 50 days (soon: <= 90)
    answers: {
      fullName: "Priya Shah",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "Stripe",
      jobTitle: "Senior Backend Engineer",
      h1bStartDate: "2020-10-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2020-12-15",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H4",
      topConcerns: ["layoffs", "gc_timeline"],
      jobEnded: "yes"
    }
  },
  {
    fullName: "David O'Connor",
    email: "david.oc@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -1,
    showcaseIndex: 7,
    statusEndOffset: 45, // Status ends in 45 days (soon: <= 90)
    answers: {
      fullName: "David O'Connor",
      visaType: "E-3",
      countryOfBirth: "Australia",
      primaryGoal: "job_stability",
      employerName: "Atlassian",
      jobTitle: "Engineering Manager",
      employerSize: "enterprise",
      greenCardStage: "perm_in_progress",
      preferenceCategory: "EB-3",
      spouseVisaStatus: "none",
      topConcerns: ["visa_expiry"]
    }
  },
  {
    fullName: "Hye-Jin Park",
    email: "hyejin.park@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -15,
    showcaseIndex: 8,
    statusEndOffset: 60, // STEM OPT ends in 60 days
    answers: {
      fullName: "Hye-Jin Park",
      visaType: "F-1 STEM OPT",
      countryOfBirth: "South Korea",
      primaryGoal: "get_gc",
      employerName: "Samsung Electronics",
      jobTitle: "Hardware Design Engineer",
      employerSize: "enterprise",
      greenCardStage: "not_started",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "none",
      topConcerns: ["visa_expiry", "job_change"]
    }
  },
  {
    fullName: "Rafael Souza",
    email: "rafael.souza@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -20,
    lastWorkDayOffset: -15, // Laid off 15 days ago -> 45 days left
    answers: {
      fullName: "Rafael Souza",
      visaType: "H-1B",
      countryOfBirth: "Brazil",
      primaryGoal: "explore_options",
      employerName: "Halcyon Health",
      jobTitle: "Data Scientist",
      h1bStartDate: "2023-10-01",
      employerSize: "startup",
      greenCardStage: "perm_in_progress",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "none",
      topConcerns: ["layoffs"],
      jobEnded: "yes"
    }
  },
  {
    fullName: "Deepak Chopra",
    email: "deepak.c@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -6,
    statusEndOffset: 75,
    answers: {
      fullName: "Deepak Chopra",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "job_stability",
      employerName: "Oracle",
      jobTitle: "Principal Consultant",
      h1bStartDate: "2018-09-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H4 EAD"
    }
  },
  {
    fullName: "Chloe Dubois",
    email: "chloe.dubois@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -2,
    agencyDeadlineOffset: 40, // Consular interview in 40 days
    answers: {
      fullName: "Chloe Dubois",
      visaType: "J-1",
      countryOfBirth: "France",
      primaryGoal: "stay_flexible",
      employerName: "Stanford University",
      jobTitle: "Postdoctoral Scholar",
      employerSize: "enterprise",
      greenCardStage: "not_started",
      preferenceCategory: "EB-1A",
      spouseVisaStatus: "J-2",
      agencyDeadlineType: "interview"
    }
  },
  {
    fullName: "Alejandro Morales",
    email: "alejandro.m@example.invalid",
    status: "signed_up",
    joinedOffsetDays: -5,
    answers: {}
  },
  {
    fullName: "Vikram Singhal",
    email: "vikram.s@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -14,
    lastWorkDayOffset: -8, // 52 days grace period remaining
    answers: {
      fullName: "Vikram Singhal",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "job_stability",
      employerName: "DoorDash",
      jobTitle: "Senior Mobile Engineer",
      h1bStartDate: "2021-03-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      preferenceCategory: "EB-2",
      jobEnded: "yes"
    }
  },
  {
    fullName: "Amina Al-Mansoor",
    email: "amina.al@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -9,
    statusEndOffset: 85,
    answers: {
      fullName: "Amina Al-Mansoor",
      visaType: "H-1B",
      countryOfBirth: "Other",
      primaryGoal: "get_gc",
      employerName: "Pfizer",
      jobTitle: "Research Scientist",
      employerSize: "enterprise",
      greenCardStage: "perm_certified",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Gabriel Rossi",
    email: "gabriel.rossi@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -18,
    travelOffset: 35, // Travel in 35 days
    answers: {
      fullName: "Gabriel Rossi",
      visaType: "O-1A",
      countryOfBirth: "Italy",
      primaryGoal: "stay_flexible",
      employerName: "SoundWave Media",
      jobTitle: "Chief Creative Officer",
      employerSize: "startup",
      greenCardStage: "not_started",
      preferenceCategory: "EB-1A",
      travelPlanned: "yes"
    }
  },
  {
    fullName: "Neha Kapoor",
    email: "neha.k@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -3,
    statusEndOffset: 50,
    answers: {
      fullName: "Neha Kapoor",
      visaType: "H-4 EAD",
      countryOfBirth: "India",
      primaryGoal: "job_stability",
      employerName: "Salesforce",
      jobTitle: "Program Manager",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H1B"
    }
  },
  {
    fullName: "Yuki Tanaka",
    email: "yuki.tanaka@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -22,
    agencyDeadlineOffset: 65, // USCIS deadline in 65 days
    answers: {
      fullName: "Yuki Tanaka",
      visaType: "L-1B",
      countryOfBirth: "Other",
      primaryGoal: "get_gc",
      employerName: "Sony Interactive",
      jobTitle: "Systems Architect",
      employerSize: "enterprise",
      greenCardStage: "perm_in_progress",
      preferenceCategory: "EB-2",
      agencyDeadlineType: "other"
    }
  },
  {
    fullName: "Mateo Gomez",
    email: "mateo.g@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -11,
    statusEndOffset: 70,
    answers: {
      fullName: "Mateo Gomez",
      visaType: "F-1 OPT",
      countryOfBirth: "Colombia",
      primaryGoal: "job_stability",
      employerName: "Robinhood",
      jobTitle: "Financial Analyst",
      employerSize: "mid-size"
    }
  },
  {
    fullName: "Fatima Zahra",
    email: "fatima.z@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -25,
    lastWorkDayOffset: -22, // 38 days left on grace period
    answers: {
      fullName: "Fatima Zahra",
      visaType: "H-1B",
      countryOfBirth: "Other",
      primaryGoal: "explore_options",
      employerName: "Lyft",
      jobTitle: "Operations Lead",
      h1bStartDate: "2022-07-01",
      employerSize: "enterprise",
      jobEnded: "yes"
    }
  },
  {
    fullName: "Linus Lindqvist",
    email: "linus.l@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -2,
    statusEndOffset: 80,
    answers: {
      fullName: "Linus Lindqvist",
      visaType: "H-1B",
      countryOfBirth: "Other",
      primaryGoal: "stay_flexible",
      employerName: "Spotify",
      jobTitle: "Infrastructure Engineer",
      h1bStartDate: "2020-04-01",
      employerSize: "enterprise"
    }
  },

  // ==========================================
  // TIER: LATER (~12 leads, > 90 days)
  // ==========================================
  {
    fullName: "Rohan Mukherjee",
    email: "rohan.m@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -30,
    statusEndOffset: 365, // 1 year out
    answers: {
      fullName: "Rohan Mukherjee",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "Microsoft",
      jobTitle: "Principal SRE",
      h1bStartDate: "2017-09-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2018-03-21",
      preferenceCategory: "EB-2",
      spouseVisaStatus: "H4 EAD"
    }
  },
  {
    fullName: "Xiaowei Zhang",
    email: "xiaowei.z@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -40,
    statusEndOffset: 240,
    answers: {
      fullName: "Xiaowei Zhang",
      visaType: "H-1B",
      countryOfBirth: "China",
      primaryGoal: "get_gc",
      employerName: "Apple",
      jobTitle: "Silicons Engineer",
      h1bStartDate: "2021-10-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2021-08-14",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Carlos Mendoza",
    email: "carlos.m@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -45,
    statusEndOffset: 450,
    answers: {
      fullName: "Carlos Mendoza",
      visaType: "TN",
      countryOfBirth: "Mexico",
      primaryGoal: "job_stability",
      employerName: "Intel Corp",
      jobTitle: "Process Engineer",
      employerSize: "enterprise",
      greenCardStage: "perm_certified",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Aditi Rao",
    email: "aditi.rao@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -28,
    statusEndOffset: 180,
    answers: {
      fullName: "Aditi Rao",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "Amazon AWS",
      jobTitle: "Senior Solutions Architect",
      h1bStartDate: "2019-11-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2019-10-05",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Marcus Weber",
    email: "marcus.w@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -50,
    statusEndOffset: 300,
    answers: {
      fullName: "Marcus Weber",
      visaType: "L-1A",
      countryOfBirth: "Other",
      primaryGoal: "get_gc",
      employerName: "Siemens Healthineers",
      jobTitle: "Director of Product",
      employerSize: "enterprise",
      greenCardStage: "i140_filed",
      preferenceCategory: "EB-1C"
    }
  },
  {
    fullName: "Anushka Sharma",
    email: "anushka.s@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -33,
    statusEndOffset: 500,
    answers: {
      fullName: "Anushka Sharma",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "Google",
      jobTitle: "Staff Software Engineer",
      h1bStartDate: "2018-05-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2017-12-10",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Tetsuya Sato",
    email: "tetsuya.s@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -15,
    statusEndOffset: 200,
    answers: {
      fullName: "Tetsuya Sato",
      visaType: "E-2",
      countryOfBirth: "Other",
      primaryGoal: "stay_flexible",
      employerName: "Tokyo Ramen Ventures",
      jobTitle: "Executive Managing Director",
      employerSize: "startup"
    }
  },
  {
    fullName: "Nandita Iyer",
    email: "nandita.i@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -60,
    statusEndOffset: 600,
    answers: {
      fullName: "Nandita Iyer",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "Cisco Systems",
      jobTitle: "Network Consulting Engineer",
      h1bStartDate: "2020-01-15",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2020-04-12",
      preferenceCategory: "EB-3"
    }
  },
  {
    fullName: "Oliver King",
    email: "oliver.k@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -35,
    statusEndOffset: 220,
    answers: {
      fullName: "Oliver King",
      visaType: "O-1A",
      countryOfBirth: "United Kingdom",
      primaryGoal: "explore_options",
      employerName: "Anthropic",
      jobTitle: "Alignment Researcher",
      employerSize: "mid-size",
      greenCardStage: "i140_filed",
      preferenceCategory: "EB-1A"
    }
  },
  {
    fullName: "Swati Patel",
    email: "swati.p@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -42,
    statusEndOffset: 400,
    answers: {
      fullName: "Swati Patel",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "job_stability",
      employerName: "ServiceNow",
      jobTitle: "QA Architect",
      h1bStartDate: "2019-10-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Boris Voronov",
    email: "boris.v@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -19,
    statusEndOffset: 150,
    answers: {
      fullName: "Boris Voronov",
      visaType: "H-1B",
      countryOfBirth: "Other",
      primaryGoal: "get_gc",
      employerName: "Databricks",
      jobTitle: "Core Engine Engineer",
      employerSize: "enterprise",
      greenCardStage: "perm_certified",
      preferenceCategory: "EB-2"
    }
  },
  {
    fullName: "Devika Sen",
    email: "devika.sen@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -55,
    statusEndOffset: 700,
    answers: {
      fullName: "Devika Sen",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "get_gc",
      employerName: "NVIDIA",
      jobTitle: "Senior ASIC Verification Engineer",
      h1bStartDate: "2016-08-01",
      employerSize: "enterprise",
      greenCardStage: "i140_approved",
      priorityDate: "2016-11-20",
      preferenceCategory: "EB-2"
    }
  },

  // ==========================================
  // TIER: UNKNOWN (~7 leads)
  // ==========================================
  {
    fullName: "Aarav Pillai",
    email: "aarav.p@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -1,
    answers: {
      fullName: "Aarav Pillai",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "not_sure",
      employerName: "Cognizant",
      jobTitle: "Software Developer",
      h1bStartDate: "2023-01-15",
      employerSize: "enterprise",
      greenCardStage: "not_started",
      preferenceCategory: "Not sure",
      statusEndUnknown: "yes" // Explicitly unknown
    }
  },
  {
    fullName: "Sunita Reddy",
    email: "sunita.r@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -10,
    answers: {
      fullName: "Sunita Reddy",
      visaType: "H-4",
      countryOfBirth: "India",
      primaryGoal: "explore_options",
      statusEndUnknown: "yes"
    }
  },
  {
    fullName: "Francois Mercier",
    email: "francois.m@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -4,
    answers: {
      fullName: "Francois Mercier",
      visaType: "J-1",
      countryOfBirth: "France",
      primaryGoal: "stay_flexible",
      employerName: "Harvard Medical School"
    }
  },
  {
    fullName: "Min-Soo Kim",
    email: "minsoo.kim@example.invalid",
    status: "signed_up",
    joinedOffsetDays: -8,
    answers: {}
  },
  {
    fullName: "Pooja Hegde",
    email: "pooja.h@example.invalid",
    status: "finished",
    isNew: true,
    joinedOffsetDays: -3,
    answers: {
      fullName: "Pooja Hegde",
      visaType: "H-1B",
      countryOfBirth: "India",
      primaryGoal: "job_stability",
      employerName: "Wipro",
      jobTitle: "Senior Analyst",
      h1bStartDate: "2022-09-01",
      statusEndUnknown: "yes"
    }
  },
  {
    fullName: "Kenji Takahashi",
    email: "kenji.t@example.invalid",
    status: "in_progress",
    joinedOffsetDays: -12,
    answers: {
      fullName: "Kenji Takahashi",
      visaType: "L-1B",
      countryOfBirth: "Other"
    }
  },
  {
    fullName: "Zhenyu Liu",
    email: "zhenyu.liu@example.invalid",
    status: "finished",
    isNew: false,
    joinedOffsetDays: -20,
    answers: {
      fullName: "Zhenyu Liu",
      visaType: "F-1 OPT",
      countryOfBirth: "China",
      primaryGoal: "get_gc",
      employerName: "ByteDance",
      jobTitle: "Product Specialist",
      statusEndUnknown: "yes"
    }
  },

  // ==========================================
  // STATUS: EMAIL SENT (~6 leads, haven't confirmed yet)
  // ==========================================
  {
    fullName: "",
    email: "sarah.jenkins@consulting-corp.invalid",
    status: "email_sent",
    joinedOffsetDays: undefined,
    answers: {}
  },
  {
    fullName: "",
    email: "mohammed.khalil@cloudarch.invalid",
    status: "email_sent",
    joinedOffsetDays: undefined,
    answers: {}
  },
  {
    fullName: "",
    email: "tatiana.smirnova@ai-startup.invalid",
    status: "email_sent",
    joinedOffsetDays: undefined,
    answers: {}
  },
  {
    fullName: "",
    email: "albert.e@quantum-labs.invalid",
    status: "email_sent",
    joinedOffsetDays: undefined,
    answers: {}
  },
  {
    fullName: "",
    email: "ji-hoon.lee@semiconductor-global.invalid",
    status: "email_sent",
    joinedOffsetDays: undefined,
    answers: {}
  },
  {
    fullName: "",
    email: "clara.schmidt@biotech-innovations.invalid",
    status: "email_sent",
    joinedOffsetDays: undefined,
    answers: {}
  }
];

function admin() {
  return createSupabaseAdminClient() as any;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function offsetDateIso(ref: Date, offsetDays?: number): string | undefined {
  if (offsetDays === undefined) return undefined;
  const d = new Date(ref.getTime() + offsetDays * DAY_MS);
  return d.toISOString().slice(0, 10);
}

function offsetTimestamp(ref: Date, offsetDays?: number): string | null {
  if (offsetDays === undefined) return null;
  return new Date(ref.getTime() + offsetDays * DAY_MS).toISOString();
}

export function buildDemoAnswers(template: DemoLeadTemplate, ref: Date): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = { ...template.answers };
  if (template.fullName && template.status !== "signed_up" && template.status !== "email_sent") {
    answers.fullName = template.fullName;
  }
  if (template.statusEndOffset !== undefined) answers.statusEndDate = offsetDateIso(ref, template.statusEndOffset)!;
  if (template.lastWorkDayOffset !== undefined) answers.lastWorkDay = offsetDateIso(ref, template.lastWorkDayOffset)!;
  if (template.agencyDeadlineOffset !== undefined) answers.agencyDeadlineDate = offsetDateIso(ref, template.agencyDeadlineOffset)!;
  if (template.travelOffset !== undefined) answers.travelDate = offsetDateIso(ref, template.travelOffset)!;
  return answers;
}

/**
 * Seeds or re-seeds 50 demo client records for a demo firm.
 * Must be strictly scoped by firmId. Asserts that the firm is marked is_demo = true.
 */
export async function seedDemoFirm(
  firmId: string,
  refDate: Date = new Date(),
  showcaseUserMap?: Map<string, string>
): Promise<{ count: number }> {
  // Confirm firm exists and is marked is_demo
  const { data: firm, error: firmError } = await admin()
    .from("firms")
    .select("id, is_demo")
    .eq("id", firmId)
    .maybeSingle();

  if (firmError) throw new Error(`Could not verify firm: ${firmError.message}`);
  if (!firm) throw new Error(`Firm not found: ${firmId}`);
  if (!firm.is_demo) throw new Error(`Refusing to seed demo data on non-demo firm: ${firmId}`);

  // Ensure demo firm has default required documents configured
  await admin()
    .from("firms")
    .update({ required_documents: getDefaultRequiredDocuments() })
    .eq("id", firmId);

  // Fetch existing firm_clients for this firm to preserve showcase user_ids and link_id
  const { data: existingRows, error: fetchError } = await admin()
    .from("firm_clients")
    .select("id, normalized_email, user_id, link_id")
    .eq("firm_id", firmId);

  if (fetchError) throw new Error(`Could not fetch firm clients: ${fetchError.message}`);

  const existingByEmail = new Map<string, { id: string; user_id: string | null; link_id: string | null }>();
  for (const r of existingRows ?? []) {
    existingByEmail.set(r.normalized_email.toLowerCase(), r);
  }

  // Delete clients of this firm that are not part of the demo dataset
  const demoEmails = new Set(DEMO_LEAD_TEMPLATES.map((t) => t.email.toLowerCase()));
  const extraIds = (existingRows ?? [])
    .filter((r: any) => !demoEmails.has(r.normalized_email.toLowerCase()))
    .map((r: any) => r.id);

  if (extraIds.length > 0) {
    const { error: deleteError } = await admin().from("firm_clients").delete().eq("firm_id", firmId).in("id", extraIds);
    if (deleteError) throw new Error(`Could not delete obsolete demo clients: ${deleteError.message}`);
  }

  const nowIso = refDate.toISOString();

  // Upsert all 50 demo leads
  for (const t of DEMO_LEAD_TEMPLATES) {
    const email = t.email.toLowerCase();
    const existing = existingByEmail.get(email);
    const answers = buildDemoAnswers(t, refDate);
    const joinedAt = t.status === "email_sent" ? null : offsetTimestamp(refDate, t.joinedOffsetDays ?? -5);
    const completedAt = t.status === "finished" ? offsetTimestamp(refDate, (t.joinedOffsetDays ?? -5) + 1) : null;
    const reviewedAt = t.status === "finished" && !t.isNew ? offsetTimestamp(refDate, (t.joinedOffsetDays ?? -5) + 2) : null;

    const userId = showcaseUserMap?.get(email) ?? existing?.user_id ?? null;

    const row = {
      firm_id: firmId,
      normalized_email: email,
      user_id: userId,
      link_id: existing?.link_id ?? null,
      email_sent_at: offsetTimestamp(refDate, (t.joinedOffsetDays ?? -5) - 1) ?? nowIso,
      consented_at: offsetTimestamp(refDate, t.joinedOffsetDays ?? -5) ?? nowIso,
      joined_at: joinedAt,
      completed_at: completedAt,
      reviewed_at: reviewedAt,
      shared_answers: answers
    };

    if (existing?.id) {
      const { error: updateError } = await admin().from("firm_clients").update(row).eq("firm_id", firmId).eq("id", existing.id);
      if (updateError) throw new Error(`Could not update demo client ${email}: ${updateError.message}`);
    } else {
      const { error: insertError } = await admin().from("firm_clients").insert(row);
      if (insertError) throw new Error(`Could not insert demo client ${email}: ${insertError.message}`);
    }
  }

  return { count: DEMO_LEAD_TEMPLATES.length };
}

export function toProfileVisaType(visa: unknown): "OPT" | "STEM OPT" | "H1B" | "H4" | "O-1" | "GC" | "Citizen" {
  if (typeof visa !== "string") return "H1B";
  const normalized = visa.trim().toUpperCase();
  if (normalized.includes("STEM")) return "STEM OPT";
  if (normalized.includes("OPT")) return "OPT";
  if (normalized.includes("H-1B") || normalized.includes("H1B")) return "H1B";
  if (normalized.includes("H-4") || normalized.includes("H4")) return "H4";
  if (normalized.includes("O-1") || normalized.includes("O1")) return "O-1";
  if (normalized.includes("GC") || normalized.includes("GREEN CARD")) return "GC";
  if (normalized.includes("CITIZEN")) return "Citizen";
  return "H1B";
}

export function createSamplePdf(title: string, subtitle: string, detail: string): Buffer {
  const sanitize = (s: string) => s.replace(/[()\\]/g, "\\$&");
  const contentStream = [
    "BT",
    "/F1 16 Tf",
    "50 720 Td",
    `(${sanitize(title)}) Tj`,
    "/F1 12 Tf",
    "0 -28 Td",
    `(${sanitize(subtitle)}) Tj`,
    "/F1 10 Tf",
    "0 -22 Td",
    `(${sanitize(detail)}) Tj`,
    "ET"
  ].join("\n");

  const streamBytes = Buffer.from(contentStream, "utf-8");
  const streamLength = streamBytes.length;

  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n";
  const obj2 = "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n";
  const obj3 = "3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 5 0 R>>>> /Contents 4 0 R>>\nendobj\n";
  const obj4Start = `4 0 obj\n<</Length ${streamLength}>>\nstream\n`;
  const obj4End = "\nendstream\nendobj\n";
  const obj5 = "5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n";

  let offset = Buffer.byteLength(header, "utf-8");
  const o1 = offset;
  offset += Buffer.byteLength(obj1, "utf-8");
  const o2 = offset;
  offset += Buffer.byteLength(obj2, "utf-8");
  const o3 = offset;
  offset += Buffer.byteLength(obj3, "utf-8");
  const o4 = offset;
  offset += Buffer.byteLength(obj4Start, "utf-8") + streamLength + Buffer.byteLength(obj4End, "utf-8");
  const o5 = offset;
  offset += Buffer.byteLength(obj5, "utf-8");

  const xrefOffset = offset;
  const pad10 = (n: number) => n.toString().padStart(10, "0");
  const xref = [
    "xref\n",
    "0 6\n",
    "0000000000 65535 f \n",
    `${pad10(o1)} 00000 n \n`,
    `${pad10(o2)} 00000 n \n`,
    `${pad10(o3)} 00000 n \n`,
    `${pad10(o4)} 00000 n \n`,
    `${pad10(o5)} 00000 n \n`,
    "trailer\n",
    "<</Size 6 /Root 1 0 R>>\n",
    "startxref\n",
    `${xrefOffset}\n`,
    "%%EOF\n"
  ].join("");

  return Buffer.concat([
    Buffer.from(header, "utf-8"),
    Buffer.from(obj1, "utf-8"),
    Buffer.from(obj2, "utf-8"),
    Buffer.from(obj3, "utf-8"),
    Buffer.from(obj4Start, "utf-8"),
    streamBytes,
    Buffer.from(obj4End, "utf-8"),
    Buffer.from(obj5, "utf-8"),
    Buffer.from(xref, "utf-8")
  ]);
}

export type ShowcaseDocDef = {
  originalName: string;
  displayLabel: string;
  documentKind: string;
  mimeType: string;
  title: string;
  subtitle: string;
  detail: string;
};

export const SHOWCASE_DOCUMENTS: Record<number, ShowcaseDocDef[]> = {
  1: [
    {
      originalName: "I-797_H1B_Approval_Notice.pdf",
      displayLabel: "I-797 Approval Notice (H-1B)",
      documentKind: "h1b_approval",
      mimeType: "application/pdf",
      title: "UNITED STATES CITIZENSHIP AND IMMIGRATION SERVICES",
      subtitle: "FORM I-797: NOTICE OF ACTION - H-1B APPROVAL",
      detail: "Beneficiary: Arjun Menon | Class: H-1B Specialty Occupation"
    },
    {
      originalName: "I-140_Imm_Petition_Approval.pdf",
      displayLabel: "I-140 Approval Notice",
      documentKind: "i140_notice",
      mimeType: "application/pdf",
      title: "FORM I-140 IMMIGRANT PETITION APPROVAL NOTICE",
      subtitle: "Priority Date: Nov 3, 2021 | Preference Class: EB-2",
      detail: "Petitioner: Northwind Systems Inc. | Status: Approved"
    }
  ],
  2: [
    {
      originalName: "USCIS_Request_For_Evidence_O1.pdf",
      displayLabel: "USCIS RFE Notice",
      documentKind: "agency_notice",
      mimeType: "application/pdf",
      title: "USCIS REQUEST FOR EVIDENCE: FORM I-129 O-1A",
      subtitle: "Response Due Date: Dec 1, 2026",
      detail: "Petitioner: Apex AI Labs | Beneficiary: Elena Rostova"
    }
  ],
  3: [
    {
      originalName: "I-20_OPT_Recommendation.pdf",
      displayLabel: "Form I-20 with Post-OPT Endorsement",
      documentKind: "i20",
      mimeType: "application/pdf",
      title: "FORM I-20: CERTIFICATE OF ELIGIBILITY FOR F-1",
      subtitle: "Post-Completion OPT Authorization Endorsed",
      detail: "Student: Wei Chen | Degree: Master of Science"
    }
  ],
  4: [
    {
      originalName: "I-485_Interview_Notice.pdf",
      displayLabel: "I-485 Interview Notice",
      documentKind: "agency_notice",
      mimeType: "application/pdf",
      title: "USCIS INTERVIEW NOTICE: FORM I-485 APPLICATION",
      subtitle: "Appointment: San Jose Field Office",
      detail: "Applicant: Siddharth Verma | Section 245 Adjustment of Status"
    }
  ],
  5: [
    {
      originalName: "I-94_Most_Recent_Arrival_Record.pdf",
      displayLabel: "I-94 Arrival Record",
      documentKind: "i94",
      mimeType: "application/pdf",
      title: "U.S. CUSTOMS AND BORDER PROTECTION: FORM I-94",
      subtitle: "Class of Admission: H-1B Specialty Occupation",
      detail: "Admit Until Date: D/S | Traveler: Karthik Subramanian"
    }
  ],
  6: [
    {
      originalName: "I-797C_Receipt_Notice_Transfer.pdf",
      displayLabel: "I-797C Receipt Notice (Transfer)",
      documentKind: "h1b_approval",
      mimeType: "application/pdf",
      title: "FORM I-797C NOTICE OF ACTION: RECEIPT NOTICE",
      subtitle: "Case Type: I-129 H-1B Change of Employer",
      detail: "Received Date: Oct 15, 2026 | Receipt Number: WAC2690012345"
    }
  ],
  7: [
    {
      originalName: "LCA_Certified_Form_ETA_9035.pdf",
      displayLabel: "Certified LCA (Labor Condition Application)",
      documentKind: "lca",
      mimeType: "application/pdf",
      title: "U.S. DEPARTMENT OF LABOR: FORM ETA-9035E CERTIFIED",
      subtitle: "Occupational Title: Engineering Manager | SOC Code: 11-9041",
      detail: "Wage Rate: $185,000/year | Period of Employment: 3 Years"
    }
  ],
  8: [
    {
      originalName: "STEM_OPT_Employment_Authorization_Doc.pdf",
      displayLabel: "Form I-766 (EAD Card Copy)",
      documentKind: "ead",
      mimeType: "application/pdf",
      title: "EMPLOYMENT AUTHORIZATION DOCUMENT: FORM I-766",
      subtitle: "Category: C03C STEM OPT 24-Month Extension",
      detail: "Card Number: SRC9988776655 | Valid Through: Oct 2027"
    }
  ]
};

/**
 * Ensures demo auth users and showcase documents in haven-vault exist.
 * Returns a map of email -> userId.
 */
export async function provisionShowcaseUsersAndDocs(): Promise<Map<string, string>> {
  const emailToUserId = new Map<string, string>();
  const showcaseTemplates = DEMO_LEAD_TEMPLATES.filter((t) => t.showcaseIndex !== undefined);

  for (const t of showcaseTemplates) {
    const email = t.email.toLowerCase();
    // 1. Find or create auth user
    let userId: string | null = null;
    const { data: usersData, error: listUsersError } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listUsersError) {
      console.error(`[demo] failed to list auth users:`, listUsersError.message);
    }
    const match = usersData?.users?.find((u: any) => u.email?.toLowerCase() === email);
    if (match) {
      userId = match.id;
    } else {
      const { data: created, error } = await admin().auth.admin.createUser({
        email,
        password: "DemoUserSecurePass123!",
        email_confirm: true,
        user_metadata: { full_name: t.fullName }
      });
      if (error) {
        console.error(`[demo] failed to create demo auth user ${email}:`, error.message);
        continue;
      }
      userId = created.user.id;
    }

    if (!userId) continue;
    emailToUserId.set(email, userId);

    // 2. Ensure stub user_profiles row with valid enum visa_type
    const { error: profileError } = await admin().from("user_profiles").upsert({
      id: userId,
      full_name: t.fullName,
      email,
      visa_type: toProfileVisaType(t.answers.visaType),
      country_of_birth: (t.answers.countryOfBirth as string) ?? "India",
      perm_stage: "not_started",
      preference_category: "Not sure",
      i485_filed: false,
      i140_approved: false,
      employment_status: "employed",
      spouse_visa_status: "none",
      primary_goal: "not_sure",
      top_concerns: []
    });

    if (profileError) {
      console.error(`[demo] failed to upsert profile for ${email}:`, profileError.message);
    }

    // 3. Provision sample documents in haven-vault & user_documents
    const docs = SHOWCASE_DOCUMENTS[t.showcaseIndex!];
    if (docs?.length) {
      for (const d of docs) {
        const storagePath = `${userId}/demo/${d.originalName}`;
        const pdfBytes = createSamplePdf(d.title, d.subtitle, d.detail);

        // Upload to storage bucket
        const { error: uploadError } = await admin().storage.from("haven-vault").upload(storagePath, pdfBytes, {
          contentType: d.mimeType,
          upsert: true
        });
        if (uploadError) {
          console.error(`[demo] failed to upload sample doc ${storagePath}:`, uploadError.message);
        }

        // Upsert user_documents metadata
        const { data: existingDoc, error: docSelectError } = await admin()
          .from("user_documents")
          .select("id")
          .eq("user_id", userId)
          .eq("storage_path", storagePath)
          .maybeSingle();

        if (docSelectError) {
          console.error(`[demo] failed to select doc ${storagePath}:`, docSelectError.message);
        }

        if (!existingDoc) {
          const { error: insertDocError } = await admin().from("user_documents").insert({
            user_id: userId,
            storage_path: storagePath,
            original_name: d.originalName,
            display_label: d.displayLabel,
            document_kind: d.documentKind,
            source_kind: "manual_upload",
            file_size_bytes: pdfBytes.length,
            mime_type: d.mimeType,
            crisis_critical: false
          });
          if (insertDocError) {
            console.error(`[demo] failed to insert user_documents row for ${storagePath}:`, insertDocError.message);
          }
        }
      }
    }
  }

  return emailToUserId;
}

/**
 * Re-anchors all demo dates relative to current time and restores unreviewed New badges.
 */
export async function resetDemoFirm(firmId: string, refDate: Date = new Date()): Promise<{ count: number }> {
  return seedDemoFirm(firmId, refDate);
}

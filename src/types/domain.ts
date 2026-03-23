export type VisaType = "OPT" | "STEM OPT" | "H1B" | "H4" | "O-1" | "GC" | "Citizen";
export type PermStage = "not_started" | "in_progress" | "certified" | "denied";
export type GreenCardStage = "not_started" | "perm_in_progress" | "perm_certified" | "i140_filed" | "i140_approved" | "i485_filed";
export type PreferenceCategory = "EB-1" | "EB-2" | "EB-3" | "EB-2 NIW" | "Not sure";
export type EmploymentStatus = "employed" | "actively_searching" | "laid_off";
export type SpouseVisaStatus = "none" | "H1B" | "H4" | "H4 EAD" | "GC" | "other";
export type PrimaryGoal = "get_gc" | "job_stability" | "explore_options" | "stay_flexible" | "not_sure";
export type Concern = "layoffs" | "visa_expiry" | "gc_timeline" | "job_change" | "other";
export type ReadinessLevel = "high" | "medium" | "low";
export type TimelineEventGroup = "past" | "now" | "upcoming" | "future";
export type TimelineEventKind =
  | "h1b_cap"
  | "renewal_window"
  | "priority_date_current"
  | "i485_window"
  | "ac21_unlock"
  | "opt_expiry"
  | "stem_opt_window"
  | "visa_bulletin_update";
export type CommunitySpaceType = "cohort" | "war_room";
export type EmailSourceType =
  | "i797_notice"
  | "uscis_receipt"
  | "attorney_update"
  | "rfe_notice"
  | "employer_hr"
  | "priority_date_update";

export interface ImmigrationProfile {
  id: string;
  fullName: string;
  email: string;
  visaType: VisaType;
  countryOfBirth: string;
  currentVisaExpiryDate?: string;
  h1bStartDate?: string;
  permStage: PermStage;
  permFilingDate?: string;
  i140Approved: boolean;
  i140ApprovalDate?: string;
  priorityDate?: string;
  preferenceCategory: PreferenceCategory;
  i485Filed: boolean;
  employerName?: string;
  employerSize?: "startup" | "mid-size" | "enterprise";
  employerIndustry?: string;
  jobTitle?: string;
  employmentStatus: EmploymentStatus;
  spouseVisaStatus: SpouseVisaStatus;
  primaryGoal: PrimaryGoal;
  topConcerns: Concern[];
}

export interface DerivedProfileSignals {
  h1bCapDate?: string;
  daysUntilVisaExpiry?: number;
  visaBulletinPosition?: string;
  estimatedGreenCardDateRange?: string;
  ac21PortabilityStatus?: string;
  layoffReadinessScore: ReadinessLevel;
  layoffReadinessReasoning: string[];
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  prompt: string;
  valuePreview: string[];
}

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  group: TimelineEventGroup;
  title: string;
  dateLabel: string;
  nextAction: string;
  explanation: string;
  communityLinkLabel?: string;
}

export interface LayoffOption {
  id: string;
  title: string;
  fitScore: number;
  summary: string;
  whyItFits: string[];
  constraints: string[];
}

export interface LayoffChecklistItem {
  id: string;
  window: string;
  title: string;
  detail: string;
}

export interface LayoffPlannerResult {
  situationSummary: string;
  rankedOptions: LayoffOption[];
  checklist: LayoffChecklistItem[];
  communityContext: string;
  disclaimer: string;
}

export interface CommunityMember {
  id: string;
  label: string;
  visaType: VisaType;
  countryOfBirth: string;
  priorityDateRange?: string;
  topConcern: Concern;
}

export interface CommunityPost {
  id: string;
  spaceType: CommunitySpaceType;
  authorLabel: string;
  title: string;
  body: string;
  createdAt: string;
  tags: string[];
}

export interface CommunitySpace {
  id: string;
  type: CommunitySpaceType;
  name: string;
  summary: string;
  members: CommunityMember[];
  posts: CommunityPost[];
}

export interface EmailIngestRecord {
  id: string;
  alias: string;
  sourceType: EmailSourceType;
  subject: string;
  receivedAt: string;
  extractedFields: Array<{ label: string; value: string; confidence: "high" | "medium" | "low" }>;
  status: "pending_confirmation" | "accepted" | "rejected";
}

export interface DashboardSnapshot {
  nextActions: string[];
  communityMatchesLabel: string;
  timelineHighlights: TimelineEvent[];
  signals: DerivedProfileSignals;
}

export interface HavenWorkspaceSnapshot {
  profile: ImmigrationProfile;
  dashboard: DashboardSnapshot;
  onboardingSteps: OnboardingStep[];
  timelineEvents: TimelineEvent[];
  planner: LayoffPlannerResult;
  cohorts: CommunitySpace[];
  warRoom: CommunitySpace;
  emailInbox: EmailIngestRecord[];
}

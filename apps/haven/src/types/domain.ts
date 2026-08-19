export type VisaType = "OPT" | "STEM OPT" | "H1B" | "H4" | "O-1" | "GC" | "Citizen";
export type PermStage = "not_started" | "in_progress" | "certified" | "denied";
export type GreenCardStage = "not_started" | "perm_in_progress" | "perm_certified" | "i140_filed" | "i140_approved" | "i485_filed";
export type PreferenceCategory = "EB-1" | "EB-2" | "EB-3" | "EB-2 NIW" | "Not sure";
export type EmploymentStatus = "employed" | "actively_searching" | "laid_off";
export type SpouseVisaStatus = "none" | "H1B" | "H4" | "H4 EAD" | "GC" | "citizen" | "other";
export type PrimaryGoal = "get_gc" | "job_stability" | "explore_options" | "stay_flexible" | "not_sure";
export type Concern = "layoffs" | "visa_expiry" | "gc_timeline" | "job_change" | "other";
export type ReadinessLevel = "high" | "medium" | "low";
export type TimelineEventGroup = "past" | "now" | "upcoming" | "future";
export type AdvisorThreadStatus = "active" | "archived";
export type AdvisorMessageRole = "user" | "assistant" | "system";
export type AdvisorCitationKind = "external" | "haven" | "community";
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

export type ContactRole = "hr" | "lawyer" | "associated_company" | "uscis" | "recruiter" | "other";

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  hr: "HR",
  lawyer: "Lawyer / Attorney",
  associated_company: "Associated Company",
  uscis: "USCIS",
  recruiter: "Recruiter",
  other: "Other",
};

export interface EmailContact {
  id: string;
  email: string;
  name: string | null;
  role: ContactRole | null;
}
export type VaultDocumentKind =
  | "i140_notice"
  | "h1b_petition"
  | "perm_certification"
  | "passport_biographic_page"
  | "uscis_notice"
  | "paystub"
  | "visa_stamp"
  | "ead_card"
  | "attorney_letter"
  | "other";
export type VaultDocumentSource = "manual_upload" | "email_ingest";

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
  communityReplyEmailNotifications?: boolean;
  statusUpdateEmailNotifications?: boolean;
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

export type BulletinPreferenceCategory = "EB-1" | "EB-2" | "EB-3";
export type BulletinChargeability = "All Chargeability" | "China" | "India" | "Mexico" | "Philippines";

export interface PriorityDateHistoryPoint {
  label: string;
  cutoffLabel: string;
  cutoffDate?: string;
  cutoffTimestamp?: number;
}

export interface PriorityDateIntelligence {
  category: BulletinPreferenceCategory;
  country: BulletinChargeability;
  latestBulletinLabel: string;
  latestCutoffLabel: string;
  latestCutoffDate?: string;
  sourceUrl: string;
  sourcePulledAt?: string;
  /** Age of the newest held bulletin, measured from the first of its month. */
  bulletinAgeDays: number;
  /**
   * The bulletin feed has not delivered a recent bulletin. Every surface that
   * renders these figures must disclose it rather than presenting the numbers
   * as current — computed here so no consumer invents its own rule.
   */
  isStale: boolean;
  isCurrent: boolean;
  gapLabel?: string;
  estimateLabel?: string;
  estimateDetails?: string[];
  estimatedGreenCardDateRange?: string;
  velocityLabel?: string;
  visaBulletinPosition: string;
  historyPoints: PriorityDateHistoryPoint[];
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
  comments: CommunityPostComment[];
  id: string;
  spaceType: CommunitySpaceType;
  authorId: string | null;
  authorLabel: string;
  title: string;
  body: string;
  createdAt: string;
  tags: string[];
}

export interface CommunityPostComment {
  id: string;
  authorId: string | null;
  authorLabel: string;
  body: string;
  createdAt: string;
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
  senderEmail: string | null;
  senderName: string | null;
  bodyText: string | null;
  threadId: string | null;
  contact: EmailContact | null;
}

export interface EmailThread {
  id: string;
  threadKey: string;
  subject: string;
  lastEmailAt: string;
  emails: EmailIngestRecord[];
}

export interface UserDocument {
  id: string;
  displayLabel: string;
  documentKind: VaultDocumentKind;
  sourceKind: VaultDocumentSource;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  crisisCritical: boolean;
  notes?: string;
}

export interface DashboardSnapshot {
  nextActions: string[];
  communityMatchesLabel: string;
  timelineHighlights: TimelineEvent[];
  signals: DerivedProfileSignals;
}

/**
 * The open layoff on record, from `layoff_events`.
 *
 * Null when there is none. Carried on the snapshot rather than fetched where it
 * is needed, because the dashboard, the timeline and the Advisor must agree about
 * whether somebody is in their 60 days — two surfaces reading two sources is how
 * the profile and the answer end up describing different people.
 */
export interface ActiveLayoffEvent {
  /** Last day of employment. ISO date. */
  layoffDate: string;
  employerAtLayoff: string | null;
  visaTypeAtLayoff: string | null;
}

export interface HavenWorkspaceSnapshot {
  communityUnreadCount?: number;
  profile: ImmigrationProfile;
  activeLayoffEvent: ActiveLayoffEvent | null;
  dashboard: DashboardSnapshot;
  onboardingSteps: OnboardingStep[];
  timelineEvents: TimelineEvent[];
  planner: LayoffPlannerResult;
  cohorts: CommunitySpace[];
  warRoom: CommunitySpace;
  documents: UserDocument[];
  emailAlias: string | null;
  emailInbox: EmailIngestRecord[];
  emailThreads: EmailThread[];
  emailContacts: EmailContact[];
}

export interface KnowledgeSource {
  slug: string;
  label: string;
  agency: string;
  baseUrl: string;
  topic: string;
  trustPriority: number;
}

export interface KnowledgeChunk {
  id?: string;
  documentId?: string;
  chunkKey: string;
  chunkIndex: number;
  content: string;
  topic: string;
  title: string;
  url: string;
  agency: string;
  sourceSlug: string;
  similarity?: number;
}

export interface CommunityAdviceSummary {
  id?: string;
  title: string;
  topic: string;
  summary: string;
  legalCaveat: string;
  tags: string[];
  similarity?: number;
}

/**
 * Where an excerpt's words come from.
 *
 * `haven-summary` is Haven's own wording describing what a source says.
 * `verbatim` is the source's own text, copied exactly.
 *
 * The distinction has to be carried in the data rather than assumed by whoever
 * renders it. Every excerpt Haven currently produces is a summary — the corpus
 * chunks read "USCIS frames H-1B as..." — and they were displayed under the
 * agency's name, beside a link to that agency, with no indication they were not
 * the agency's words. A user forwarding one to their attorney reasonably read it
 * as USCIS's own language, which quietly converts Haven's paraphrase into
 * government authority.
 */
export type AdvisorCitationAttribution = "verbatim" | "haven-summary";

export interface AdvisorCitation {
  kind: AdvisorCitationKind;
  label: string;
  url?: string;
  /**
   * The displayed text. Deliberately not called `quote`: it is only a quotation
   * when `attribution` is `verbatim`, and naming it `quote` is what made it look
   * safe to render as one.
   */
  excerpt?: string;
  attribution?: AdvisorCitationAttribution;
  citationIndex: number;
}

export interface AdvisorAnswerPayload {
  answer_markdown: string;
  confidence: "low" | "medium" | "high";
  disclaimer: string;
  external_citations: AdvisorCitation[];
  haven_context_used: string[];
  community_context_used: string[];
  follow_up_questions: string[];
  refusal_or_escalation_reason?: string;
}

export interface AdvisorMessage {
  id: string;
  threadId: string;
  role: AdvisorMessageRole;
  content: string;
  createdAt: string;
  traceId?: string;
  answerPayload?: AdvisorAnswerPayload;
}

export interface AdvisorThread {
  id: string;
  title: string;
  status: AdvisorThreadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdvisorUserContext {
  profileSummary: string[];
  /**
   * Where the person is in their 60 days, computed from the layoff date on file.
   *
   * Separate from `timelineSummary` because it is arithmetic rather than a list of
   * stored milestones, and because it is the single fact that changes the most
   * answers — burying it among four timeline entries is how it gets skimmed.
   */
  gracePeriodSummary: string[];
  timelineSummary: string[];
  derivedSignalsSummary: string[];
  emailEvidenceSummary: string[];
  communitySummary: string[];
}

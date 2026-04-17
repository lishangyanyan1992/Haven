import { getPriorityDateIntelligence, getPriorityDateSignalOverrides } from "@/lib/priority-date-intelligence";
import type { HavenRepository } from "@/lib/repositories/contracts";
import { computeDerivedSignals, mergeSnapshotProfile } from "@/lib/haven";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommunityMember,
  CommunityPost,
  CommunitySpace,
  DerivedProfileSignals,
  EmailContact,
  EmailIngestRecord,
  EmailThread,
  HavenWorkspaceSnapshot,
  ImmigrationProfile,
  PriorityDateIntelligence,
  TimelineEvent,
  UserDocument
} from "@/types/domain";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
type DerivedSignalRow = Database["public"]["Tables"]["derived_signals"]["Row"];
type TimelineEventRow = Database["public"]["Tables"]["timeline_events"]["Row"];
type CommunitySpaceRow = Database["public"]["Tables"]["community_spaces"]["Row"];
type CommunityMembershipRow = Database["public"]["Tables"]["community_memberships"]["Row"];
type CommunityPostRow = Database["public"]["Tables"]["community_posts"]["Row"];
type EmailAliasRow = Database["public"]["Tables"]["email_aliases"]["Row"];
type EmailRecordRow = Database["public"]["Tables"]["email_ingest_records"]["Row"];
type EmailFieldRow = Database["public"]["Tables"]["email_extracted_fields"]["Row"];
type EmailContactRow = Database["public"]["Tables"]["email_contacts"]["Row"];
type EmailThreadRow = Database["public"]["Tables"]["email_threads"]["Row"];
type DocumentRow = Database["public"]["Tables"]["user_documents"]["Row"];
type SnapshotContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string | null;
  snapshot: HavenWorkspaceSnapshot;
  priorityDateIntelligence: PriorityDateIntelligence | null;
};

function mapProfileRow(row: ProfileRow): ImmigrationProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    visaType: row.visa_type as ImmigrationProfile["visaType"],
    countryOfBirth: row.country_of_birth,
    currentVisaExpiryDate: row.current_visa_expiry_date ?? undefined,
    h1bStartDate: row.h1b_start_date ?? undefined,
    permStage: row.perm_stage as ImmigrationProfile["permStage"],
    permFilingDate: row.perm_filing_date ?? undefined,
    i140Approved: row.i140_approved,
    i140ApprovalDate: row.i140_approval_date ?? undefined,
    priorityDate: row.priority_date ?? undefined,
    preferenceCategory: row.preference_category as ImmigrationProfile["preferenceCategory"],
    i485Filed: row.i485_filed,
    employerName: row.employer_name ?? undefined,
    employerSize: (row.employer_size as ImmigrationProfile["employerSize"] | null) ?? undefined,
    employerIndustry: row.employer_industry ?? undefined,
    jobTitle: row.job_title ?? undefined,
    employmentStatus: row.employment_status as ImmigrationProfile["employmentStatus"],
    spouseVisaStatus: row.spouse_visa_status as ImmigrationProfile["spouseVisaStatus"],
    primaryGoal: row.primary_goal as ImmigrationProfile["primaryGoal"],
    topConcerns: row.top_concerns as ImmigrationProfile["topConcerns"],
    communityReplyEmailNotifications: row.community_reply_email_notifications,
    statusUpdateEmailNotifications: row.status_update_email_notifications
  };
}

function mapDerivedSignals(
  row: DerivedSignalRow,
  profile: ImmigrationProfile,
  priorityDateSignals?: Pick<DerivedProfileSignals, "visaBulletinPosition" | "estimatedGreenCardDateRange"> | null
): DerivedProfileSignals {
  const fallback = computeDerivedSignals(profile, priorityDateSignals);

  return {
    h1bCapDate: row.h1b_cap_date ?? fallback.h1bCapDate,
    daysUntilVisaExpiry: row.days_until_visa_expiry ?? fallback.daysUntilVisaExpiry,
    visaBulletinPosition: priorityDateSignals?.visaBulletinPosition ?? row.visa_bulletin_position ?? fallback.visaBulletinPosition,
    estimatedGreenCardDateRange:
      priorityDateSignals?.estimatedGreenCardDateRange ?? row.estimated_gc_date_range ?? fallback.estimatedGreenCardDateRange,
    ac21PortabilityStatus: row.ac21_portability_status ?? fallback.ac21PortabilityStatus,
    layoffReadinessScore: row.layoff_readiness_score as DerivedProfileSignals["layoffReadinessScore"],
    layoffReadinessReasoning: row.layoff_readiness_reasoning
  };
}

function mapTimelineEvent(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    kind: row.event_kind as TimelineEvent["kind"],
    group: row.event_group as TimelineEvent["group"],
    title: row.title,
    dateLabel: row.date_label,
    nextAction: row.next_action,
    explanation: row.explanation,
    communityLinkLabel: row.community_link_label ?? undefined
  };
}

function mapCommunityMembers(rows: CommunityMembershipRow[], profile: ImmigrationProfile): CommunityMember[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.anonymized_label,
    visaType: profile.visaType,
    countryOfBirth: profile.countryOfBirth,
    priorityDateRange: row.priority_date_range ?? undefined,
    topConcern: row.top_concern as CommunityMember["topConcern"]
  }));
}

function mapCommunityPosts(rows: CommunityPostRow[]): CommunityPost[] {
  return rows.map((row) => ({
    id: row.id,
    spaceType: "cohort",
    authorLabel: row.author_label,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    tags: row.tags
  }));
}

function buildCommunitySpaces(
  spaces: CommunitySpaceRow[],
  memberships: CommunityMembershipRow[],
  posts: CommunityPostRow[],
  profile: ImmigrationProfile
) {
  const communitySpaces: CommunitySpace[] = spaces.map((space) => ({
    id: space.id,
    type: space.space_type as CommunitySpace["type"],
    name: space.name,
    summary: space.summary,
    members: mapCommunityMembers(
      memberships.filter((membership) => membership.space_id === space.id),
      profile
    ),
    posts: mapCommunityPosts(posts.filter((post) => post.space_id === space.id)).map((post) => ({
      ...post,
      spaceType: space.space_type as CommunityPost["spaceType"]
    }))
  }));

  const cohorts = communitySpaces.filter((space) => space.type === "cohort");
  const warRoom =
    communitySpaces.find((space) => space.type === "war_room") ??
    havenSnapshot.warRoom;

  return { cohorts, warRoom };
}

function buildEmailContacts(rows: EmailContactRow[]): EmailContact[] {
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    role: (row.role as EmailContact["role"]) ?? null
  }));
}

function buildEmailInbox(
  aliasRow: EmailAliasRow | null,
  records: EmailRecordRow[],
  fields: EmailFieldRow[],
  contacts: EmailContact[]
): EmailIngestRecord[] {
  // No real alias yet — show demo records so the page isn't empty for new users
  if (!aliasRow) {
    return havenSnapshot.emailInbox;
  }

  const contactById = new Map(contacts.map((c) => [c.id, c]));

  // Real alias exists — return real records only (may be empty; never mix with mock)
  return records.map((record) => ({
    id: record.id,
    alias: aliasRow.alias,
    sourceType: record.source_type as EmailIngestRecord["sourceType"],
    subject: record.subject,
    receivedAt: record.received_at,
    status: record.status as EmailIngestRecord["status"],
    senderEmail: record.sender_email ?? null,
    senderName: record.sender_name ?? null,
    bodyText: record.body_text ?? null,
    threadId: record.thread_id ?? null,
    contact: record.contact_id ? (contactById.get(record.contact_id) ?? null) : null,
    extractedFields: fields
      .filter((field) => field.record_id === record.id)
      .map((field) => ({
        label: field.label,
        value: field.value,
        confidence: field.confidence as "high" | "medium" | "low"
      }))
  }));
}

function buildEmailThreads(
  threadRows: EmailThreadRow[],
  inbox: EmailIngestRecord[]
): EmailThread[] {
  return threadRows.map((thread) => ({
    id: thread.id,
    threadKey: thread.thread_key,
    subject: thread.subject,
    lastEmailAt: thread.last_email_at,
    emails: inbox.filter((e) => e.threadId === thread.id)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
  })).sort((a, b) => new Date(b.lastEmailAt).getTime() - new Date(a.lastEmailAt).getTime());
}

function buildDocuments(rows: DocumentRow[]): UserDocument[] {
  return rows.map((row) => ({
    id: row.id,
    displayLabel: row.display_label,
    documentKind: row.document_kind as UserDocument["documentKind"],
    sourceKind: row.source_kind as UserDocument["sourceKind"],
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    uploadedAt: row.uploaded_at,
    crisisCritical: row.crisis_critical,
    notes: row.notes ?? undefined
  }));
}

function buildShellSnapshot(snapshot: HavenWorkspaceSnapshot) {
  return {
    profile: snapshot.profile,
    dashboard: snapshot.dashboard
  };
}

async function buildSnapshotContext(): Promise<SnapshotContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      userId: null,
      snapshot: havenSnapshot,
      priorityDateIntelligence: null
    };
  }

  const [{ data: profileRow }, { data: derivedSignalRow }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("derived_signals").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  if (!profileRow) {
    return {
      supabase,
      userId: user.id,
      snapshot: havenSnapshot,
      priorityDateIntelligence: null
    };
  }

  const profile = mapProfileRow(profileRow);
  const priorityDateIntelligence = await getPriorityDateIntelligence(profile);
  const priorityDateSignals = getPriorityDateSignalOverrides(priorityDateIntelligence);
  let snapshot = mergeSnapshotProfile(havenSnapshot, profile, priorityDateSignals);

  if (derivedSignalRow) {
    const mappedSignals = mapDerivedSignals(derivedSignalRow, profile, priorityDateSignals);
    snapshot = {
      ...snapshot,
      dashboard: {
        ...snapshot.dashboard,
        signals: mappedSignals
      }
    };
  }

  return {
    supabase,
    userId: user.id,
    snapshot,
    priorityDateIntelligence
  };
}

async function applyTimelineData(context: SnapshotContext, limit?: number) {
  if (!context.userId) {
    return context.snapshot;
  }

  let query = context.supabase
    .from("timeline_events")
    .select("*")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: true });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data: timelineRows } = await query;
  if (!timelineRows || timelineRows.length === 0) {
    return context.snapshot;
  }

  const timelineEvents = timelineRows.map(mapTimelineEvent);
  return {
    ...context.snapshot,
    dashboard: {
      ...context.snapshot.dashboard,
      timelineHighlights: timelineEvents.slice(0, 2)
    },
    ...(typeof limit === "number" ? null : { timelineEvents })
  };
}

async function loadCommunitySnapshot(
  context: SnapshotContext
): Promise<Pick<HavenWorkspaceSnapshot, "cohorts" | "warRoom">> {
  if (!context.userId) {
    return {
      cohorts: context.snapshot.cohorts,
      warRoom: context.snapshot.warRoom
    };
  }

  const [{ data: communitySpaceRows }, { data: membershipRows }, { data: postRows }] = await Promise.all([
    context.supabase.from("community_spaces").select("*"),
    context.supabase.from("community_memberships").select("*").eq("user_id", context.userId),
    context.supabase.from("community_posts").select("*")
  ]);

  if (!communitySpaceRows || !membershipRows || !postRows) {
    return {
      cohorts: context.snapshot.cohorts,
      warRoom: context.snapshot.warRoom
    };
  }

  const { cohorts, warRoom } = buildCommunitySpaces(
    communitySpaceRows,
    membershipRows,
    postRows,
    context.snapshot.profile
  );

  return {
    cohorts: cohorts.length > 0 ? cohorts : context.snapshot.cohorts,
    warRoom
  };
}

async function loadInboxSnapshot(
  context: SnapshotContext
): Promise<Pick<HavenWorkspaceSnapshot, "emailAlias" | "emailInbox" | "emailThreads" | "emailContacts" | "documents">> {
  if (!context.userId) {
    return {
      emailAlias: context.snapshot.emailAlias,
      emailInbox: context.snapshot.emailInbox,
      emailThreads: context.snapshot.emailThreads,
      emailContacts: context.snapshot.emailContacts,
      documents: context.snapshot.documents
    };
  }

  const [
    { data: aliasRow },
    { data: emailRows },
    { data: contactRows },
    { data: threadRows },
    { data: documentRows }
  ] = await Promise.all([
    context.supabase.from("email_aliases").select("*").eq("user_id", context.userId).maybeSingle(),
    context.supabase.from("email_ingest_records").select("*").eq("user_id", context.userId).order("received_at", { ascending: false }),
    context.supabase.from("email_contacts").select("*").eq("user_id", context.userId),
    context.supabase.from("email_threads").select("*").eq("user_id", context.userId).order("last_email_at", { ascending: false }),
    context.supabase.from("user_documents").select("*").eq("user_id", context.userId).order("uploaded_at", { ascending: false })
  ]);

  const recordIds = (emailRows ?? []).map((row) => row.id);
  const { data: fieldRows } = recordIds.length > 0
    ? await context.supabase.from("email_extracted_fields").select("*").in("record_id", recordIds)
    : { data: [] as EmailFieldRow[] };

  const contacts = buildEmailContacts(contactRows ?? []);
  const inbox = buildEmailInbox(aliasRow ?? null, emailRows ?? [], fieldRows ?? [], contacts);
  const threads = buildEmailThreads(threadRows ?? [], inbox);

  return {
    emailAlias: aliasRow?.alias ?? null,
    emailInbox: inbox,
    emailThreads: threads,
    emailContacts: contacts,
    documents: documentRows ? buildDocuments(documentRows) : context.snapshot.documents
  };
}

export async function getSupabaseShellSnapshot() {
  const context = await buildSnapshotContext();
  return buildShellSnapshot(context.snapshot);
}

export async function getSupabaseDashboardPageData() {
  const context = await buildSnapshotContext();
  const snapshot = await applyTimelineData(context, 2);

  return {
    ...buildShellSnapshot(snapshot),
    priorityDateIntelligence: context.priorityDateIntelligence
  };
}

export async function getSupabaseTimelinePageData() {
  const context = await buildSnapshotContext();
  const snapshot = await applyTimelineData(context);

  return {
    ...buildShellSnapshot(snapshot),
    timelineEvents: snapshot.timelineEvents
  };
}

export async function getSupabasePlannerPageData() {
  const context = await buildSnapshotContext();
  return {
    ...buildShellSnapshot(context.snapshot),
    planner: context.snapshot.planner
  };
}

export async function getSupabaseCommunityPageData() {
  const context = await buildSnapshotContext();
  const community = await loadCommunitySnapshot(context);

  return {
    ...buildShellSnapshot(context.snapshot),
    cohorts: community.cohorts
  };
}

export async function getSupabaseWarRoomPageData() {
  const context = await buildSnapshotContext();
  const community = await loadCommunitySnapshot(context);

  return {
    ...buildShellSnapshot(context.snapshot),
    warRoom: community.warRoom
  };
}

export async function getSupabaseInboxPageData() {
  const context = await buildSnapshotContext();
  const inbox = await loadInboxSnapshot(context);

  return {
    ...buildShellSnapshot(context.snapshot),
    ...inbox
  };
}

export const supabaseHavenRepository: HavenRepository = {
  async getSnapshot() {
    const context = await buildSnapshotContext();
    let snapshot = await applyTimelineData(context);
    const community = await loadCommunitySnapshot(context);
    const inbox = await loadInboxSnapshot(context);

    snapshot = {
      ...snapshot,
      cohorts: community.cohorts,
      warRoom: community.warRoom,
      ...inbox
    };

    return snapshot;
  }
};

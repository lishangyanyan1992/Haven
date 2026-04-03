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
  EmailIngestRecord,
  ImmigrationProfile,
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
type DocumentRow = Database["public"]["Tables"]["user_documents"]["Row"];

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
    topConcerns: row.top_concerns as ImmigrationProfile["topConcerns"]
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

function buildEmailInbox(aliasRow: EmailAliasRow | null, records: EmailRecordRow[], fields: EmailFieldRow[]): EmailIngestRecord[] {
  // No real alias yet — show demo records so the page isn't empty for new users
  if (!aliasRow) {
    return havenSnapshot.emailInbox;
  }

  // Real alias exists — return real records only (may be empty; never mix with mock)
  return records.map((record) => ({
    id: record.id,
    alias: aliasRow.alias,
    sourceType: record.source_type as EmailIngestRecord["sourceType"],
    subject: record.subject,
    receivedAt: record.received_at,
    status: record.status as EmailIngestRecord["status"],
    extractedFields: fields
      .filter((field) => field.record_id === record.id)
      .map((field) => ({
        label: field.label,
        value: field.value,
        confidence: field.confidence as "high" | "medium" | "low"
      }))
  }));
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

export const supabaseHavenRepository: HavenRepository = {
  async getSnapshot() {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return havenSnapshot;
    }

    const [
      { data: profileRow },
      { data: derivedSignalRow },
      { data: timelineRows },
      { data: communitySpaceRows },
      { data: membershipRows },
      { data: postRows },
      { data: aliasRow },
      { data: emailRows },
      { data: documentRows }
    ] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("derived_signals").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("timeline_events").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("community_spaces").select("*"),
      supabase.from("community_memberships").select("*").eq("user_id", user.id),
      supabase.from("community_posts").select("*"),
      supabase.from("email_aliases").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("email_ingest_records").select("*").eq("user_id", user.id).order("received_at", { ascending: false }),
      supabase.from("user_documents").select("*").eq("user_id", user.id).order("uploaded_at", { ascending: false })
    ]);

    if (!profileRow) {
      return havenSnapshot;
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

    if (timelineRows && timelineRows.length > 0) {
      const timelineEvents = timelineRows.map(mapTimelineEvent);
      snapshot = {
        ...snapshot,
        dashboard: {
          ...snapshot.dashboard,
          timelineHighlights: timelineEvents.slice(0, 2)
        },
        timelineEvents
      };
    }

    if (communitySpaceRows && membershipRows && postRows) {
      const { cohorts, warRoom } = buildCommunitySpaces(communitySpaceRows, membershipRows, postRows, profile);
      snapshot = {
        ...snapshot,
        cohorts: cohorts.length > 0 ? cohorts : snapshot.cohorts,
        warRoom
      };
    }

    if (emailRows) {
      const recordIds = emailRows.map((row) => row.id);
      const { data: fieldRows } = recordIds.length > 0
        ? await supabase.from("email_extracted_fields").select("*").in("record_id", recordIds)
        : { data: [] as EmailFieldRow[] };

      snapshot = {
        ...snapshot,
        emailAlias: aliasRow?.alias ?? null,
        emailInbox: buildEmailInbox(aliasRow ?? null, emailRows, fieldRows ?? [])
      };
    }

    if (documentRows) {
      snapshot = {
        ...snapshot,
        documents: buildDocuments(documentRows)
      };
    }

    return snapshot;
  }
};

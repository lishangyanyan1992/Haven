import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { readPublishDraft } from "@/lib/community-imports";
import { env } from "@/lib/env";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getCommunityPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { getStoryTraceUrl } from "@/lib/story-observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { AutoReviewQueueForm } from "./AutoReviewQueueForm";

export const metadata = noIndexMetadata;

type ReviewItem = {
  id: string;
  source: string;
  sourceStoryId: string;
  moderationStatus: string;
  moderationNotes: string | null;
  publishedPostId: string | null;
  traceUrl: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  title: string;
  publicAuthorLabel: string;
  publicAuthorKey: string;
};

function getAllowedReviewerEmails() {
  return new Set(
    (env.COMMUNITY_IMPORT_REVIEWER_EMAILS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

function hasReviewerAccess(email: string) {
  const allowedEmails = getAllowedReviewerEmails();
  return allowedEmails.size > 0 && allowedEmails.has(email);
}

function readObject(value: Json) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function mapReviewItem(row: any): ReviewItem {
  const draft = readPublishDraft(row.publish_draft, row.source_payload_private, row.source_story_id);
  return {
    id: row.id,
    source: row.source,
    sourceStoryId: row.source_story_id,
    moderationStatus: row.moderation_status,
    moderationNotes: row.moderation_notes,
    publishedPostId: row.published_post_id,
    traceUrl: getStoryTraceUrl(row.langfuse_trace_id),
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    title: draft.title,
    publicAuthorLabel: draft.publicAuthorLabel,
    publicAuthorKey: draft.publicAuthorKey
  };
}

function truncateIdentityKey(value: string, maxLength = 42) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function statusWeight(status: string) {
  switch (status) {
    case "pending": return 0;
    case "needs_revision": return 1;
    case "approved": return 2;
    case "rejected": return 3;
    default: return 4;
  }
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function statusBadgeVariant(status: string): "pending" | "active" | "urgent" | "community" {
  switch (status) {
    case "approved": return "active";
    case "rejected": return "urgent";
    case "needs_revision": return "community";
    default: return "pending";
  }
}

function isAutoApproved(item: ReviewItem) {
  return item.moderationStatus === "approved" && item.moderationNotes?.startsWith("Auto-approved.") === true;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "needs-review", label: "Needs Review" },
  { value: "ai-approved", label: "AI Approved" },
  { value: "live", label: "Live" },
  { value: "rejected", label: "Rejected" }
] as const;

type FilterValue = (typeof FILTER_OPTIONS)[number]["value"];

function applyFilter(items: ReviewItem[], filter: FilterValue): ReviewItem[] {
  switch (filter) {
    case "needs-review":
      return items.filter((i) => i.moderationStatus === "pending" || i.moderationStatus === "needs_revision");
    case "ai-approved":
      return items.filter(isAutoApproved);
    case "live":
      return items.filter((i) => i.publishedPostId !== null);
    case "rejected":
      return items.filter((i) => i.moderationStatus === "rejected");
    default:
      return items;
  }
}

export default async function CommunityImportsAdminPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter: FilterValue = FILTER_OPTIONS.some((o) => o.value === rawFilter)
    ? (rawFilter as FilterValue)
    : "all";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin/community-imports");
  }

  const email = user.email?.toLowerCase() ?? "";

  if (!hasReviewerAccess(email)) {
    redirect("/dashboard");
  }

  const [snapshot, crisisState] = await Promise.all([getCommunityPageData(), getCrisisState()]);
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("community_import_items")
    .select("*")
    .order("created_at", { ascending: false });

  const allItems = (rows ?? [])
    .map(mapReviewItem)
    .sort((a, b) => {
      const delta = statusWeight(a.moderationStatus) - statusWeight(b.moderationStatus);
      if (delta !== 0) return delta;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = {
    total: allItems.length,
    needsReview: allItems.filter((i) => i.moderationStatus === "pending" || i.moderationStatus === "needs_revision").length,
    autoApproved: allItems.filter(isAutoApproved).length,
    live: allItems.filter((i) => i.publishedPostId !== null).length,
    rejected: allItems.filter((i) => i.moderationStatus === "rejected").length
  };

  const visibleItems = applyFilter(allItems, filter);

  return (
    <AppShell activePath="/profile/community" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        {/* Header */}
        <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 md:p-8">
          <p className="text-label text-[var(--haven-sky-ink)]">Admin</p>
          <h1 className="text-h1 mt-2">Content review</h1>
          <p className="text-body mt-3 max-w-[65ch]">
            Review imported community stories. Approving publishes the rewritten draft; rejecting keeps it private.
          </p>
          <AutoReviewQueueForm />

          <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-5">
            <StatCard label="Total received" value={stats.total} />
            <StatCard label="Need my review" value={stats.needsReview} highlight={stats.needsReview > 0} />
            <StatCard label="AI auto-approved" value={stats.autoApproved} />
            <StatCard label="Live" value={stats.live} />
            <StatCard label="Rejected" value={stats.rejected} />
          </div>
        </section>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.value;
            return (
              <Link
                key={option.value}
                href={option.value === "all" ? "/admin/community-imports" : `/admin/community-imports?filter=${option.value}`}
                className={[
                  "rounded-full px-4 py-1.5 text-body-sm font-medium transition-colors",
                  isActive
                    ? "bg-[var(--haven-sky-ink)] text-[var(--haven-white)]"
                    : "border border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-sky-ink)] hover:bg-[var(--haven-sky-light)]"
                ].join(" ")}
              >
                {option.label}
                {option.value === "needs-review" && stats.needsReview > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--haven-blush-mid)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--haven-blush-ink)]">
                    {stats.needsReview}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Item table */}
        <Card>
          {visibleItems.length === 0 ? (
            <CardContent className="p-6">
              <p className="text-body-sm text-[var(--haven-sky-ink)]">No items in this category.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH className="w-36">Status</TH>
                    <TH className="w-28">Source</TH>
                    <TH className="w-32">Imported</TH>
                    <TH className="w-20" />
                  </TR>
                </THead>
                <TBody>
                  {visibleItems.map((item) => (
                    <TR key={item.id} className="group">
                      <TD>
                        <p className="font-medium leading-snug line-clamp-1">
                          {item.title || "Untitled draft"}
                        </p>
                        <p className="text-caption mt-0.5 text-[var(--haven-sky-ink)]">
                          {item.publicAuthorLabel}
                        </p>
                        <p className="text-caption mt-0.5 font-mono text-[var(--haven-sky-ink)]/80">
                          {truncateIdentityKey(item.publicAuthorKey)}
                        </p>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={statusBadgeVariant(item.moderationStatus)}>
                            {item.moderationStatus.replace("_", " ")}
                          </Badge>
                          {item.publishedPostId && <Badge variant="active">live</Badge>}
                          {item.traceUrl && <Badge variant="community">traced</Badge>}
                          {isAutoApproved(item) && (
                            <span className="text-caption text-[var(--haven-sage-strong)]">AI</span>
                          )}
                        </div>
                      </TD>
                      <TD className="text-caption text-[var(--haven-sky-ink)]">{item.source}</TD>
                      <TD className="text-caption text-[var(--haven-sky-ink)]">{formatDate(item.createdAt)}</TD>
                      <TD className="text-right">
                        <Link
                          href={`/admin/community-imports/${item.id}`}
                          className="text-body-sm text-[var(--haven-sky-ink)] opacity-50 transition-opacity hover:opacity-100 group-hover:opacity-100"
                        >
                          Review →
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  highlight
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[var(--radius-lg)] border p-4",
        highlight
          ? "border-[var(--haven-blush-mid)] bg-[var(--haven-blush-light)]"
          : "border-[var(--haven-sky-mid)] bg-[var(--haven-white)]"
      ].join(" ")}
    >
      <p className={["text-label", highlight ? "text-[var(--haven-blush-ink)]" : "text-[var(--haven-sky-ink)]"].join(" ")}>
        {label}
      </p>
      <p className="text-h3 mt-3">{value}</p>
    </div>
  );
}

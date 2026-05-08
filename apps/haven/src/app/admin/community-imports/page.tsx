import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readPublishDraft } from "@/lib/community-imports";
import { env } from "@/lib/env";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getCommunityPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { AutoReviewQueueForm } from "./AutoReviewQueueForm";
import { RawSourceDetails } from "./RawSourceDetails";
import { ReviewActionForm } from "./ReviewActionForm";

export const metadata = noIndexMetadata;

type ReviewItem = {
  id: string;
  source: string;
  sourceStoryId: string;
  moderationStatus: string;
  moderationNotes: string | null;
  publishedPostId: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  language: string | null;
  publishDraft: {
    publicAuthorLabel: string;
    title: string;
    body: string;
    tags: string[];
    comments: Array<{ authorLabel: string; body: string }>;
    publishReady: boolean;
    moderationFlags: string[];
    privacyFlags: string[];
  };
  privateSource: {
    title: string;
    body: string;
    sourceUrl: string;
    authorName: string;
    comments: string[];
  };
};

function getAllowedReviewerEmails() {
  return new Set(
    (env.COMMUNITY_IMPORT_REVIEWER_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function readObject(value: Json) {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function mapReviewItem(row: any): ReviewItem {
  const draft = readPublishDraft(row.publish_draft, row.source_payload_private);
  const privateSource = readObject(row.source_payload_private);

  return {
    id: row.id,
    source: row.source,
    sourceStoryId: row.source_story_id,
    moderationStatus: row.moderation_status,
    moderationNotes: row.moderation_notes,
    publishedPostId: row.published_post_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    language: row.language,
    publishDraft: {
      publicAuthorLabel: draft.publicAuthorLabel,
      title: draft.title,
      body: draft.body,
      tags: draft.tags,
      comments: draft.comments,
      publishReady: draft.publishReady,
      moderationFlags: draft.moderationFlags,
      privacyFlags: draft.privacyFlags
    },
    privateSource: {
      title: typeof privateSource.title === "string" ? privateSource.title : "",
      body: typeof privateSource.body === "string" ? privateSource.body : "",
      sourceUrl: typeof privateSource.source_url === "string" ? privateSource.source_url : "",
      authorName: typeof privateSource.author_name === "string" ? privateSource.author_name : "",
      comments: Array.isArray(privateSource.comments)
        ? privateSource.comments
            .map((comment) => {
              const commentRecord = typeof comment === "object" && comment !== null ? comment as Record<string, unknown> : null;
              return commentRecord && typeof commentRecord.body === "string" ? commentRecord.body : null;
            })
            .filter((comment): comment is string => Boolean(comment))
        : []
    }
  };
}

function statusWeight(status: string) {
  switch (status) {
    case "pending":
      return 0;
    case "needs_revision":
      return 1;
    case "approved":
      return 2;
    case "rejected":
      return 3;
    default:
      return 4;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function statusBadgeVariant(status: string): "pending" | "active" | "urgent" | "community" {
  switch (status) {
    case "approved":
      return "active";
    case "rejected":
      return "urgent";
    case "needs_revision":
      return "community";
    default:
      return "pending";
  }
}

export default async function CommunityImportsAdminPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/admin/community-imports");
  }

  const allowedEmails = getAllowedReviewerEmails();
  const email = user.email?.toLowerCase() ?? "";

  if (allowedEmails.size > 0 && !allowedEmails.has(email)) {
    redirect("/dashboard");
  }

  const [snapshot, crisisState] = await Promise.all([getCommunityPageData(), getCrisisState()]);
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("community_import_items")
    .select("*")
    .order("created_at", { ascending: false });

  const items = (rows ?? [])
    .map(mapReviewItem)
    .sort((left, right) => {
      const weightDelta = statusWeight(left.moderationStatus) - statusWeight(right.moderationStatus);
      if (weightDelta !== 0) {
        return weightDelta;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  const summary = {
    pending: items.filter((item) => item.moderationStatus === "pending").length,
    needsRevision: items.filter((item) => item.moderationStatus === "needs_revision").length,
    approved: items.filter((item) => item.moderationStatus === "approved").length,
    rejected: items.filter((item) => item.moderationStatus === "rejected").length
  };

  return (
    <AppShell activePath="/community" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 md:p-8">
          <p className="text-label text-[var(--haven-sky-ink)]">Community import review</p>
          <h1 className="text-h1 mt-4">Review imported stories before they go live.</h1>
          <p className="text-body mt-4 max-w-[70ch]">
            Approving publishes the rewritten draft into the main community forum. Rejecting keeps it private.
          </p>
          <AutoReviewQueueForm />

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <SummaryCard label="Pending" value={summary.pending} />
            <SummaryCard label="Needs revision" value={summary.needsRevision} />
            <SummaryCard label="Approved" value={summary.approved} />
            <SummaryCard label="Rejected" value={summary.rejected} />
          </div>
        </section>

        <div className="space-y-4">
          {items.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-body-sm">No imported stories yet.</p>
              </CardContent>
            </Card>
          ) : (
            items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariant(item.moderationStatus)}>{item.moderationStatus.replace("_", " ")}</Badge>
                      {!item.publishDraft.publishReady && <Badge variant="urgent">publish blocked</Badge>}
                      {item.publishedPostId && <Badge variant="active">live</Badge>}
                      <Badge variant="community">{item.publishDraft.publicAuthorLabel}</Badge>
                    </div>

                    <div>
                      <p className="text-label">{item.source} · {item.sourceStoryId}</p>
                      <CardTitle className="mt-2">{item.publishDraft.title || "Untitled draft"}</CardTitle>
                      <p className="text-caption mt-2">
                        Imported {formatDate(item.createdAt)}
                        {item.approvedAt ? ` · approved ${formatDate(item.approvedAt)}` : ""}
                        {item.rejectedAt ? ` · rejected ${formatDate(item.rejectedAt)}` : ""}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid gap-5 xl:grid-cols-2">
                    <section className="space-y-3">
                      <div>
                        <p className="text-label">Public draft</p>
                        <p className="text-body mt-2 whitespace-pre-wrap">{item.publishDraft.body || "No body generated."}</p>
                      </div>

                      {item.publishDraft.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.publishDraft.tags.map((tag) => (
                            <span key={tag} className="tag tag-community">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.publishDraft.comments.length > 0 && (
                        <div className="space-y-3 rounded-[var(--radius-lg)] bg-[var(--haven-cream)] p-4">
                          <p className="text-body-sm font-medium">Public comments</p>
                          {item.publishDraft.comments.map((comment, index) => (
                            <div key={`${comment.authorLabel}-${index}`} className="rounded-[var(--radius-md)] bg-[var(--haven-white)] p-3">
                              <p className="text-caption font-medium">{comment.authorLabel}</p>
                              <p className="text-body-sm mt-2 whitespace-pre-wrap">{comment.body}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {(item.publishDraft.moderationFlags.length > 0 || item.publishDraft.privacyFlags.length > 0) && (
                        <div className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
                          {item.publishDraft.moderationFlags.length > 0 && (
                            <p className="text-body-sm">
                              <span className="font-medium">Moderation flags:</span>{" "}
                              {item.publishDraft.moderationFlags.join(", ")}
                            </p>
                          )}
                          {item.publishDraft.privacyFlags.length > 0 && (
                            <p className="text-body-sm">
                              <span className="font-medium">Privacy flags:</span>{" "}
                              {item.publishDraft.privacyFlags.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                    </section>

                    <section className="space-y-3">
                      <p className="text-label">Private source view</p>
                      <RawSourceDetails
                        authorName={item.privateSource.authorName}
                        body={item.privateSource.body}
                        comments={item.privateSource.comments}
                        sourceUrl={item.privateSource.sourceUrl}
                        title={item.privateSource.title}
                      />
                    </section>
                  </div>

                  <ReviewActionForm
                    itemId={item.id}
                    moderationNotes={item.moderationNotes}
                    publishedPostId={item.publishedPostId}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-white)] p-4">
      <p className="text-label text-[var(--haven-sky-ink)]">{label}</p>
      <p className="text-h3 mt-3">{value}</p>
    </div>
  );
}

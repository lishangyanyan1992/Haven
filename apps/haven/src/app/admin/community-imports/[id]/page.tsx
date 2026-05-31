import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { readPublishDraft } from "@/lib/community-imports";
import { env } from "@/lib/env";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getCommunityPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { getStoryTraceUrl } from "@/lib/story-observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { RawSourceDetails } from "../RawSourceDetails";
import { ReviewActionForm } from "../ReviewActionForm";

export const metadata = noIndexMetadata;

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

function formatDate(value: string | null) {
  if (!value) return null;
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
    case "approved": return "active";
    case "rejected": return "urgent";
    case "needs_revision": return "community";
    default: return "pending";
  }
}

function truncateIdentityKey(value: string, maxLength = 72) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export default async function CommunityImportDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/admin/community-imports/${id}`);
  }

  const email = user.email?.toLowerCase() ?? "";

  if (!hasReviewerAccess(email)) {
    redirect("/dashboard");
  }

  const [snapshot, crisisState] = await Promise.all([getCommunityPageData(), getCrisisState()]);
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("community_import_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    notFound();
  }

  const draft = readPublishDraft(row.publish_draft, row.source_payload_private, row.source_story_id);
  const privateSource = readObject(row.source_payload_private as Json);
  const authorKeys = Array.from(new Set([draft.publicAuthorKey, ...draft.comments.map((comment) => comment.authorKey)]));
  const { data: authorRows } = authorKeys.length
    ? await admin
        .from("community_authors")
        .select("id, external_author_key, author_label")
        .eq("source", row.source)
        .in("external_author_key", authorKeys)
    : { data: [] };
  const authorByKey = new Map(
    (authorRows ?? [])
      .filter((author) => typeof author.external_author_key === "string")
      .map((author) => [author.external_author_key as string, { id: author.id, authorLabel: author.author_label }])
  );

  const item = {
    id: row.id,
    source: row.source,
    sourceStoryId: row.source_story_id,
    moderationStatus: row.moderation_status,
    moderationNotes: row.moderation_notes,
    publishedPostId: row.published_post_id,
    traceUrl: getStoryTraceUrl(row.langfuse_trace_id),
    traceId: row.langfuse_trace_id,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    language: row.language,
    publishDraft: {
      publicAuthorLabel: draft.publicAuthorLabel,
      publicAuthorKey: draft.publicAuthorKey,
      resolvedPublicAuthorId: authorByKey.get(draft.publicAuthorKey)?.id ?? null,
      title: draft.title,
      body: draft.body,
      tags: draft.tags,
      comments: draft.comments.map((comment) => ({
        ...comment,
        resolvedAuthorId: authorByKey.get(comment.authorKey)?.id ?? null
      })),
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
            .map((c) => {
              const r = typeof c === "object" && c !== null ? (c as Record<string, unknown>) : null;
              return r && typeof r.body === "string" ? r.body : null;
            })
            .filter((c): c is string => Boolean(c))
        : []
    }
  };

  return (
    <AppShell activePath="/community" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        {/* Back nav */}
        <Link
          className="text-body-sm text-[var(--haven-sky-ink)] hover:underline inline-flex items-center gap-1"
          href="/admin/community-imports"
        >
          ← Back to review dashboard
        </Link>

        {/* Header */}
        <div className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(item.moderationStatus)}>
                  {item.moderationStatus.replace("_", " ")}
                </Badge>
                {!item.publishDraft.publishReady && (
                  <Badge variant="urgent">publish blocked</Badge>
                )}
                {item.publishedPostId && <Badge variant="active">live</Badge>}
                {item.traceUrl && <Badge variant="community">traced</Badge>}
                <Badge variant="community">{item.publishDraft.publicAuthorLabel}</Badge>
              </div>
              <div>
                <p className="text-label text-[var(--haven-sky-ink)]">
                  {item.source} · {item.sourceStoryId}
                </p>
                <h1 className="text-h2 mt-2">{item.publishDraft.title || "Untitled draft"}</h1>
                <p className="text-caption mt-2">
                  Imported {formatDate(item.createdAt)}
                  {item.approvedAt ? ` · approved ${formatDate(item.approvedAt)}` : ""}
                  {item.rejectedAt ? ` · rejected ${formatDate(item.rejectedAt)}` : ""}
                  {item.language ? ` · ${item.language}` : ""}
                </p>
                {item.traceUrl ? (
                  <p className="text-caption mt-2">
                    <Link className="text-[var(--haven-sky-ink)] hover:underline" href={item.traceUrl} target="_blank">
                      Open Langfuse trace
                    </Link>
                    {item.traceId ? <span className="ml-2 font-mono">{truncateIdentityKey(item.traceId)}</span> : null}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Content columns */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Public draft */}
          <section className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
            <p className="text-label">Public draft</p>
            <div className="space-y-2 rounded-[var(--radius-lg)] bg-[var(--haven-sky-light)] p-4">
              <p className="text-body-sm font-medium">Author identity</p>
              <p className="text-body-sm">
                <span className="font-medium">Label:</span> {item.publishDraft.publicAuthorLabel}
              </p>
              <p className="text-body-sm font-mono break-all">
                <span className="font-sans font-medium">Key:</span> {truncateIdentityKey(item.publishDraft.publicAuthorKey)}
              </p>
              <p className="text-body-sm font-mono break-all">
                <span className="font-sans font-medium">Resolved author id:</span>{" "}
                {item.publishDraft.resolvedPublicAuthorId ?? "Will be created on publish"}
              </p>
            </div>
            <p className="text-body whitespace-pre-wrap">{item.publishDraft.body || "No body generated."}</p>

            {item.publishDraft.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.publishDraft.tags.map((tag) => (
                  <span key={tag} className="tag tag-community">{tag}</span>
                ))}
              </div>
            )}

            {item.publishDraft.comments.length > 0 && (
              <div className="space-y-3 rounded-[var(--radius-lg)] bg-[var(--haven-cream)] p-4">
                <p className="text-body-sm font-medium">Public comments</p>
                {item.publishDraft.comments.map((comment, index) => (
                  <div
                    key={`${comment.authorLabel}-${index}`}
                    className="rounded-[var(--radius-md)] bg-[var(--haven-white)] p-3"
                  >
                    <p className="text-caption font-medium">{comment.authorLabel}</p>
                    <p className="text-caption mt-1 font-mono break-all text-[var(--haven-sky-ink)]/80">
                      Key: {truncateIdentityKey(comment.authorKey)}
                    </p>
                    <p className="text-caption mt-1 font-mono break-all text-[var(--haven-sky-ink)]/80">
                      ID: {comment.resolvedAuthorId ?? "Will be created on publish"}
                    </p>
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

          {/* Private source */}
          <section className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
            <p className="text-label">Original post</p>
            <RawSourceDetails
              authorName={item.privateSource.authorName}
              body={item.privateSource.body}
              comments={item.privateSource.comments}
              sourceUrl={item.privateSource.sourceUrl}
              title={item.privateSource.title}
            />
          </section>
        </div>

        {/* Review actions */}
        <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
          <p className="text-label mb-4">Review actions</p>
          <ReviewActionForm
            itemId={item.id}
            moderationNotes={item.moderationNotes}
            publishedPostId={item.publishedPostId}
          />
        </div>
      </div>
    </AppShell>
  );
}

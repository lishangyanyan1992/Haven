import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getConfirmedCommunityLabels, sortCommunityLabels } from "@/lib/community-labels";
import type { CommunityPost, HavenWorkspaceSnapshot } from "@/types/domain";

export type CommunityData = Pick<HavenWorkspaceSnapshot, "cohorts" | "warRoom">;

function hashLabelToNumber(label: string) {
  return label.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1000, 0);
}

function formatCommunityAuthorLabel(label: string, fallbackSeed: string) {
  const explicitNumber = label.match(/\d+/)?.[0];
  const numeric = explicitNumber ? Number(explicitNumber) % 1000 : hashLabelToNumber(label || fallbackSeed);
  return `Haven_User_${String(numeric).padStart(3, "0")}`;
}

function getCommunityPosts(data: CommunityData) {
  return [...data.cohorts.flatMap((cohort) => cohort.posts), ...data.warRoom.posts]
    .map((post) => ({
      ...post,
      authorLabel: formatCommunityAuthorLabel(post.authorLabel, post.id),
      comments: post.comments.map((comment) => ({
        ...comment,
        authorLabel: formatCommunityAuthorLabel(comment.authorLabel, comment.id)
      })),
      confirmedLabels: getConfirmedCommunityLabels(post)
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function CommunityIntro() {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[70ch]">
          <p className="text-label text-[var(--haven-sky-ink)]">Community</p>
          <h1 className="text-h1 mt-4">A single forum, organized by confirmed case details.</h1>
          <p className="text-body mt-4">
            Sign in when you want to participate or ask Haven&apos;s AI expert about your own case context.
          </p>
        </div>
      </div>
    </section>
  );
}

export function CommunityFeed({
  basePath = "/community",
  data,
  selectedLabel
}: {
  basePath?: string;
  data: CommunityData;
  selectedLabel: string;
}) {
  const livePosts = getCommunityPosts(data);
  const filterLabels = [
    "All",
    ...sortCommunityLabels(Array.from(new Set(livePosts.flatMap((post) => post.confirmedLabels))))
  ];
  const visiblePosts =
    selectedLabel === "All" ? livePosts : livePosts.filter((post) => post.confirmedLabels.includes(selectedLabel));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {filterLabels.map((label) => (
          <Link
            key={label}
            className={selectedLabel === label ? "tag tag-community" : "tag tag-pending"}
            href={label === "All" ? basePath : `${basePath}?label=${encodeURIComponent(label)}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {visiblePosts.length > 0 ? (
          visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-body-sm">No posts match this filter yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function PostCard({
  post
}: {
  post: CommunityPost & {
    confirmedLabels: string[];
  };
}) {
  const publishedDate = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-md avatar-community">H</div>
          <div>
            <p className="text-h3">{post.authorLabel}</p>
            <p className="text-caption mt-1">Moderated post · {publishedDate}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.confirmedLabels.slice(0, 3).map((tag) => (
            <span key={tag} className="tag tag-community">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <h2 className="text-h2 mt-5">{post.title}</h2>
      <p className="text-body mt-3 whitespace-pre-wrap">{post.body}</p>

      {post.comments.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-label">Imported comments</p>
          {post.comments.map((comment) => (
            <div key={comment.id} className="rounded-[var(--radius-lg)] bg-[var(--haven-cream)] p-4">
              <p className="text-body-sm font-medium">{comment.authorLabel}</p>
              <p className="text-body-sm mt-2 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-2 text-body-sm text-[var(--color-text-secondary)]">
          <Users className="h-4 w-4" />
          Published through Haven moderation
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2 text-body-sm">
          Read-only for now
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

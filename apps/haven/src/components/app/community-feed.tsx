import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  getConfirmedCommunityLabels,
  scoreCommunityPostForProfile,
  sortCommunityLabels,
  type CommunityPostMatch
} from "@/lib/community-labels";
import type { CommunityPost, HavenWorkspaceSnapshot, ImmigrationProfile } from "@/types/domain";

export type CommunityData = Pick<HavenWorkspaceSnapshot, "cohorts" | "warRoom">;
export type CommunityFeedView = "for-you" | "latest" | "all";
export type CommunityFeedProfile = Pick<
  ImmigrationProfile,
  | "countryOfBirth"
  | "visaType"
  | "preferenceCategory"
  | "employmentStatus"
  | "permStage"
  | "i140Approved"
  | "i485Filed"
  | "primaryGoal"
  | "topConcerns"
>;
type EnrichedCommunityPost = CommunityPost & {
  confirmedLabels: string[];
  match: CommunityPostMatch;
};

const feedViews: Array<{ label: string; value: CommunityFeedView }> = [
  { label: "For you", value: "for-you" },
  { label: "Latest", value: "latest" },
  { label: "All posts", value: "all" }
];

function hashLabelToNumber(label: string) {
  return label.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 1000, 0);
}

function formatCommunityAuthorLabel(label: string, fallbackSeed: string) {
  const explicitNumber = label.match(/\d+/)?.[0];
  const numeric = explicitNumber ? Number(explicitNumber) % 1000 : hashLabelToNumber(label || fallbackSeed);
  return `Haven_User_${String(numeric).padStart(3, "0")}`;
}

function buildCommunityHref(
  basePath: string,
  params: {
    label?: string;
    view?: CommunityFeedView;
  }
) {
  const searchParams = new URLSearchParams();

  if (params.view) {
    searchParams.set("view", params.view);
  }

  if (params.label && params.label !== "All") {
    searchParams.set("label", params.label);
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function getCommunityPosts(data: CommunityData, profile?: CommunityFeedProfile): EnrichedCommunityPost[] {
  return [...data.cohorts.flatMap((cohort) => cohort.posts), ...data.warRoom.posts]
    .map((post) => {
      const confirmedLabels = getConfirmedCommunityLabels(post);

      return {
        ...post,
        authorLabel: formatCommunityAuthorLabel(post.authorLabel, post.id),
        comments: post.comments.map((comment) => ({
          ...comment,
          authorLabel: formatCommunityAuthorLabel(comment.authorLabel, comment.id)
        })),
        confirmedLabels,
        match: profile ? scoreCommunityPostForProfile(post, profile) : { reasons: [], score: 0 }
      };
    })
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
  profile,
  selectedLabel,
  selectedView = profile ? "for-you" : "all"
}: {
  basePath?: string;
  data: CommunityData;
  profile?: CommunityFeedProfile;
  selectedLabel: string;
  selectedView?: CommunityFeedView;
}) {
  const livePosts = getCommunityPosts(data, profile);
  const personalizedPosts = [...livePosts]
    .filter((post) => post.match.score > 0)
    .sort((left, right) => {
      const scoreDelta = right.match.score - left.match.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const rankedPosts =
    profile && selectedView === "for-you"
      ? (personalizedPosts.length > 0 ? personalizedPosts : livePosts.slice(0, 10))
      : selectedView === "latest"
        ? livePosts.slice(0, 20)
        : livePosts;
  const filterLabels = [
    "All",
    ...sortCommunityLabels(Array.from(new Set(livePosts.flatMap((post) => post.confirmedLabels))))
  ];
  const visiblePosts =
    selectedLabel === "All" ? rankedPosts : rankedPosts.filter((post) => post.confirmedLabels.includes(selectedLabel));

  return (
    <>
      {profile ? (
        <div className="flex flex-wrap gap-2">
          {feedViews.map((view) => (
            <Link
              key={view.value}
              className={selectedView === view.value ? "tag tag-community" : "tag tag-pending"}
              href={buildCommunityHref(basePath, { label: selectedLabel, view: view.value })}
            >
              {view.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {filterLabels.map((label) => (
          <Link
            key={label}
            className={selectedLabel === label ? "tag tag-community" : "tag tag-pending"}
            href={buildCommunityHref(basePath, { label, view: profile ? selectedView : undefined })}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {visiblePosts.length > 0 ? (
          visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} showMatchReason={Boolean(profile && selectedView === "for-you")} />
          ))
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
  post,
  showMatchReason
}: {
  post: EnrichedCommunityPost;
  showMatchReason: boolean;
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
      {showMatchReason && post.match.reasons.length > 0 ? (
        <p className="text-caption mt-2">Matches: {post.match.reasons.slice(0, 2).join(" · ")}</p>
      ) : null}
      <p className="text-body mt-3 whitespace-pre-wrap">{post.body}</p>

      {post.comments.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-label">Comments</p>
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

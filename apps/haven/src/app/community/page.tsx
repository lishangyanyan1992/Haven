import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole, MessageSquareQuote, Users } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { PublicNavbar } from "@/components/app/public-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getConfirmedCommunityLabels, sortCommunityLabels } from "@/lib/community-labels";
import { hasSupabaseEnv } from "@/lib/env";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getPublicCommunityPageData, getSnapshot } from "@/lib/repositories/case-compass";
import { absoluteUrl } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommunityPost, HavenWorkspaceSnapshot } from "@/types/domain";
import { CommunityComposer } from "./CommunityComposer";

export const metadata: Metadata = {
  title: "Haven Community",
  description:
    "Read moderated immigration community conversations organized by confirmed case details, including H-1B layoffs, grace periods, RFEs, and green card timing.",
  alternates: {
    canonical: "/community"
  },
  openGraph: {
    url: absoluteUrl("/community"),
    title: "Haven Community",
    description:
      "Read moderated immigration community conversations organized by confirmed case details, including H-1B layoffs, grace periods, RFEs, and green card timing."
  },
  twitter: {
    title: "Haven Community",
    description:
      "Read moderated immigration community conversations organized by confirmed case details, including H-1B layoffs, grace periods, RFEs, and green card timing."
  }
};

type CommunityPageProps = {
  searchParams?: Promise<{ label?: string }>;
};

type CommunityData = Pick<HavenWorkspaceSnapshot, "cohorts" | "warRoom">;

async function getCurrentUserId() {
  if (!hasSupabaseEnv) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return user?.id ?? null;
  } catch {
    return null;
  }
}

function getCommunityPosts(data: CommunityData) {
  return [...data.cohorts.flatMap((cohort) => cohort.posts), ...data.warRoom.posts]
    .map((post) => ({
      ...post,
      confirmedLabels: getConfirmedCommunityLabels(post)
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function CommunityIntro() {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[70ch]">
          <p className="text-label text-[var(--haven-sky-ink)]">Community</p>
          <h1 className="text-h1 mt-4">A single forum, organized by confirmed case details.</h1>
          <p className="text-body mt-4">
            Browse moderated immigration stories and replies before you create an account. Sign in when you want to
            participate or ask Haven&apos;s AI expert about your own case context.
          </p>
        </div>
      </div>
    </section>
  );
}

function PublicParticipationCta() {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h3">Sign in to post, reply, or ask Haven&apos;s AI expert.</p>
            <p className="text-body-sm mt-2 max-w-[68ch]">
              Reading the community is open. Participation and AI answers stay behind login so Haven can use your
              saved case details without exposing private timeline or document data.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className={buttonVariants({ variant: "default" })} href="/login?redirectTo=/community">
            <Users className="h-4 w-4" />
            Sign in to participate
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/login?redirectTo=/advisor">
            <MessageSquareQuote className="h-4 w-4" />
            Ask AI expert
          </Link>
        </div>
      </div>
    </section>
  );
}

function CommunityFeed({ data, selectedLabel }: { data: CommunityData; selectedLabel: string }) {
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
            href={label === "All" ? "/community" : `/community?label=${encodeURIComponent(label)}`}
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

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedLabel = resolvedSearchParams?.label?.trim() || "All";
  const userId = await getCurrentUserId();

  if (userId) {
    const [snapshot, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
    const { profile } = snapshot;

    return (
      <AppShell activePath="/community" crisisState={crisisState} snapshot={snapshot}>
        <div className="space-y-6">
          <CommunityIntro />

          <CommunityComposer
            profile={{
              visaType: profile.visaType,
              preferenceCategory: profile.preferenceCategory,
              countryOfBirth: profile.countryOfBirth
            }}
          />

          <CommunityFeed data={snapshot} selectedLabel={selectedLabel} />
        </div>
      </AppShell>
    );
  }

  const publicCommunity = await getPublicCommunityPageData();

  return (
    <div className="min-h-screen">
      <PublicNavbar currentPath="/community" />
      <main className="content-container-visual py-8 md:py-10 lg:py-12">
        <div className="space-y-6">
          <CommunityIntro />
          <PublicParticipationCta />
          <CommunityFeed data={publicCommunity} selectedLabel={selectedLabel} />
        </div>
      </main>
    </div>
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

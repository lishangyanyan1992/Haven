import Link from "next/link";
import { ArrowRight, MessageSquare, ShieldAlert, ThumbsUp, Users } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { CommunityComposer } from "./CommunityComposer";

export const metadata = noIndexMetadata;

const samplePosts = [
  {
    id: "p1",
    author: "H1B · EB-2 · India",
    stage: "I-140 Approved",
    time: "2h ago",
    title: "Crossed 180 days. AC21 portability finally feels real.",
    body: "I asked my attorney what documentation mattered most for a same-or-similar transition. SOC code framing was the key thing. Sharing in case it helps anyone else nearing this milestone.",
    tags: ["AC21", "Job Change"],
    replies: 7,
    likes: 14
  },
  {
    id: "p2",
    author: "H1B · EB-3 · China",
    stage: "Priority Date 2022",
    time: "5h ago",
    title: "EB-3 China bulletin moved again this cycle",
    body: "Updated my estimate accordingly. If you’re tracking EB-3 China, it’s worth checking your priority date against the final action dates. Happy to share what I use to monitor it.",
    tags: ["Visa Bulletin", "EB-3"],
    replies: 12,
    likes: 31
  },
  {
    id: "p3",
    author: "OPT → H1B · India",
    stage: "Cap-gap period",
    time: "1d ago",
    title: "Got my H1B approval. Sharing my exact timeline.",
    body: "Filed in April, RFE in July, approved in September. If you’re in cap-gap and anxious about timing, I can share what helped me stay organized while I waited.",
    tags: ["H1B", "Timeline"],
    replies: 23,
    likes: 58
  }
];

const filterTags = ["All", "AC21", "Layoffs", "Visa Bulletin", "H1B", "EB-2", "EB-3", "Green Card", "Job Change"];

export default async function CommunityPage() {
  const [snapshot, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const { cohorts, profile } = snapshot;
  const primaryCohort = cohorts[0];

  return (
    <AppShell activePath="/community" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[70ch]">
              <p className="text-label text-[var(--haven-sky-ink)]">Community</p>
              <h1 className="text-h1 mt-4">People who understand the part you&apos;re in.</h1>
              <p className="text-body mt-4">
                Grouped by visa stage and country queue, so the examples feel relevant instead of abstract.
              </p>
            </div>
            <Link href="/community/war-room">
              <span className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-5 py-2.5 text-sm text-[var(--haven-blush-ink)]">
                <ShieldAlert className="h-4 w-4" />
                Open Layoff War Room
              </span>
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <CommunityStat label="Your cohort" value={`${profile.preferenceCategory} ${profile.countryOfBirth} · ${profile.visaType}`} />
            <CommunityStat label="Active members" value={`${primaryCohort?.members.length ?? 0} similar profiles`} />
            <CommunityStat label="Recent posts" value="12 shared this week" />
          </div>
        </section>

        <CommunityComposer profile={{ visaType: profile.visaType, preferenceCategory: profile.preferenceCategory, countryOfBirth: profile.countryOfBirth }} />

        <div className="flex flex-wrap gap-2">
          {filterTags.map((tag, index) => (
            <span key={tag} className={index === 0 ? "tag tag-community" : "tag tag-pending"}>
              {tag}
            </span>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {samplePosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Your cohort</p>
                  <CardTitle className="mt-2">{primaryCohort?.name ?? "Matched peers"}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-body-sm">{primaryCohort?.summary}</p>
                {primaryCohort?.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
                    <div className="avatar avatar-md avatar-community">{member.label.split(" ")[1]}</div>
                    <div>
                      <p className="text-h3">{member.visaType} · {member.countryOfBirth}</p>
                      <p className="text-caption mt-1">{member.priorityDateRange}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card variant="urgent">
              <CardHeader>
                <div>
                  <p className="text-label">War room</p>
                  <CardTitle className="mt-2">High-urgency support space</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-body-sm">For members inside a 60-day grace period or actively planning for one.</p>
                <Link className="mt-4 inline-flex items-center gap-2 text-body-sm text-[var(--haven-blush-ink)] underline-offset-4 hover:underline" href="/community/war-room">
                  Enter the war room
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Community guidelines</p>
                  <CardTitle className="mt-2">The tone we keep here</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Share experiences, not legal advice.",
                  "Anonymized identities protect everyone.",
                  "Support each other through uncertainty.",
                  "Report anything that feels off."
                ].map((item) => (
                  <p key={item} className="text-body-sm">
                    {item}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CommunityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-white)] p-4">
      <p className="text-label text-[var(--haven-sky-ink)]">{label}</p>
      <p className="text-h3 mt-3">{value}</p>
    </div>
  );
}

function PostCard({
  post
}: {
  post: {
    id: string;
    author: string;
    stage: string;
    time: string;
    title: string;
    body: string;
    tags: string[];
    replies: number;
    likes: number;
  };
}) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-md avatar-community">H</div>
          <div>
            <p className="text-h3">{post.author}</p>
            <p className="text-caption mt-1">
              {post.stage} · {post.time}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="tag tag-community">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <h2 className="text-h2 mt-5">{post.title}</h2>
      <p className="text-body mt-3">{post.body}</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-4">
          <button className="inline-flex items-center gap-2 text-body-sm" type="button">
            <ThumbsUp className="h-4 w-4" />
            {post.likes}
          </button>
          <button className="inline-flex items-center gap-2 text-body-sm" type="button">
            <MessageSquare className="h-4 w-4" />
            {post.replies} replies
          </button>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2 text-body-sm" type="button">
          View thread
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

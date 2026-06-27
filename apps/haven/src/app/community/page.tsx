import type { Metadata } from "next";
import Link from "next/link";
import { Bot, FileText, LockKeyhole, MessageSquareQuote, ShieldCheck, Sparkles, Users } from "lucide-react";

import { CommunityContributionCta } from "@/components/app/community-contribution-cta";
import { CommunityFeed, CommunityIntro } from "@/components/app/community-feed";
import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { getPublicCommunityPageData } from "@/lib/repositories/case-compass";
import { absoluteUrl } from "@/lib/seo";

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

function PublicParticipationCta() {
  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 md:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] lg:items-center xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)_auto]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-h3">Sign in to post, reply, or ask Haven&apos;s AI expert.</p>
            <p className="text-body-sm mt-2 max-w-[68ch]">
              Reading the community is open. Participation and AI answers stay inside your private profile so Haven can
              use your saved case details without exposing timeline or document data.
            </p>
          </div>
        </div>
        <AiExpertVisual />
        <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2 xl:col-span-1 xl:flex-col">
          <Link className={buttonVariants({ variant: "default" })} href="/login?redirectTo=/profile/community">
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

function AiExpertVisual() {
  return (
    <div className="w-full max-w-[320px] justify-self-start rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[linear-gradient(135deg,var(--haven-sky-light),var(--haven-blush-light))] p-3 shadow-[0_10px_30px_-18px_rgba(15,42,33,0.45)] lg:justify-self-end">
      <div className="rounded-[var(--radius-lg)] border border-white/80 bg-white/80 p-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
            <Bot className="h-7 w-7" />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--haven-blush)] text-[var(--haven-blush-ink)]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-label text-[var(--haven-sky-ink)]">Haven AI expert</p>
            <p className="text-body-sm font-medium text-[var(--haven-ink)]">Reads your case context first</p>
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3">
          <div className="flex items-center gap-2 text-body-sm font-medium text-[var(--haven-ink)]">
            <MessageSquareQuote className="h-4 w-4 shrink-0 text-[var(--haven-sky-ink)]" />
            Answer preview
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-full rounded-full bg-[var(--haven-sand)]" />
            <div className="h-2 w-10/12 rounded-full bg-[var(--haven-sand)]" />
            <div className="h-2 w-7/12 rounded-full bg-[var(--haven-sage-mid)]" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[var(--radius-md)] bg-[var(--haven-sage-light)] px-3 py-2">
            <div className="flex items-center gap-1.5 text-caption font-medium text-[var(--haven-ink-mid)]">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              Sources
            </div>
            <p className="mt-1 text-[12px] leading-4 text-[var(--color-text-secondary)]">Rules and timelines</p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--haven-sky-light)] px-3 py-2">
            <div className="flex items-center gap-1.5 text-caption font-medium text-[var(--haven-sky-ink)]">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Private
            </div>
            <p className="mt-1 text-[12px] leading-4 text-[var(--color-text-secondary)]">Saved profile only</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CommunityPage({ searchParams }: CommunityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedLabel = resolvedSearchParams?.label?.trim() || "All";
  const publicCommunity = await getPublicCommunityPageData();

  return (
    <div className="min-h-screen">
      <PublicNavbar currentPath="/community" />
      <main className="content-container-visual py-8 md:py-10 lg:py-12">
        <div className="space-y-6">
          <CommunityIntro />
          <CommunityContributionCta />
          <PublicParticipationCta />
          <CommunityFeed data={publicCommunity} selectedLabel={selectedLabel} />
        </div>
      </main>
    </div>
  );
}

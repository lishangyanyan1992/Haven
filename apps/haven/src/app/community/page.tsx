import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, MessageSquareQuote, Users } from "lucide-react";

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
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
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
        <div className="flex flex-col gap-2 sm:flex-row">
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
          <PublicParticipationCta />
          <CommunityFeed data={publicCommunity} selectedLabel={selectedLabel} />
        </div>
      </main>
    </div>
  );
}

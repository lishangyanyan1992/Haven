import type { Metadata } from "next";

import { CommunityComposer } from "@/app/community/CommunityComposer";
import { AppShell } from "@/components/app/app-shell";
import { CommunityContributionCta } from "@/components/app/community-contribution-cta";
import { CommunityFeed, CommunityIntro, type CommunityFeedView } from "@/components/app/community-feed";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot, markCommunitySeen } from "@/lib/repositories/case-compass";

export const metadata: Metadata = {
  title: "Private Community | Haven",
  robots: {
    index: false,
    follow: false
  }
};

type ProfileCommunityPageProps = {
  searchParams?: Promise<{ label?: string | string[]; labels?: string | string[]; view?: string }>;
};

function parseCommunityView(value?: string): CommunityFeedView {
  return value === "latest" || value === "all" ? value : "for-you";
}

function parseSelectedLabels(primary?: string | string[], fallback?: string | string[]) {
  const rawValues = Array.isArray(primary)
    ? primary
    : primary
      ? [primary]
      : Array.isArray(fallback)
        ? fallback
        : fallback
          ? [fallback]
          : [];

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => value.split(","))
        .map((label) => label.trim())
        .filter(Boolean)
        .filter((label) => label !== "All")
    )
  );
}

export default async function ProfileCommunityPage({ searchParams }: ProfileCommunityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedLabels = parseSelectedLabels(resolvedSearchParams?.labels, resolvedSearchParams?.label);
  const selectedView = parseCommunityView(resolvedSearchParams?.view);
  await markCommunitySeen();
  const [snapshot, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const { profile } = snapshot;

  return (
    <AppShell activePath="/profile/community" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <CommunityIntro />
        <CommunityContributionCta />

        <CommunityComposer
          profile={{
            visaType: profile.visaType,
            preferenceCategory: profile.preferenceCategory,
            countryOfBirth: profile.countryOfBirth
          }}
        />

        <CommunityFeed
          basePath="/profile/community"
          data={snapshot}
          profile={{
            countryOfBirth: profile.countryOfBirth,
            employmentStatus: profile.employmentStatus,
            i140Approved: profile.i140Approved,
            i485Filed: profile.i485Filed,
            permStage: profile.permStage,
            preferenceCategory: profile.preferenceCategory,
            primaryGoal: profile.primaryGoal,
            topConcerns: profile.topConcerns,
            visaType: profile.visaType
          }}
          selectedLabels={selectedLabels}
          selectedView={selectedView}
        />
      </div>
    </AppShell>
  );
}

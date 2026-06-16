import type { Metadata } from "next";

import { CommunityComposer } from "@/app/community/CommunityComposer";
import { AppShell } from "@/components/app/app-shell";
import { CommunityFeed, CommunityIntro } from "@/components/app/community-feed";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";

export const metadata: Metadata = {
  title: "Private Community | Haven",
  robots: {
    index: false,
    follow: false
  }
};

type ProfileCommunityPageProps = {
  searchParams?: Promise<{ label?: string }>;
};

export default async function ProfileCommunityPage({ searchParams }: ProfileCommunityPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedLabel = resolvedSearchParams?.label?.trim() || "All";
  const [snapshot, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const { profile } = snapshot;

  return (
    <AppShell activePath="/profile/community" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <CommunityIntro />

        <CommunityComposer
          profile={{
            visaType: profile.visaType,
            preferenceCategory: profile.preferenceCategory,
            countryOfBirth: profile.countryOfBirth
          }}
        />

        <CommunityFeed basePath="/profile/community" data={snapshot} selectedLabel={selectedLabel} />
      </div>
    </AppShell>
  );
}

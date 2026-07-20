import type { Metadata } from "next";

import { CommunityComposer } from "@/app/community/CommunityComposer";
import { AppShell } from "@/components/app/app-shell";
import { CommunityContributionCta } from "@/components/app/community-contribution-cta";
import { CommunityFeed, CommunityIntro } from "@/components/app/community-feed";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot, markCommunitySeen } from "@/lib/repositories/case-compass";

export const metadata: Metadata = {
  title: "Private Community | Haven",
  robots: {
    index: false,
    follow: false
  }
};

export default async function ProfileCommunityPage() {
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
        />
      </div>
    </AppShell>
  );
}

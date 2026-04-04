import { AppShell } from "@/components/app/app-shell";
import { ImmigrationUpdates } from "@/components/app/immigration-updates";
import { getAdvisorWorkspaceSeed } from "@/lib/advisor/service";
import { getCrisisState } from "@/lib/get-crisis-state";
import { noIndexMetadata } from "@/lib/seo";

import { AdvisorWorkspace } from "./AdvisorWorkspace";

export const metadata = noIndexMetadata;

export default async function AdvisorPage() {
  const [seed, crisisState] = await Promise.all([getAdvisorWorkspaceSeed(), getCrisisState()]);

  return (
    <AppShell activePath="/advisor" crisisState={crisisState}>
      <div className="space-y-6">
        <ImmigrationUpdates />
        <AdvisorWorkspace suggestedPrompts={seed.suggestedPrompts} welcomeMessage={seed.welcomeMessage} />
      </div>
    </AppShell>
  );
}

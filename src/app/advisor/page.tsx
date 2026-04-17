import { AppShell } from "@/components/app/app-shell";
import { ImmigrationUpdates } from "@/components/app/immigration-updates";
import { getAdvisorWorkspaceSeed } from "@/lib/advisor/service";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getAppShellSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";

import { AdvisorWorkspace } from "./AdvisorWorkspace";

export const metadata = noIndexMetadata;

export default async function AdvisorPage() {
  const [snapshot, crisisState] = await Promise.all([getAppShellSnapshot(), getCrisisState()]);
  const seed = await getAdvisorWorkspaceSeed(snapshot);

  return (
    <AppShell activePath="/advisor" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <ImmigrationUpdates />
        <AdvisorWorkspace suggestedPrompts={seed.suggestedPrompts} welcomeMessage={seed.welcomeMessage} />
      </div>
    </AppShell>
  );
}

import { AppShell } from "@/components/app/app-shell";
import { getAdvisorUsage, getAdvisorWorkspaceSeed } from "@/lib/advisor/service";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getAppShellSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";

import { AdvisorWorkspace } from "./AdvisorWorkspace";

export const metadata = noIndexMetadata;

export default async function AdvisorPage() {
  const [snapshot, crisisState, advisorUsage] = await Promise.all([
    getAppShellSnapshot(),
    getCrisisState(),
    getAdvisorUsage()
  ]);
  const seed = await getAdvisorWorkspaceSeed(snapshot);

  return (
    <AppShell activePath="/advisor" crisisState={crisisState} snapshot={snapshot}>
      <AdvisorWorkspace
        advisorUsage={advisorUsage}
        suggestedPrompts={seed.suggestedPrompts}
        welcomeMessage={seed.welcomeMessage}
      />
    </AppShell>
  );
}

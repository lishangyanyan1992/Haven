import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";

import { AppShell } from "@/components/app/app-shell";
import { documentContextAvailableFor } from "@/lib/document-context/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  // Demo mode runs without Supabase, and the server client throws there; the
  // link only matters to signed-in accounts on the test switch anyway.
  let showDocumentsLink = false;
  if (hasSupabaseEnv) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    showDocumentsLink = await documentContextAvailableFor(user?.email);
  }

  return (
    <AppShell activePath="/advisor" crisisState={crisisState} snapshot={snapshot}>
      {showDocumentsLink ? (
        <p className="mb-3 text-body-sm text-[var(--color-text-secondary)]">
          <Link className="underline underline-offset-2" href="/documents">
            Add your documents
          </Link>{" "}
          and answers will use them.
        </p>
      ) : null}
      <AdvisorWorkspace
        advisorUsage={advisorUsage}
        initialThreads={seed.threads}
        suggestedPrompts={seed.suggestedPrompts}
        welcomeMessage={seed.welcomeMessage}
      />
    </AppShell>
  );
}

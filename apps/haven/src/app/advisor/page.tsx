import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";

import { AppShell } from "@/components/app/app-shell";
import { documentContextAvailableFor } from "@/lib/document-context/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdvisorUsage, getAdvisorWorkspaceSeed } from "@/lib/advisor/service";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getAppShellSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";

import { getChatVisibility } from "@/lib/advisor/firm-visibility";
import { AdvisorWorkspace, type AdvisorChatVisibility } from "./AdvisorWorkspace";

export const metadata = noIndexMetadata;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdvisorPage({ searchParams }: { searchParams?: Promise<{ chat?: string }> }) {
  const requestedChat = (searchParams ? await searchParams : undefined)?.chat ?? "";
  const initialThreadId = uuidPattern.test(requestedChat) ? requestedChat : null;
  const [snapshot, crisisState, advisorUsage] = await Promise.all([
    getAppShellSnapshot(),
    getCrisisState(),
    getAdvisorUsage()
  ]);
  const seed = await getAdvisorWorkspaceSeed(snapshot);
  // Demo mode runs without Supabase, and the server client throws there; the
  // link only matters to signed-in accounts on the test switch anyway.
  let showDocumentsLink = false;
  let chatVisibility: AdvisorChatVisibility | null = null;
  if (hasSupabaseEnv) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    showDocumentsLink = await documentContextAvailableFor(user?.email);
    if (user) {
      try {
        const visibility = await getChatVisibility(user.id);
        chatVisibility =
          visibility.firms.length > 0
            ? {
                firms: visibility.firms.map((f) => ({ firmId: f.firmId, firmName: f.firmName, acknowledgedAt: f.acknowledgedAt })),
                needsNotice: visibility.needsNotice
              }
            : null;
      } catch (error) {
        // Fail closed for firm clients: the send endpoint checks again and asks for the notice.
        console.error("[advisor] could not load chat sharing", error);
      }
    }
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
        chatVisibility={chatVisibility}
        initialThreadId={initialThreadId}
        initialThreads={seed.threads}
        suggestedPrompts={seed.suggestedPrompts}
        welcomeMessage={seed.welcomeMessage}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/app/app-shell";
import { DocumentContextUploader } from "@/components/app/document-context-uploader";
import { RefreshWhileReading } from "@/components/app/refresh-while-reading";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GonePage from "@/app/gone/page";
import { formatBytes } from "@/lib/document-vault";
import { documentContextAvailableFor } from "@/lib/document-context/store";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getInboxPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readDocumentAction } from "@/server/document-context-actions";
import { deleteVaultDocument } from "@/server/document-actions";
import type { UserDocument } from "@/types/domain";

export const metadata = noIndexMetadata;
export const dynamic = "force-dynamic";

const STATUS: Record<NonNullable<UserDocument["readingStatus"]>, string> = {
  done: "Ready — the chat can use it",
  pending: "Being read…",
  reading: "Being read…",
  deferred: "Daily reading limit reached — will be read tomorrow",
  failed: "Could not be read",
  not_requested: "Not read yet"
};

/**
 * Documents: upload, see, delete. The chat answers from what is here.
 * Hidden behind DOCUMENT_READING_ALLOWLIST while it is being tested.
 */
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !documentContextAvailableFor(user.email)) return <GonePage />;

  const [snapshot, crisisState] = await Promise.all([getInboxPageData(), getCrisisState()]);
  const documents = snapshot.documents.filter((d) => d.sourceKind === "manual_upload");
  const stillReading = documents.some((d) => d.readingStatus === "pending" || d.readingStatus === "reading");

  return (
    <AppShell activePath="/documents" crisisState={crisisState} snapshot={snapshot}>
      <RefreshWhileReading active={stillReading} />
      <div className="mx-auto max-w-[760px] space-y-6">
        <section>
          <h1 className="text-h1">Your documents</h1>
          <p className="text-body mt-3 text-[var(--color-text-secondary)]">
            Upload your notices, I-94, EAD card or passport page and the chat will answer from them. When it uses one,
            it tells you which document and page.
          </p>
        </section>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4 text-body-sm">
              To read a document, Haven sends it to OpenAI, the AI company behind the chat. It&apos;s used only to answer
              your questions. Delete a document and everything Haven read from it goes with it.
            </p>
            <DocumentContextUploader />
          </CardContent>
        </Card>

        <div className="space-y-3">
          {documents.length === 0 ? (
            <p className="text-body-sm text-[var(--color-text-secondary)]">No documents yet.</p>
          ) : (
            documents.map((document) => {
              const status = document.readingStatus ?? "not_requested";
              return (
                <div
                  key={document.id}
                  className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-h3 truncate">{document.originalName}</p>
                    <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
                      {formatBytes(document.fileSizeBytes)} · {new Date(document.uploadedAt).toLocaleDateString()} · {STATUS[status]}
                    </p>
                    {status === "failed" && document.readingError ? (
                      <p className="mt-1 text-body-sm text-[var(--haven-blush-ink)]">{document.readingError}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {status === "not_requested" || status === "failed" ? (
                      <form action={readDocumentAction}>
                        <input name="documentId" type="hidden" value={document.id} />
                        <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
                          {status === "failed" ? "Try again" : "Read it"}
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteVaultDocument}>
                      <input name="documentId" type="hidden" value={document.id} />
                      <button className={buttonVariants({ variant: "ghost", size: "sm" })} type="submit">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}

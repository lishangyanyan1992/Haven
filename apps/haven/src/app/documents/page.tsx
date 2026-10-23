import Link from "next/link";
import { CheckCircle2, CircleAlert, FileText, Upload } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { DocumentContextUploader } from "@/components/app/document-context-uploader";
import { RefreshWhileReading } from "@/components/app/refresh-while-reading";
import { Card, CardContent } from "@/components/ui/card";
import GonePage from "@/app/gone/page";
import { findPresetDocument, PRESET_REQUIRED_DOCUMENTS } from "@/lib/document-vault";
import { documentContextAvailableFor } from "@/lib/document-context/store";
import { FirmSharingNote } from "@/components/app/firm-sharing-note";
import { getClientFirm } from "@/lib/firms/intake";
import { getFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getInboxPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentCard, type DocumentCategoryOption } from "./DocumentCard";
import type { UserDocument } from "@/types/domain";

export const metadata = noIndexMetadata;
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !(await documentContextAvailableFor(user.email))) return <GonePage />;

  const firm = await getClientFirm(user.id);
  const requiredDocs = firm ? await getFirmRequiredDocuments(firm.firmId) : null;

  const [snapshot, crisisState] = await Promise.all([getInboxPageData(), getCrisisState()]);
  const documents = snapshot.documents.filter((d) => d.sourceKind === "manual_upload");
  const stillReading = documents.some((d) => d.readingStatus === "pending" || d.readingStatus === "reading");

  // Partition documents if firm has required documents
  const hasFirmRequirements = Boolean(requiredDocs && requiredDocs.length > 0);
  const requiredKeys = new Set(requiredDocs?.map((r) => r.key) ?? []);

  const availableCategories: DocumentCategoryOption[] = [
    ...PRESET_REQUIRED_DOCUMENTS.map((p) => ({ key: p.key, label: p.label })),
    ...(requiredDocs?.filter((r) => r.isCustom).map((r) => ({ key: r.key, label: r.label })) ?? [])
  ];

  const firmChecklist = (requiredDocs ?? []).map((req) => {
    const matchingDocs = documents.filter((d) => d.documentKind === req.key);
    const preset = findPresetDocument(req.key);
    return {
      key: req.key,
      label: req.label,
      detail: preset?.detail,
      isUploaded: matchingDocs.length > 0,
      documents: matchingDocs
    };
  });

  const fulfilledCount = firmChecklist.filter((item) => item.isUploaded).length;
  const additionalDocuments = hasFirmRequirements
    ? documents.filter((d) => !requiredKeys.has(d.documentKind))
    : documents;

  return (
    <AppShell activePath="/documents" crisisState={crisisState} snapshot={snapshot}>
      <RefreshWhileReading active={stillReading} />
      <div className="mx-auto max-w-[820px] space-y-6">
        <section>
          <h1 className="text-h1">Document Vault</h1>
          <p className="text-body mt-2 text-[var(--color-text-secondary)]">
            Store and manage your immigration records. When you ask questions in Haven Advisor, your answers are
            cited directly from these documents.
          </p>
        </section>

        {firm ? <FirmSharingNote firmName={firm.firmName} /> : null}

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4 text-body-sm">
              To read a document, Haven sends it to OpenAI, the AI company behind the chat. It&apos;s used only to answer
              your questions and citations will name the exact document and page. Delete a document and everything Haven
              read from it is permanently removed.
            </p>
            <div>
              <p className="text-body-sm font-semibold text-[var(--haven-ink)]">Upload a document</p>
              <div className="mt-2">
                <DocumentContextUploader allowCategorySelect availableCategories={availableCategories} />
              </div>
            </div>
          </CardContent>
        </Card>

        {hasFirmRequirements ? (
          <div className="space-y-6">
            <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-4">
                <div>
                  <h2 className="text-h3">Requested by {firm?.firmName}</h2>
                  <p className="text-body-sm mt-0.5 text-[var(--haven-ink-mid)]">
                    Upload these required documents for your attorney to review.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--haven-cream)] px-3 py-1 text-body-sm font-semibold text-[var(--haven-ink)]">
                  {fulfilledCount} of {requiredDocs?.length} fulfilled
                </span>
              </div>

              <div className="mt-4 divide-y divide-[var(--color-border)]">
                {firmChecklist.map((item) => (
                  <div className="py-4 first:pt-0 last:pb-0" key={item.key}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.isUploaded ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)]" />
                        ) : (
                          <CircleAlert className="h-4 w-4 text-[var(--haven-blush-ink)]" />
                        )}
                        <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{item.label}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            item.isUploaded
                              ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                              : "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
                          }`}
                        >
                          {item.isUploaded ? "Uploaded" : "Needed"}
                        </span>
                      </div>
                    </div>

                    {item.detail && !item.isUploaded && (
                      <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">{item.detail}</p>
                    )}

                    {item.isUploaded ? (
                      <div className="mt-3 space-y-2">
                        {item.documents.map((doc) => (
                          <DocumentCard
                            availableCategories={availableCategories}
                            document={doc}
                            key={doc.id}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--haven-cream)] p-3">
                        <DocumentContextUploader
                          buttonLabel={`Upload ${item.label}`}
                          compact
                          displayLabel={item.label}
                          documentKind={item.key}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-h3">Other Documents ({additionalDocuments.length})</h2>
              {additionalDocuments.length === 0 ? (
                <p className="text-body-sm text-[var(--color-text-secondary)]">No additional documents uploaded.</p>
              ) : (
                <div className="space-y-3">
                  {additionalDocuments.map((doc) => (
                    <DocumentCard
                      availableCategories={availableCategories}
                      document={doc}
                      key={doc.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-h3">Your Uploaded Documents ({documents.length})</h2>
            </div>
            {documents.length === 0 ? (
              <p className="text-body-sm text-[var(--color-text-secondary)]">
                No documents in your vault yet. Upload notices, cards, or passport pages above.
              </p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentCard
                    availableCategories={availableCategories}
                    document={doc}
                    key={doc.id}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

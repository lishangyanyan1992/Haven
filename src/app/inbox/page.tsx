import Link from "next/link";
import { FileText, Mail, ShieldAlert, UploadCloud } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { DocumentVaultUploader } from "@/components/app/document-vault-uploader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, getMissingVaultEssentials } from "@/lib/document-vault";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { deleteVaultDocument } from "@/server/document-actions";

export default async function InboxPage() {
  const [{ emailInbox, emailAlias, documents }, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const missingEssentials = getMissingVaultEssentials(documents);
  const crisisCriticalCount = documents.filter((document) => document.crisisCritical).length;

  return (
    <AppShell activePath="/inbox" crisisState={crisisState}>
      <div className="space-y-6">
        <section className="page-intro">
          <p className="text-label">Document vault</p>
          <h1 className="text-h1 mt-4">Store the files your attorney will ask for in the next 48 hours.</h1>
          <p className="text-body mt-4 max-w-[68ch]">
            When HR calls you into a room on a Tuesday, Haven should already have your I-140 notice, H-1B packet,
            PERM record, passport page, and the rest of your crisis-critical file stack.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Stored now"
            value={`${documents.length}`}
            helper="Private files inside your Haven vault."
            icon={<FileText className="h-5 w-5 text-[var(--haven-sky-ink)]" />}
          />
          <SummaryCard
            label="Crisis-critical"
            value={`${crisisCriticalCount}`}
            helper="Documents Haven marked as high priority for layoffs or status changes."
            icon={<ShieldAlert className="h-5 w-5 text-[var(--haven-blush-ink)]" />}
          />
          <SummaryCard
            label="Email ingest"
            value={`${emailInbox.length}`}
            helper="Forwarded emails still stay available below."
            icon={<Mail className="h-5 w-5 text-[var(--haven-ink-mid)]" />}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card variant="feature">
            <CardHeader>
              <div>
                <p className="text-label">Upload now</p>
                <CardTitle className="mt-2">Build your layoff insurance before you need it</CardTitle>
              </div>
              <UploadCloud className="h-5 w-5 text-[var(--haven-sky-ink)]" />
            </CardHeader>
            <CardContent>
              <DocumentVaultUploader />
            </CardContent>
          </Card>

          <Card variant={missingEssentials.length > 0 ? "urgent" : "alert"}>
            <CardHeader>
              <div>
                <p className="text-label">Coverage gaps</p>
                <CardTitle className="mt-2">
                  {missingEssentials.length > 0 ? "What is still missing from your vault" : "Your core crisis documents are covered"}
                </CardTitle>
              </div>
              <ShieldAlert className="h-5 w-5 text-[var(--haven-blush-ink)]" />
            </CardHeader>
            <CardContent className="space-y-3">
              {missingEssentials.length > 0 ? (
                missingEssentials.map((item) => (
                  <div key={item.kind} className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4">
                    <p className="text-h3">{item.title}</p>
                    <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">{item.detail}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[var(--radius-lg)] bg-[var(--haven-white)] p-4 text-body-sm">
                  Haven has the four layoff-critical documents it prioritizes first. Keep adding notices, pay records,
                  and attorney correspondence so the vault stays complete.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div>
              <p className="text-label">Vault contents</p>
              <CardTitle className="mt-2">Everything you can hand to counsel quickly</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {documents.length > 0 ? (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-h3">{document.displayLabel}</p>
                      {document.crisisCritical ? <Badge variant="urgent">Crisis critical</Badge> : <Badge variant="pending">Reference</Badge>}
                      <Badge variant="community">{document.sourceKind.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
                      {document.originalName} · {formatBytes(document.fileSizeBytes)} · Uploaded{" "}
                      {new Date(document.uploadedAt).toLocaleDateString()}
                    </p>
                    {document.notes ? <p className="mt-3 text-body-sm">{document.notes}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      className={buttonVariants({ variant: "outline" })}
                      href={`/api/files/sign?documentId=${document.id}`}
                    >
                      Download
                    </Link>
                    <form action={deleteVaultDocument}>
                      <input name="documentId" type="hidden" value={document.id} />
                      <button className={buttonVariants({ variant: "ghost" })} type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-5 text-body-sm text-[var(--color-text-secondary)]">
                Your vault is empty. Upload the four crisis-critical documents first so Haven can become useful on your
                worst day, not just your best day.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-label">Email ingest still works</p>
              <CardTitle className="mt-2">Forward notices if that is easier than downloading PDFs manually</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-body-sm text-[var(--color-text-secondary)]">
                Haven never reaches into your inbox. You forward only what you want processed, and Haven keeps asking
                for confirmation before profile fields change.
              </p>
              {emailAlias ? (
                <div className="mt-4 inline-flex rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-2 font-mono text-[13px] text-[var(--haven-ink)]">
                  {emailAlias}
                </div>
              ) : (
                <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-sand)] px-4 py-3 text-body-sm text-[var(--color-text-secondary)]">
                  Complete your onboarding to activate your personal forwarding address.
                </div>
              )}
            </div>

            <div className="grid gap-4">
              {emailInbox.length === 0 && emailAlias ? (
                <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-5 text-body-sm text-[var(--color-text-secondary)]">
                  No emails forwarded yet. Forward any immigration notice to the address above to get started.
                </div>
              ) : null}
              {emailInbox.map((record) => (
                <div key={record.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-label">{record.sourceType.replaceAll("_", " ")}</p>
                      <p className="mt-2 text-h3">{record.subject}</p>
                    </div>
                    <Badge variant={record.status === "accepted" ? "active" : "pending"}>
                      {record.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-3 text-caption">
                    Received {new Date(record.receivedAt).toLocaleDateString()} · Confidence appears on each extracted field.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {record.extractedFields.map((field) => (
                      <div key={field.label} className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-label">{field.label}</p>
                          <Badge variant={field.confidence === "high" ? "active" : "pending"}>{field.confidence}</Badge>
                        </div>
                        <p className="mt-3 text-body-sm">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-label">{label}</p>
          <CardTitle className="mt-2">{value}</CardTitle>
        </div>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-body-sm text-[var(--color-text-secondary)]">{helper}</p>
      </CardContent>
    </Card>
  );
}

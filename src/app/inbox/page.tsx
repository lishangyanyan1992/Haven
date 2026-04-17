import Link from "next/link";
import { ChevronDown, FileText, Mail, ShieldAlert, UploadCloud, User } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { DocumentVaultUploader } from "@/components/app/document-vault-uploader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, getMissingVaultEssentials } from "@/lib/document-vault";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getInboxPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { deleteVaultDocument } from "@/server/document-actions";
import { labelContactAction } from "@/server/actions";
import { CONTACT_ROLE_LABELS, type ContactRole, type EmailThread } from "@/types/domain";

export const metadata = noIndexMetadata;

export default async function InboxPage() {
  const [snapshot, crisisState] = await Promise.all([
    getInboxPageData(),
    getCrisisState(),
  ]);
  const { emailInbox, emailAlias, emailThreads, emailContacts, documents } = snapshot;
  const missingEssentials = getMissingVaultEssentials(documents);
  const crisisCriticalCount = documents.filter((document) => document.crisisCritical).length;

  // Emails not part of any thread (legacy / pre-migration)
  const threadlessEmails = emailInbox.filter((e) => !e.threadId);

  return (
    <AppShell activePath="/inbox" crisisState={crisisState} snapshot={snapshot}>
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
                  {missingEssentials.length > 0
                    ? "What is still missing from your vault"
                    : "Your core crisis documents are covered"}
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
                  Haven has the four layoff-critical documents it prioritizes first. Keep adding notices, pay
                  records, and attorney correspondence so the vault stays complete.
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
                      {document.crisisCritical ? (
                        <Badge variant="urgent">Crisis critical</Badge>
                      ) : (
                        <Badge variant="pending">Reference</Badge>
                      )}
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
                Your vault is empty. Upload the four crisis-critical documents first so Haven can become useful on
                your worst day, not just your best day.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts section */}
        {emailContacts.length > 0 && (
          <Card>
            <CardHeader>
              <div>
                <p className="text-label">People</p>
                <CardTitle className="mt-2">Label who sent you these emails</CardTitle>
              </div>
              <User className="h-5 w-5 text-[var(--haven-ink-mid)]" />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-body-sm text-[var(--color-text-secondary)]">
                Labeling senders helps Haven surface the right context alongside each email thread.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {emailContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {contact.name && <p className="text-h3 truncate">{contact.name}</p>}
                        <p className="mt-1 font-mono text-[12px] text-[var(--color-text-secondary)] truncate">
                          {contact.email}
                        </p>
                      </div>
                      {contact.role && (
                        <Badge variant="community">{CONTACT_ROLE_LABELS[contact.role]}</Badge>
                      )}
                    </div>
                    <form action={labelContactAction} className="flex items-center gap-2">
                      <input type="hidden" name="contactId" value={contact.id} />
                      <select
                        name="role"
                        defaultValue={contact.role ?? ""}
                        className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-1.5 text-body-sm"
                      >
                        <option value="">— no label —</option>
                        {(Object.entries(CONTACT_ROLE_LABELS) as [ContactRole, string][]).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className={buttonVariants({ variant: "outline" })}
                        style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
                      >
                        Save
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email threads */}
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
                Haven never reaches into your inbox. You forward only what you want processed, and Haven keeps
                asking for confirmation before profile fields change.
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

              {/* Threaded emails */}
              {emailThreads.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}

              {/* Emails without a thread (pre-migration or no subject) */}
              {threadlessEmails.map((record) => (
                <div
                  key={record.id}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4"
                >
                  <EmailRow record={record} showBody />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function ThreadCard({ thread }: { thread: EmailThread }) {
  const latestEmail = thread.emails[0];
  const hasMultiple = thread.emails.length > 1;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)]">
      {/* Thread header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <p className="text-label">Thread</p>
          <p className="mt-1 text-h3">{thread.subject}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <Badge variant="community">{thread.emails.length} emails</Badge>
          )}
          <p className="text-caption text-[var(--color-text-secondary)]">
            Last: {new Date(thread.lastEmailAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {thread.emails.map((record, i) => (
          <details key={record.id} open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[var(--haven-sand)] transition-colors">
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] details-chevron" />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <SenderLabel record={record} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={record.status === "accepted" ? "active" : "pending"}>
                    {record.status.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-caption text-[var(--color-text-secondary)]">
                    {new Date(record.receivedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </summary>
            <div className="px-4 pb-4">
              <EmailRow record={record} showBody />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function SenderLabel({ record }: { record: import("@/types/domain").EmailIngestRecord }) {
  const display = record.contact?.name ?? record.senderName ?? record.senderEmail;
  const role = record.contact?.role;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {display && <span className="text-body-sm font-medium truncate max-w-[24ch]">{display}</span>}
      {role && <Badge variant="community">{CONTACT_ROLE_LABELS[role]}</Badge>}
      {!display && <span className="text-body-sm text-[var(--color-text-secondary)]">Unknown sender</span>}
    </div>
  );
}

function EmailRow({
  record,
  showBody,
}: {
  record: import("@/types/domain").EmailIngestRecord;
  showBody?: boolean;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label">{record.sourceType.replaceAll("_", " ")}</p>
          <p className="mt-1 text-h3">{record.subject}</p>
        </div>
        <Badge variant={record.status === "accepted" ? "active" : "pending"}>
          {record.status.replaceAll("_", " ")}
        </Badge>
      </div>

      {(record.senderEmail || record.senderName) && (
        <p className="text-caption text-[var(--color-text-secondary)]">
          From:{" "}
          <span className="font-medium text-[var(--haven-ink)]">
            {record.senderName ? `${record.senderName} ` : ""}
            {record.senderEmail ? `<${record.senderEmail}>` : ""}
          </span>
        </p>
      )}

      <p className="text-caption text-[var(--color-text-secondary)]">
        Received {new Date(record.receivedAt).toLocaleDateString()} · Confidence appears on each extracted field.
      </p>

      {showBody && record.bodyText && (
        <details>
          <summary className="cursor-pointer text-body-sm text-[var(--haven-sky-ink)] hover:underline">
            View full email body
          </summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4 text-[12px] leading-relaxed text-[var(--haven-ink)] overflow-x-auto max-h-80">
            {record.bodyText}
          </pre>
        </details>
      )}

      {record.extractedFields.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
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
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
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

import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, UserCheck } from "lucide-react";

import { requireFirmMember } from "@/lib/firms/access";
import { listFirmClients } from "@/lib/firms/clients";
import { noIndexMetadata } from "@/lib/seo";
import { ContactQuickActions } from "../ContactQuickActions";
import { ContactRequestMarker } from "../ContactRequestMarker";
import { ExportCmsButton } from "../ExportCmsButton";
import { FirmHeader } from "../FirmHeader";
import { FirmNavTabs } from "../FirmNavTabs";
import { PipelineStatusSelect } from "../PipelineStatusSelect";

export const metadata = { ...noIndexMetadata, title: "Retained Clients · Haven" };
export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function RetainedClientsPage({ searchParams }: { searchParams: Promise<{ asked?: string }> }) {
  const membership = await requireFirmMember("/firm/clients");
  const allClients = await listFirmClients(membership.firmId);
  const askedOnly = (await searchParams).asked === "1";

  const leads = allClients.filter((c) => c.pipelineStatus !== "contract_signed");
  const allRetained = allClients.filter((c) => c.pipelineStatus === "contract_signed");
  const retainedClients = askedOnly ? allRetained.filter((c) => c.openContactRequest) : allRetained;
  const askedCount = allRetained.filter((c) => c.openContactRequest).length;

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <FirmHeader email={membership.email} firmName={membership.firmName} isDemo={membership.isDemo} />
      <main className="content-container-wide space-y-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-label">Firm Client Workspace</p>
            <h1 className="text-h1 mt-2">{membership.firmName}</h1>
          </div>
          <span className="rounded-full bg-[var(--haven-sage-light)] border border-[var(--haven-sage-mid)] px-3.5 py-1.5 text-body-sm font-semibold text-[var(--haven-ink)] flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            {allRetained.length} Retained Clients
          </span>
        </div>

        {/* Tab navigation between Leads and Retained Clients */}
        <FirmNavTabs
          clientsCount={allRetained.length}
          current="clients"
          leadsCount={leads.length}
        />

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-sm">
          <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
            <h2 className="text-h3">Retained Representation ({retainedClients.length})</h2>
            <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
              Clients who have signed contracts with your firm. Download complete dossiers and document files to upload into your Case Management System (CMS).
            </p>
            {askedCount > 0 || askedOnly ? (
              <Link
                className="mt-3 inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-ink)] underline underline-offset-4"
                href={askedOnly ? "/firm/clients" : "/firm/clients?asked=1"}
              >
                {askedOnly ? "Show all retained clients" : `Show only those who asked to be contacted (${askedCount})`}
              </Link>
            ) : null}
          </div>

          {retainedClients.length === 0 ? (
            <div className="p-8 text-center text-body-sm text-[var(--haven-ink-mid)] space-y-3">
              <p>{askedOnly ? "No retained client has an open request to be contacted." : "No retained clients yet."}</p>
              <p className="text-[13px]">
                When an active lead signs a retainer agreement, mark their pipeline stage as <strong>Contract signed</strong> on the Leads dashboard and they will appear here.
              </p>
              <Link
                className="inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-ink)] underline underline-offset-4"
                href="/firm"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads Pipeline
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-body-sm">
                <thead className="text-[12px] uppercase tracking-[0.08em] text-[var(--haven-ink-mid)] bg-[var(--haven-cream)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="px-5 py-3 font-semibold sm:px-6">Client Name</th>
                    <th className="px-3 py-3 font-semibold">Direct Contact (Email & Phone)</th>
                    <th className="px-3 py-3 font-semibold">Stage</th>
                    <th className="px-3 py-3 font-semibold">Visa Category</th>
                    <th className="px-3 py-3 font-semibold">Vault Documents</th>
                    <th className="px-3 py-3 font-semibold">Retained Since</th>
                    <th className="px-5 py-3 font-semibold sm:px-6 text-right">Case Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {retainedClients.map((client) => (
                    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--haven-cream)] transition" key={client.id}>
                      <td className="px-5 py-3 sm:px-6 font-medium">
                        <Link
                          className="font-semibold text-[var(--haven-ink)] underline-offset-4 hover:underline text-body"
                          href={`/firm/clients/${client.id}`}
                        >
                          {client.displayName}
                        </Link>
                        {client.openContactRequest ? (
                          <div>
                            <ContactRequestMarker firmClientId={client.id} sentAt={client.openContactRequest.sentAt} />
                          </div>
                        ) : null}
                      </td>

                      <td className="px-3 py-3">
                        <ContactQuickActions email={client.email} phone={client.phone} size="sm" />
                      </td>

                      <td className="px-3 py-3">
                        <PipelineStatusSelect
                          firmClientId={client.id}
                          initialStatus={client.pipelineStatus}
                        />
                      </td>

                      <td className="px-3 py-3 font-medium text-[var(--haven-ink)]">
                        {client.visaType ?? "—"}
                      </td>

                      <td className="px-3 py-3">
                        {client.totalRequiredCount && client.totalRequiredCount > 0 ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-[var(--haven-ink)]">
                              {client.requiredDocumentCount ?? 0}/{client.totalRequiredCount} required
                            </span>
                            <span className="text-[11px] text-[var(--haven-ink-mid)]">
                              {client.documentCount} total files
                            </span>
                            {client.toCheckCount ? (
                              <span className="text-[11px] font-semibold text-[var(--haven-blush-ink)]">
                                {client.toCheckCount} to check
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="flex flex-col">
                            <span className="font-medium text-[var(--haven-ink)]">{client.documentCount} files</span>
                            {client.toCheckCount ? (
                              <span className="text-[11px] font-semibold text-[var(--haven-blush-ink)]">
                                {client.toCheckCount} to check
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-[var(--haven-ink-mid)]">
                        {formatDate(client.joinedAt || client.createdAt)}
                      </td>

                      <td className="px-5 py-3 sm:px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <ExportCmsButton
                            clientName={client.displayName}
                            firmClientId={client.id}
                          />
                          <Link
                            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] px-2.5 py-1 text-[12px] font-medium text-[var(--haven-ink)] hover:bg-[var(--haven-cream)]"
                            href={`/firm/clients/${client.id}`}
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

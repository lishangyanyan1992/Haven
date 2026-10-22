import Link from "next/link";

import { requireFirmMember } from "@/lib/firms/access";
import { listFirmClients } from "@/lib/firms/clients";
import { getCurrentFirmLink, intakeUrl } from "@/lib/firms/links";
import { FIRM_CLIENT_STATUS_LABEL } from "@/lib/firms/status";
import { TIER_LABEL, type UrgencyTier } from "@/lib/firms/urgency";
import { noIndexMetadata } from "@/lib/seo";
import { FirmHeader } from "./FirmHeader";
import { LinkControls } from "./LinkControls";

export const metadata = { ...noIndexMetadata, title: "Firm dashboard · Haven" };
export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  email_sent: "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)]",
  signed_up: "bg-[var(--haven-sky-light)] text-[var(--haven-ink)]",
  in_progress: "bg-[var(--haven-sky-light)] text-[var(--haven-ink)]",
  finished: "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
};

const TIER_STYLE: Record<UrgencyTier, string> = {
  urgent: "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]",
  soon: "bg-[var(--haven-sand)] text-[var(--haven-ink)]",
  later: "bg-[var(--haven-sky-light)] text-[var(--haven-ink)]",
  unknown: "bg-[var(--haven-cream)] text-[var(--haven-ink-mid)]"
};

export default async function FirmDashboardPage() {
  const membership = await requireFirmMember("/firm");
  const [clients, link] = await Promise.all([
    listFirmClients(membership.firmId),
    getCurrentFirmLink(membership.firmId)
  ]);
  const newCount = clients.filter((c) => c.isNew).length;

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <FirmHeader email={membership.email} firmName={membership.firmName} />
      <main className="content-container-wide space-y-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-label">Firm dashboard</p>
            <h1 className="text-h1 mt-2">{membership.firmName}</h1>
          </div>
          {newCount > 0 ? (
            <p className="rounded-full bg-[var(--haven-ink)] px-3.5 py-1.5 text-body-sm font-semibold text-[var(--haven-cream)]">
              {newCount} new
            </p>
          ) : null}
        </div>

        <LinkControls initialUrl={link ? intakeUrl(link.token) : null} isActive={Boolean(link?.is_active)} />

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)]">
          <div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
            <h2 className="text-h3">Clients</h2>
            <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
              Most urgent first. Priority comes from the dates each client entered, so it&apos;s a heads-up, not a legal
              calculation.
            </p>
          </div>
          {clients.length === 0 ? (
            <p className="text-body-sm px-5 py-8 text-[var(--haven-ink-mid)] sm:px-6">
              No clients yet. Copy your intake link above and send it to a client. They&apos;ll appear here as soon as
              they enter their email.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-body-sm">
                <thead className="text-[12px] uppercase tracking-[0.08em] text-[var(--haven-ink-mid)]">
                  <tr>
                    <th className="px-5 py-3 font-semibold sm:px-6">Priority</th>
                    <th className="px-3 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Visa</th>
                    <th className="px-3 py-3 font-semibold">Why</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Docs</th>
                    <th className="px-3 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr className="border-t border-[var(--color-border)] hover:bg-[var(--haven-cream)]" key={client.id}>
                      <td className="px-5 py-3 sm:px-6">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${TIER_STYLE[client.urgency.tier]}`}>
                          {TIER_LABEL[client.urgency.tier]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href={`/firm/clients/${client.id}`}>
                          {client.displayName}
                        </Link>
                        {client.isNew ? (
                          <span className="ml-2 rounded-full bg-[var(--haven-ink)] px-2 py-0.5 text-[11px] font-semibold text-[var(--haven-cream)]">
                            NEW
                          </span>
                        ) : null}
                        {client.displayName !== client.email ? (
                          <p className="text-[12px] text-[var(--haven-ink-mid)]">{client.email}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{client.visaType ?? "—"}</td>
                      <td className="max-w-[22rem] px-3 py-3 text-[var(--haven-ink)]">
                        {client.status === "email_sent" ? "Hasn't signed up yet" : client.urgency.reason}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_STYLE[client.status]}`}>
                          {FIRM_CLIENT_STATUS_LABEL[client.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3">{client.documentCount}</td>
                      <td className="px-3 py-3">{formatDate(client.joinedAt)}</td>
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

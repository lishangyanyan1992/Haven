"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Filter, Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIRM_CLIENT_STATUS_LABEL } from "@/lib/firms/status";
import { FIRM_PIPELINE_STATUS_LABEL, type FirmPipelineStatus } from "@/lib/firms/types";
import { TIER_LABEL, type UrgencyTier } from "@/lib/firms/urgency";
import type { FirmClientSummary } from "@/lib/firms/clients";
import { ContactQuickActions } from "./ContactQuickActions";
import { PipelineStatusSelect } from "./PipelineStatusSelect";

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

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function LeadsTableWithFilters({ leads }: { leads: FirmClientSummary[] }) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (tierFilter !== "all" && lead.urgency.tier !== tierFilter) return false;
      if (pipelineFilter !== "all" && lead.pipelineStatus !== pipelineFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = lead.displayName?.toLowerCase().includes(query);
        const matchEmail = lead.email?.toLowerCase().includes(query);
        const matchPhone = lead.phone?.toLowerCase().includes(query);
        const matchVisa = lead.visaType?.toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchPhone && !matchVisa) return false;
      }
      return true;
    });
  }, [leads, search, tierFilter, pipelineFilter]);

  const handleExportCsv = () => {
    const headers = [
      "Full Name",
      "Email",
      "Phone",
      "Pipeline Stage",
      "Intake Status",
      "Urgency Priority",
      "Urgency Reason",
      "Visa Type",
      "Document Count",
      "Created Date",
      "Joined Date"
    ];

    const escapeCsv = (val: string | null | undefined) => {
      if (!val) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = filteredLeads.map((l) => [
      escapeCsv(l.fullName || l.displayName),
      escapeCsv(l.email),
      escapeCsv(l.phone || ""),
      escapeCsv(FIRM_PIPELINE_STATUS_LABEL[l.pipelineStatus] || l.pipelineStatus),
      escapeCsv(FIRM_CLIENT_STATUS_LABEL[l.status] || l.status),
      escapeCsv(TIER_LABEL[l.urgency.tier]),
      escapeCsv(l.urgency.reason),
      escapeCsv(l.visaType || "Unknown"),
      escapeCsv(String(l.documentCount)),
      escapeCsv(formatDate(l.createdAt)),
      escapeCsv(formatDate(l.joinedAt))
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.setAttribute("download", `haven-leads-export-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-sm">
      {/* Header and Filter Controls */}
      <div className="border-b border-[var(--color-border)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h3">Prospective Leads ({filteredLeads.length})</h2>
            <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
              Inquiries and active intake. Once a contract is signed, leads move to Retained Clients.
            </p>
          </div>
          <Button
            aria-label="Export leads to CRM spreadsheet"
            className="flex items-center gap-1.5"
            onClick={handleExportCsv}
            variant="outline"
          >
            <Download className="h-4 w-4" />
            Export Leads (CSV)
          </Button>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--haven-ink-mid)]" />
            <Input
              className="pl-8 text-body-sm"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, email, phone..."
              value={search}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--haven-ink-mid)]" />
            <select
              aria-label="Filter by urgency"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-cream)] px-2.5 py-1.5 text-body-sm text-[var(--haven-ink)]"
              onChange={(e) => setTierFilter(e.target.value)}
              value={tierFilter}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="soon">Soon</option>
              <option value="later">Later</option>
              <option value="unknown">Unknown</option>
            </select>

            <select
              aria-label="Filter by pipeline stage"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-cream)] px-2.5 py-1.5 text-body-sm text-[var(--haven-ink)]"
              onChange={(e) => setPipelineFilter(e.target.value)}
              value={pipelineFilter}
            >
              <option value="all">All Pipeline Stages</option>
              <option value="new_lead">New Lead</option>
              <option value="contacted">Contacted</option>
              <option value="consultation_scheduled">Consultation Scheduled</option>
              <option value="consultation_completed">Consultation Completed</option>
              <option value="contract_sent">Contract Sent</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredLeads.length === 0 ? (
        <div className="p-8 text-center text-body-sm text-[var(--haven-ink-mid)]">
          {leads.length === 0
            ? "No active leads yet. Send your intake link above to capture prospective clients."
            : "No leads match your selected filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-body-sm">
            <thead className="text-[12px] uppercase tracking-[0.08em] text-[var(--haven-ink-mid)] bg-[var(--haven-cream)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-5 py-3 font-semibold sm:px-6">Priority</th>
                <th className="px-3 py-3 font-semibold">Lead Name</th>
                <th className="px-3 py-3 font-semibold">Direct Contact (Email & Phone)</th>
                <th className="px-3 py-3 font-semibold">Pipeline Stage</th>
                <th className="px-3 py-3 font-semibold">Visa & Need</th>
                <th className="px-3 py-3 font-semibold">Intake</th>
                <th className="px-3 py-3 font-semibold">Docs</th>
                <th className="px-3 py-3 font-semibold">Added</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr className="border-t border-[var(--color-border)] hover:bg-[var(--haven-cream)] transition" key={lead.id}>
                  <td className="px-5 py-3 sm:px-6">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${TIER_STYLE[lead.urgency.tier]}`}>
                      {TIER_LABEL[lead.urgency.tier]}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <Link
                      className="font-semibold text-[var(--haven-ink)] underline-offset-4 hover:underline text-body"
                      href={`/firm/clients/${lead.id}`}
                    >
                      {lead.displayName}
                    </Link>
                    {lead.isNew ? (
                      <span className="ml-2 rounded-full bg-[var(--haven-ink)] px-2 py-0.5 text-[11px] font-semibold text-[var(--haven-cream)]">
                        NEW
                      </span>
                    ) : null}
                  </td>

                  <td className="px-3 py-3">
                    <ContactQuickActions email={lead.email} phone={lead.phone} size="sm" />
                  </td>

                  <td className="px-3 py-3">
                    <PipelineStatusSelect
                      firmClientId={lead.id}
                      initialStatus={lead.pipelineStatus}
                    />
                  </td>

                  <td className="px-3 py-3 max-w-[16rem]">
                    <div className="font-medium text-[var(--haven-ink)]">{lead.visaType ?? "Visa: —"}</div>
                    <p className="text-[12px] text-[var(--haven-ink-mid)] truncate" title={lead.urgency.reason}>
                      {lead.status === "email_sent" ? "Awaiting signup" : lead.urgency.reason}
                    </p>
                  </td>

                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_STYLE[lead.status]}`}>
                      {FIRM_CLIENT_STATUS_LABEL[lead.status]}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <span className="font-medium text-[var(--haven-ink)]">{lead.documentCount}</span>
                  </td>

                  <td className="px-3 py-3 text-[var(--haven-ink-mid)]">
                    {formatDate(lead.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

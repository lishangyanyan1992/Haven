import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireFirmMember } from "@/lib/firms/access";
import { getFirmClient, markFirmClientReviewed } from "@/lib/firms/clients";
import { FIRM_CLIENT_STATUS_LABEL } from "@/lib/firms/status";
import { noIndexMetadata } from "@/lib/seo";
import { FirmHeader } from "../../FirmHeader";
import { OpenDocumentButton } from "./OpenDocumentButton";

export const metadata = { ...noIndexMetadata, title: "Client · Haven" };
export const dynamic = "force-dynamic";

const LABELS: Record<string, Record<string, string>> = {
  perm_stage: { not_started: "Not started", in_progress: "In progress", certified: "Certified", denied: "Denied" },
  employment_status: { employed: "Employed", actively_searching: "Looking for work", laid_off: "Laid off" },
  primary_goal: {
    get_gc: "Get a green card",
    job_stability: "Job stability",
    explore_options: "Explore options",
    stay_flexible: "Stay flexible",
    not_sure: "Not sure"
  },
  spouse_visa_status: { none: "No spouse / not applicable", other: "Other" },
  top_concerns: {
    layoffs: "Layoffs",
    visa_expiry: "Visa expiring",
    gc_timeline: "Green card timeline",
    job_change: "Changing jobs",
    other: "Other"
  }
};

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function text(field: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const items = value.map((v) => LABELS[field]?.[String(v)] ?? String(v)).filter(Boolean);
    return items.length ? items.join(", ") : null;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const raw = String(value).trim();
  if (!raw) return null;
  return LABELS[field]?.[raw] ?? raw;
}

type Row = { label: string; value: string | null };

/**
 * Group answers the way the setup steps do. A step's answers count only once
 * that step was saved, because new accounts start with placeholder values.
 */
function answerGroups(p: Record<string, any> | null, finished: boolean): { title: string; rows: Row[] }[] {
  const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
  const profileSaved = Boolean(p && has(p.country_of_birth));
  const workSaved = Boolean(p && (has(p.employer_name) || has(p.job_title) || has(p.h1b_start_date)));
  const gcSaved = Boolean(
    p && ((p.preference_category && p.preference_category !== "Not sure") || has(p.priority_date) || p.perm_stage !== "not_started")
  );
  const situationSaved = Boolean(p && (finished || p.spouse_visa_status !== "none" || (p.top_concerns ?? []).length > 0));
  const gate = (saved: boolean, value: string | null) => (saved ? value : null);

  return [
    {
      title: "Profile",
      rows: [
        { label: "Visa", value: gate(profileSaved, text("visa_type", p?.visa_type)) },
        { label: "Country of birth", value: gate(profileSaved, text("country_of_birth", p?.country_of_birth)) },
        { label: "Visa expires", value: gate(profileSaved, formatDate(p?.current_visa_expiry_date)) },
        { label: "Main goal", value: gate(profileSaved, text("primary_goal", p?.primary_goal)) }
      ]
    },
    {
      title: "Employment",
      rows: [
        { label: "Employer", value: gate(workSaved, text("employer_name", p?.employer_name)) },
        { label: "Job title", value: gate(workSaved, text("job_title", p?.job_title)) },
        { label: "Employer size", value: gate(workSaved, text("employer_size", p?.employer_size)) },
        { label: "Work status", value: gate(workSaved, text("employment_status", p?.employment_status)) },
        { label: "H-1B start date", value: gate(workSaved, formatDate(p?.h1b_start_date)) }
      ]
    },
    {
      title: "Green card",
      rows: [
        { label: "PERM stage", value: gate(gcSaved, text("perm_stage", p?.perm_stage)) },
        { label: "PERM filed", value: gate(gcSaved, formatDate(p?.perm_filing_date)) },
        { label: "Category", value: gate(gcSaved, text("preference_category", p?.preference_category)) },
        { label: "Priority date", value: gate(gcSaved, formatDate(p?.priority_date)) },
        { label: "I-140 approved", value: gate(gcSaved, text("i140_approved", p?.i140_approved)) },
        { label: "I-485 filed", value: gate(gcSaved, text("i485_filed", p?.i485_filed)) }
      ]
    },
    {
      title: "Situation",
      rows: [
        { label: "Spouse's status", value: gate(situationSaved, text("spouse_visa_status", p?.spouse_visa_status)) },
        { label: "Main concerns", value: gate(situationSaved, text("top_concerns", p?.top_concerns)) }
      ]
    }
  ];
}

export default async function FirmClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireFirmMember(`/firm/clients/${id}`);
  const client = await getFirmClient(membership.firmId, id);

  if (!client) {
    return (
      <div className="min-h-screen bg-[var(--haven-cream)]">
        <FirmHeader email={membership.email} firmName={membership.firmName} />
        <main className="content-container-wide py-10">
          <h1 className="text-h1">Client not found</h1>
          <Link className="text-body-sm mt-4 inline-block underline underline-offset-4" href="/firm">
            Back to clients
          </Link>
        </main>
      </div>
    );
  }

  await markFirmClientReviewed(membership.firmId, client.id);
  const name = (client.profile?.full_name as string | undefined)?.trim() || client.email;
  const groups = answerGroups(client.profile as Record<string, any> | null, client.status === "finished");

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <FirmHeader email={membership.email} firmName={membership.firmName} />
      <main className="content-container-wide space-y-6 py-8">
        <Link className="inline-flex items-center gap-1.5 text-body-sm text-[var(--haven-ink-mid)] hover:text-[var(--haven-ink)]" href="/firm">
          <ArrowLeft className="h-4 w-4" />
          All clients
        </Link>

        <div>
          <h1 className="text-h1">{name}</h1>
          <p className="text-body-sm mt-2 text-[var(--haven-ink-mid)]">
            {client.email} · {FIRM_CLIENT_STATUS_LABEL[client.status]}
            {client.joinedAt ? ` · joined ${formatDate(client.joinedAt)}` : ""}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6" key={group.title}>
              <h2 className="text-h3">{group.title}</h2>
              <dl className="mt-3 space-y-2">
                {group.rows.map((row) => (
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-[var(--color-border)] pt-2 first:border-t-0 first:pt-0" key={row.label}>
                    <dt className="text-body-sm text-[var(--haven-ink-mid)]">{row.label}</dt>
                    <dd className={`text-body-sm ${row.value ? "text-[var(--haven-ink)]" : "text-[var(--haven-ink-mid)] italic"}`}>
                      {row.value ?? "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
          <h2 className="text-h3">Documents</h2>
          {client.documents.length === 0 ? (
            <p className="text-body-sm mt-3 text-[var(--haven-ink-mid)]">No documents uploaded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-border)]">
              {client.documents.map((doc) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={doc.id}>
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-[var(--haven-ink)]">{doc.name}</p>
                    <p className="text-[12px] text-[var(--haven-ink-mid)]">
                      {doc.kind} · uploaded {formatDate(doc.uploadedAt)}
                    </p>
                  </div>
                  <OpenDocumentButton documentId={doc.id} firmClientId={client.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

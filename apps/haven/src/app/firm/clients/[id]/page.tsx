import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireFirmMember } from "@/lib/firms/access";
import type { SharedAnswerKey, SharedAnswers } from "@/lib/firms/answers";
import { getFirmClient, markFirmClientReviewed } from "@/lib/firms/clients";
import { FIRM_CLIENT_STATUS_LABEL } from "@/lib/firms/status";
import { rankUrgency, TIER_LABEL } from "@/lib/firms/urgency";
import { noIndexMetadata } from "@/lib/seo";
import { FirmHeader } from "../../FirmHeader";
import { OpenDocumentButton } from "./OpenDocumentButton";

export const metadata = { ...noIndexMetadata, title: "Client · Haven" };
export const dynamic = "force-dynamic";

const LABELS: Record<string, Record<string, string>> = {
  primaryGoal: {
    get_gc: "Get a green card",
    job_stability: "Stay stable at current employer",
    explore_options: "Explore all options",
    stay_flexible: "Maximize flexibility",
    not_sure: "Not sure yet"
  },
  employerSize: { startup: "Startup (under 200)", "mid-size": "Mid-size (200–2,000)", enterprise: "Enterprise (2,000+)" },
  greenCardStage: {
    not_started: "Not started yet",
    perm_in_progress: "PERM in progress",
    perm_certified: "PERM certified",
    i140_filed: "I-140 filed",
    i140_approved: "I-140 approved",
    i485_filed: "I-485 filed"
  },
  spouseVisaStatus: {
    none: "No spouse / not applicable",
    H1B: "On H-1B",
    H4: "On H-4",
    "H4 EAD": "On H-4 EAD",
    GC: "Green card holder",
    citizen: "US citizen",
    other: "Other"
  },
  jobEnded: { yes: "Yes", no: "No" },
  travelPlanned: { yes: "Yes", no: "No" },
  agencyDeadlineType: {
    rfe: "Request for evidence (RFE) response",
    interview: "Interview",
    biometrics: "Biometrics appointment",
    other: "Other deadline"
  },
  topConcerns: {
    layoffs: "Layoffs",
    visa_expiry: "Visa expiring",
    gc_timeline: "Green card timeline",
    job_change: "Changing jobs",
    other: "Other"
  }
};

const DATE_KEYS = new Set(["h1bStartDate", "priorityDate", "statusEndDate", "lastWorkDay", "agencyDeadlineDate", "travelDate"]);

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** One answer in plain words, or null if the client didn't give it. */
function answer(answers: SharedAnswers, key: SharedAnswerKey): string | null {
  const value = answers[key];
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const items = value.map((v) => LABELS[key]?.[v] ?? v).filter(Boolean);
    return items.length ? items.join(", ") : null;
  }
  if (!value.trim()) return null;
  if (DATE_KEYS.has(key)) return formatDate(value);
  return LABELS[key]?.[value] ?? value;
}

/** Grouped the way the setup steps group them. */
const GROUPS: { title: string; rows: [string, SharedAnswerKey][] }[] = [
  { title: "Profile", rows: [["Visa", "visaType"], ["Country of birth", "countryOfBirth"], ["Main goal", "primaryGoal"]] },
  {
    title: "Employment",
    rows: [["Employer", "employerName"], ["Job title", "jobTitle"], ["Employer size", "employerSize"], ["H-1B start date", "h1bStartDate"]]
  },
  { title: "Green card", rows: [["Stage", "greenCardStage"], ["Category", "preferenceCategory"], ["Priority date", "priorityDate"]] },
  { title: "Situation", rows: [["Spouse's status", "spouseVisaStatus"], ["Main concerns", "topConcerns"]] },
  {
    title: "Deadlines",
    rows: [
      ["Status ends", "statusEndDate"],
      ["Job ended or ending", "jobEnded"],
      ["Last day of work", "lastWorkDay"],
      ["USCIS or consulate deadline", "agencyDeadlineType"],
      ["Deadline date", "agencyDeadlineDate"],
      ["Travel planned", "travelPlanned"],
      ["Departure date", "travelDate"]
    ]
  }
];

/** "Not sure" counts as an answer to when status ends. */
function deadlineAnswer(answers: SharedAnswers, key: SharedAnswerKey) {
  if (key === "statusEndDate" && !answers.statusEndDate && answers.statusEndUnknown === "yes") return "Not sure";
  return answer(answers, key);
}

export default async function FirmClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireFirmMember(`/firm/clients/${id}`);
  const client = await getFirmClient(membership.firmId, id);

  if (!client) {
    return (
      <div className="min-h-screen bg-[var(--haven-cream)]">
        <FirmHeader email={membership.email} firmName={membership.firmName} isDemo={membership.isDemo} />
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
  const fullName = typeof client.answers.fullName === "string" ? client.answers.fullName.trim() : "";
  const name = fullName || client.email;
  const urgency = rankUrgency(client.answers);
  const groups = GROUPS.map((group) => ({
    title: group.title,
    rows: group.rows.map(([label, key]) => ({ label, value: deadlineAnswer(client.answers, key) }))
  }));

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <FirmHeader email={membership.email} firmName={membership.firmName} isDemo={membership.isDemo} />
      <main className="content-container-wide space-y-6 py-8">
        <Link className="inline-flex items-center gap-1.5 text-body-sm text-[var(--haven-ink-mid)] hover:text-[var(--haven-ink)]" href="/firm">
          <ArrowLeft className="h-4 w-4" />
          All clients
        </Link>

        <div>
          <p className="text-label">
            {TIER_LABEL[urgency.tier]} priority
          </p>
          <h1 className="text-h1 mt-2">{name}</h1>
          {fullName && fullName !== client.email ? (
            <p className="text-body-sm text-[var(--haven-ink-mid)]">{client.email}</p>
          ) : null}
          <p className="text-body mt-2 text-[var(--haven-ink)]">{urgency.reason}</p>
          <p className="text-body-sm mt-2 text-[var(--haven-ink-mid)]">
            {FIRM_CLIENT_STATUS_LABEL[client.status]}
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

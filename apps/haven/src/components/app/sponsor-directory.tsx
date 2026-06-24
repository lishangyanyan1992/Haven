"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, BriefcaseBusiness, Building2, MapPin, MessageSquareText, PlusCircle, Search } from "lucide-react";

import { submitSponsorFeedback, type SponsorFeedbackActionState } from "@/server/sponsor-directory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SponsorRole = {
  count: number;
  title: string;
};

type SponsorLocation = {
  count: number;
  location: string;
};

export type SponsorCompany = {
  certifiedLcaCountFy2026Q2: number;
  certifiedOnlyLcaCountFy2026Q2: number;
  companyName: string;
  deniedLcaCountFy2026Q2: number;
  h1bTransferPositionsFy2026Q2: number;
  id: string;
  latestDecisionDate: string | null;
  medianAnnualWage: number | null;
  sponsorScore: number;
  topLocations: SponsorLocation[];
  topRoles: SponsorRole[];
  topSocTitles: SponsorRole[];
  totalWorkerPositionsFy2026Q2: number;
  uscisApprovalsFy2023: number;
  uscisContinuingApprovalsFy2023: number;
  uscisDenialsFy2023: number;
  uscisInitialApprovalsFy2023: number;
  website: string;
};

type SponsorDirectoryProps = {
  companies: SponsorCompany[];
};

const sortOptions = [
  { label: "Sponsor signal", value: "score" },
  { label: "Recent LCA volume", value: "lca" },
  { label: "H-1B transfer signal", value: "transfer" },
  { label: "USCIS approvals", value: "uscis" },
  { label: "Median wage", value: "wage" }
] as const;

const initialFeedbackState: SponsorFeedbackActionState = {
  message: "",
  status: "idle"
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(value: number | null) {
  if (value == null) return "Not enough data";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function companySearchText(company: SponsorCompany) {
  return [
    company.companyName,
    ...company.topRoles.map((role) => role.title),
    ...company.topSocTitles.map((role) => role.title),
    ...company.topLocations.map((location) => location.location)
  ]
    .join(" ")
    .toLowerCase();
}

function getSortValue(company: SponsorCompany, sortBy: string) {
  switch (sortBy) {
    case "lca":
      return company.certifiedLcaCountFy2026Q2;
    case "transfer":
      return company.h1bTransferPositionsFy2026Q2;
    case "uscis":
      return company.uscisApprovalsFy2023;
    case "wage":
      return company.medianAnnualWage ?? 0;
    default:
      return company.sponsorScore;
  }
}

export function SponsorDirectory({ companies }: SponsorDirectoryProps) {
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]["value"]>("score");

  const locationOptions = useMemo(() => {
    const states = new Set<string>();
    for (const company of companies) {
      for (const location of company.topLocations) {
        const state = location.location.split(", ").at(-1)?.trim();
        if (state && state.length <= 2) states.add(state);
      }
    }
    return [...states].sort();
  }, [companies]);

  const visibleCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return companies
      .filter((company) => {
        const matchesQuery = normalizedQuery ? companySearchText(company).includes(normalizedQuery) : true;
        const matchesLocation =
          locationFilter === "all" ||
          company.topLocations.some((location) => location.location.endsWith(`, ${locationFilter}`));
        return matchesQuery && matchesLocation;
      })
      .sort((left, right) => {
        const delta = getSortValue(right, sortBy) - getSortValue(left, sortBy);
        if (delta !== 0) return delta;
        return left.companyName.localeCompare(right.companyName);
      });
  }, [companies, locationFilter, query, sortBy]);

  return (
    <section className="space-y-6">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 md:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_210px]">
          <label className="relative block">
            <span className="sr-only">Search companies, roles, or cities</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, role, or city"
              value={query}
            />
          </label>
          <label>
            <span className="sr-only">Filter by state</span>
            <Select onChange={(event) => setLocationFilter(event.target.value)} value={locationFilter}>
              <option value="all">All states</option>
              {locationOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Sort sponsor directory</span>
            <Select onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-body-sm text-[var(--color-text-secondary)]">
          <ArrowUpDown className="h-4 w-4" />
          Showing {visibleCompanies.length} of {companies.length} sponsor-history profiles.
        </div>
      </div>

      <details className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-white)] text-[var(--haven-sky-ink)]">
            <PlusCircle className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-h3">Do not see a company?</span>
            <span className="mt-1 block text-body-sm text-[var(--color-text-secondary)]">
              Suggest a sponsor to review for this directory.
            </span>
          </span>
        </summary>
        <div className="mt-5 max-w-3xl">
          <SponsorFeedbackForm kind="new_company" />
        </div>
      </details>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleCompanies.map((company) => (
          <article
            className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-[0_8px_28px_-16px_rgba(44,54,48,0.16)] scroll-mt-28"
            id={`company-${company.id}`}
            key={company.id}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
                    <Building2 className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-h2 truncate">{company.companyName}</h2>
                    <p className="text-caption mt-1">Latest LCA decision: {formatDate(company.latestDecisionDate)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-center">
                <p className="text-caption">Sponsor signal</p>
                <p className="text-h2 mt-1">{company.sponsorScore}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <Metric label="FY26 LCA" value={formatNumber(company.certifiedLcaCountFy2026Q2)} />
              <Metric label="Transfer positions" value={formatNumber(company.h1bTransferPositionsFy2026Q2)} />
              <Metric label="FY23 approvals" value={formatNumber(company.uscisApprovalsFy2023)} />
              <Metric label="Median wage" value={formatCurrency(company.medianAnnualWage)} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <InfoList
                icon={BriefcaseBusiness}
                items={company.topRoles.slice(0, 3).map((role) => `${role.title} · ${formatNumber(role.count)}`)}
                label="Common roles"
              />
              <InfoList
                icon={MapPin}
                items={company.topLocations.slice(0, 3).map((location) => `${location.location} · ${formatNumber(location.count)}`)}
                label="Top worksites"
              />
            </div>

            <details className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-body-sm font-medium text-[var(--haven-ink)] [&::-webkit-details-marker]:hidden">
                <MessageSquareText className="h-4 w-4" />
                Leave a sponsorship note
              </summary>
              <div className="mt-4">
                <SponsorFeedbackForm company={company} kind="company_comment" />
              </div>
            </details>
          </article>
        ))}
      </div>

      {visibleCompanies.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
          <p className="text-h3">No sponsor profiles match that search.</p>
          <p className="text-body-sm mt-2">Try a company name, role family, city, or another state filter.</p>
        </div>
      ) : null}
    </section>
  );
}

function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-body-sm font-medium text-[var(--haven-ink)]">{label}</span>
      {children}
      {hint ? <span className="block text-caption">{hint}</span> : null}
    </label>
  );
}

function SponsorFeedbackForm({
  company,
  kind
}: {
  company?: Pick<SponsorCompany, "companyName" | "id">;
  kind: "company_comment" | "new_company";
}) {
  const [state, formAction, pending] = useActionState(submitSponsorFeedback, initialFeedbackState);
  const isNewCompany = kind === "new_company";

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4">
        <p className="text-body-sm font-medium text-[var(--haven-ink)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="feedback_kind" type="hidden" value={kind} />
      {company ? (
        <>
          <input name="company_id" type="hidden" value={company.id} />
          <input name="company_name" type="hidden" value={company.companyName} />
        </>
      ) : null}

      {isNewCompany ? (
        <>
          <Field label="Company name">
            <Input name="company_name" placeholder="Company or employer name" required />
          </Field>
          <Field
            label="Company website"
            hint="Use the careers or company homepage. We match on the website's root domain to avoid duplicates."
          >
            <Input name="company_website" placeholder="https://example.com" required type="url" />
          </Field>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your connection">
          <Select name="relationship" defaultValue="candidate">
            <option value="candidate">Candidate / applicant</option>
            <option value="employee">Current employee</option>
            <option value="former_employee">Former employee</option>
            <option value="recruiter">Recruiter</option>
            <option value="immigration_team">Immigration or HR team</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Email (optional)" hint="Only used if we need to verify the note.">
          <Input name="submitter_email" placeholder="you@example.com" type="email" />
        </Field>
      </div>

      <Field
        label={isNewCompany ? "Why should this company be added?" : "What should others know?"}
        hint="Do not include private names, case numbers, or confidential employer documents."
      >
        <Textarea
          name="comment"
          placeholder={
            isNewCompany
              ? "Share the role, location, sponsorship signal, or official source we should review."
              : "Share sponsorship policy, recruiter signal, transfer friendliness, timing, or caveats."
          }
          required
          rows={3}
        />
      </Field>

      {state.status === "error" ? (
        <div className="space-y-2">
          <p className="text-body-sm text-[var(--haven-blush-ink)]">{state.message}</p>
          {state.existingCompany ? (
            <Link
              className="text-body-sm font-medium text-[var(--haven-sky-ink)] underline underline-offset-4"
              href={`/jobs#company-${state.existingCompany.id}`}
            >
              Open {state.existingCompany.name}&rsquo;s record &rarr;
            </Link>
          ) : null}
        </div>
      ) : null}

      <Button disabled={pending} type="submit" variant={isNewCompany ? "accent" : "outline"}>
        {pending ? "Sending..." : isNewCompany ? "Suggest company" : "Submit note"}
      </Button>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--haven-cream)] p-3">
      <p className="text-caption">{label}</p>
      <p className="text-body-sm mt-1 font-medium text-[var(--haven-ink)]">{value}</p>
    </div>
  );
}

function InfoList({
  icon: Icon,
  items,
  label
}: {
  icon: typeof BriefcaseBusiness;
  items: string[];
  label: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-label">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-body-sm" key={item}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

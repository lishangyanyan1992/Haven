"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpDown, BadgeCheck, Globe, Languages, MapPin, MessageSquareText, PlusCircle, Scale, Search, Star } from "lucide-react";

import { submitLegalFeedback, type LegalFeedbackActionState } from "@/server/legal-directory-actions";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TrustSignalExplainer } from "@/components/app/trust-signal-explainer";

export type ClaimStatus = "unclaimed" | "pending" | "claimed";

export type FirmEvidence = {
  ailaUrl?: string | null;
  barUrl?: string | null;
  specialistUrl?: string | null;
  website?: string | null;
};

// Firm-provided details shown on a claimed profile (never "Haven-verified").
export type ClaimProfile = {
  ailaMember?: boolean;
  bio?: string | null;
  bookingUrl?: string | null;
  certifiedSpecialist?: boolean;
  certifiedSpecialistState?: string | null;
  consultation?: string | null; // "Free" | "Paid"
  consultationFee?: string | null;
  feeRange?: string | null;
  hardCases?: string[];
  languages?: string[];
  pricingStructure?: string | null; // "Flat fee" | "Hourly" | "Mixed"
  virtualAvailability?: boolean;
  visaTypes?: string[];
  yearsInPractice?: string | null;
};

export type LawFirm = {
  ailaMember: boolean;
  barVerified: { barNumber: string | null; noDiscipline: boolean; state: string; status: string } | null;
  city: string;
  claimProfile?: ClaimProfile | null;
  claimStatus?: ClaimStatus;
  claimedAt?: string | null;
  evidence?: FirmEvidence | null;
  firmName: string;
  firmSizeBucket: "solo" | "2-5" | "6-20";
  id: string;
  languagesSpoken: string[];
  metro: string;
  phone: string | null;
  practiceFocus: string[];
  rating: number | null;
  reviewCount: number | null;
  sizeConfidence: "high" | "low";
  sources: string[];
  state: string;
  trustScore: number;
  verifiedAsOf: string;
  website: string;
};

type LegalDirectoryProps = {
  firms: LawFirm[];
};

const sortOptions = [
  { label: "Trust signal", value: "trust" },
  { label: "Client rating", value: "rating" },
  { label: "Review volume", value: "reviews" }
] as const;

const initialFeedbackState: LegalFeedbackActionState = {
  message: "",
  status: "idle"
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function ensureHttp(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function formatWebsiteHost(url: string) {
  try {
    return new URL(ensureHttp(url)).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

function firmSearchText(firm: LawFirm) {
  return [firm.firmName, firm.metro, firm.city, firm.state, ...firm.practiceFocus, ...firm.languagesSpoken]
    .join(" ")
    .toLowerCase();
}

function getSortValue(firm: LawFirm, sortBy: string) {
  switch (sortBy) {
    case "rating":
      return firm.rating ?? 0;
    case "reviews":
      return firm.reviewCount ?? 0;
    default:
      return firm.trustScore;
  }
}

export function LegalDirectory({ firms }: LegalDirectoryProps) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [practiceFilter, setPracticeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]["value"]>("trust");

  const stateOptions = useMemo(() => [...new Set(firms.map((firm) => firm.state))].sort(), [firms]);
  const practiceOptions = useMemo(
    () => [...new Set(firms.flatMap((firm) => firm.practiceFocus))].sort(),
    [firms]
  );
  const languageOptions = useMemo(
    () => [...new Set(firms.flatMap((firm) => firm.languagesSpoken))].filter((lang) => lang !== "English").sort(),
    [firms]
  );

  const visibleFirms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return firms
      .filter((firm) => {
        const matchesQuery = normalizedQuery ? firmSearchText(firm).includes(normalizedQuery) : true;
        const matchesState = stateFilter === "all" || firm.state === stateFilter;
        const matchesPractice = practiceFilter === "all" || firm.practiceFocus.includes(practiceFilter);
        const matchesLanguage = languageFilter === "all" || firm.languagesSpoken.includes(languageFilter);
        return matchesQuery && matchesState && matchesPractice && matchesLanguage;
      })
      .sort((left, right) => {
        const delta = getSortValue(right, sortBy) - getSortValue(left, sortBy);
        if (delta !== 0) return delta;
        return left.firmName.localeCompare(right.firmName);
      });
  }, [firms, languageFilter, practiceFilter, query, sortBy, stateFilter]);

  return (
    <section className="space-y-6">
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 md:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_180px]">
          <label className="relative block lg:col-span-1">
            <span className="sr-only">Search firms, cities, practice areas, or languages</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search firm, city, practice area, or language"
              value={query}
            />
          </label>
          <label>
            <span className="sr-only">Filter by state</span>
            <Select onChange={(event) => setStateFilter(event.target.value)} value={stateFilter}>
              <option value="all">All states</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Sort directory</span>
            <Select onChange={(event) => setSortBy(event.target.value as typeof sortBy)} value={sortBy}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sort: {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="sr-only">Filter by practice area</span>
            <Select onChange={(event) => setPracticeFilter(event.target.value)} value={practiceFilter}>
              <option value="all">All practice areas</option>
              {practiceOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Filter by language</span>
            <Select onChange={(event) => setLanguageFilter(event.target.value)} value={languageFilter}>
              <option value="all">Any language</option>
              {languageOptions.map((language) => (
                <option key={language} value={language}>
                  Speaks {language}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-body-sm text-[var(--color-text-secondary)]">
          <ArrowUpDown className="h-4 w-4" />
          Showing {visibleFirms.length} of {firms.length} immigration firms.
        </div>
      </div>

      <details className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-white)] text-[var(--haven-sky-ink)]">
            <PlusCircle className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-h3">Know a firm we should add?</span>
            <span className="mt-1 block text-body-sm text-[var(--color-text-secondary)]">
              Suggest a small immigration firm to review for this directory.
            </span>
          </span>
        </summary>
        <div className="mt-5 max-w-3xl">
          <LegalFeedbackForm kind="new_firm" />
        </div>
      </details>

      <div className="grid gap-4 xl:grid-cols-2">
        {visibleFirms.map((firm) => (
          <article
            className="min-w-0 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-[0_8px_28px_-16px_rgba(44,54,48,0.16)] scroll-mt-28"
            id={`firm-${firm.id}`}
            key={firm.id}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
                    <Scale className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-h2 break-words">{firm.firmName}</h2>
                    <p className="text-caption mt-1 inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {firm.city}, {firm.state}
                    </p>
                    {firm.website ? (
                      <a
                        className="mt-1 flex max-w-full items-center gap-1 text-body-sm font-medium text-[var(--haven-sky-ink)] underline-offset-4 hover:underline"
                        href={ensureHttp(firm.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 break-all">{formatWebsiteHost(firm.website)}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="w-full min-w-0 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-center md:w-auto">
                <p className="text-caption inline-flex items-center justify-center gap-1">
                  Trust signal
                  <InfoTooltip label="How the trust signal is calculated" align="end">
                    <TrustSignalExplainer />
                  </InfoTooltip>
                </p>
                <p className="text-h2 mt-1">{firm.trustScore}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {firm.barVerified ? (
                <span className="tag tag-active inline-flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {firm.barVerified.state} bar verified
                </span>
              ) : null}
              {firm.ailaMember ? (
                <span className="tag tag-active inline-flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  AILA member
                </span>
              ) : null}
              {firm.rating != null ? (
                <span className="tag tag-pending inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" />
                  {firm.rating.toFixed(1)}
                  {firm.reviewCount != null ? ` · ${formatNumber(firm.reviewCount)} reviews` : ""}
                </span>
              ) : null}
              {firm.claimStatus === "claimed" ? (
                <span className="tag tag-visa inline-flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Claimed by firm
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
              <InfoList icon={Scale} items={firm.practiceFocus} label="Practice focus" />
              <InfoList icon={Languages} items={firm.languagesSpoken} label="Languages spoken" />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                className="inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-sky-ink)] underline-offset-4 hover:underline"
                href={`/lawyers/${firm.id}`}
              >
                View firm profile
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {firm.claimStatus !== "claimed" ? (
                <Link
                  className="inline-flex items-center gap-1 text-body-sm text-[var(--haven-ink-mid)] underline-offset-4 hover:text-[var(--haven-ink)] hover:underline"
                  href={`/lawyers/${firm.id}/claim`}
                >
                  Are you this firm? Claim it
                </Link>
              ) : null}
            </div>

            <details className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-body-sm font-medium text-[var(--haven-ink)] [&::-webkit-details-marker]:hidden">
                <MessageSquareText className="h-4 w-4" />
                Share your experience
              </summary>
              <div className="mt-4">
                <LegalFeedbackForm firm={firm} kind="firm_comment" />
              </div>
            </details>
          </article>
        ))}
      </div>

      {visibleFirms.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
          <p className="text-h3">No firms match those filters.</p>
          <p className="text-body-sm mt-2">Try another state, practice area, language, or firm size.</p>
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

function LegalFeedbackForm({
  firm,
  kind
}: {
  firm?: Pick<LawFirm, "firmName" | "id">;
  kind: "firm_comment" | "new_firm";
}) {
  const [state, formAction, pending] = useActionState(submitLegalFeedback, initialFeedbackState);
  const isNewFirm = kind === "new_firm";

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
      {firm ? (
        <>
          <input name="firm_id" type="hidden" value={firm.id} />
          <input name="firm_name" type="hidden" value={firm.firmName} />
        </>
      ) : null}

      {isNewFirm ? (
        <>
          <Field label="Firm name">
            <Input name="firm_name" placeholder="Immigration law firm name" required />
          </Field>
          <Field
            label="Firm website"
            hint="Use the firm homepage. We match on the website's root domain to avoid duplicates."
          >
            <Input name="firm_website" placeholder="https://example.com" required type="url" />
          </Field>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your connection">
          <Select name="relationship" defaultValue="client">
            <option value="client">Former / current client</option>
            <option value="prospective_client">Prospective client</option>
            <option value="attorney">Attorney at the firm</option>
            <option value="referral">Referral source</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Email (optional)" hint="Only used if we need to verify the note.">
          <Input name="submitter_email" placeholder="you@example.com" type="email" />
        </Field>
      </div>

      <Field
        label={isNewFirm ? "Why should this firm be added?" : "What should others know?"}
        hint="Do not include private case numbers, A-numbers, or confidential documents."
      >
        <Textarea
          name="comment"
          placeholder={
            isNewFirm
              ? "Share the firm's practice focus, location, languages, and why you trust them."
              : "Share responsiveness, pricing transparency, visa expertise, languages, or caveats."
          }
          required
          rows={3}
        />
      </Field>

      {state.status === "error" ? (
        <div className="space-y-2">
          <p className="text-body-sm text-[var(--haven-blush-ink)]">{state.message}</p>
          {state.existingFirm ? (
            <Link
              className="text-body-sm font-medium text-[var(--haven-sky-ink)] underline underline-offset-4"
              href={`/lawyers#firm-${state.existingFirm.id}`}
            >
              Open {state.existingFirm.name}&rsquo;s record &rarr;
            </Link>
          ) : null}
        </div>
      ) : null}

      <Button disabled={pending} type="submit" variant={isNewFirm ? "accent" : "outline"}>
        {pending ? "Sending..." : isNewFirm ? "Suggest firm" : "Submit note"}
      </Button>
    </form>
  );
}

function InfoList({
  icon: Icon,
  items,
  label
}: {
  icon: typeof Scale;
  items: string[];
  label: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-label">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 py-1 text-body-sm break-words"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

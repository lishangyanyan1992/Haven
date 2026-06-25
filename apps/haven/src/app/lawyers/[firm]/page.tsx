import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Globe, Languages, Phone, Scale, Star } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import {
  getFirmPath,
  getLawFirms,
  getLegalGeneratedAt,
  getLegalSources
} from "@/lib/legal-directory";
import { getMergedFirm } from "@/server/legal-claims";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, siteIdentity } from "@/lib/site";

// Existing 60 prerender; applied (DB-listed) firms render on demand. Revalidate
// so a published claim/listing appears within a minute.
export const dynamicParams = true;
export const revalidate = 60;

type FirmPageProps = {
  params: Promise<{ firm: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

export function generateStaticParams() {
  return getLawFirms().map((firm) => ({ firm: firm.id }));
}

export async function generateMetadata({ params }: FirmPageProps): Promise<Metadata> {
  const { firm: firmId } = await params;
  const firm = await getMergedFirm(firmId);

  if (!firm) {
    return { title: "Firm not found — Haven Immigration Lawyer Directory" };
  }

  const title = `${firm.firmName} — Immigration Lawyer in ${firm.city}, ${firm.state}`;
  const description = `${firm.firmName} is a small immigration firm in ${firm.city}, ${firm.state} handling ${firm.practiceFocus.slice(0, 4).join(", ")}. Languages: ${firm.languagesSpoken.join(", ")}.`;
  const url = getFirmPath(firm.id);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { url: absoluteUrl(url).toString(), title, description },
    twitter: { title, description }
  };
}

export default async function FirmPage({ params }: FirmPageProps) {
  const { firm: firmId } = await params;
  const firm = await getMergedFirm(firmId);

  if (!firm) {
    notFound();
  }

  const claim = firm.claimStatus === "claimed" ? firm.claimProfile ?? null : null;
  const evidence = firm.claimStatus === "claimed" ? firm.evidence ?? null : null;

  const generatedAt = getLegalGeneratedAt();
  const sources = getLegalSources();

  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Immigration Lawyer Directory", path: "/lawyers" },
    { name: firm.firmName, path: getFirmPath(firm.id) }
  ]);

  const legalServiceData = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    name: firm.firmName,
    url: firm.website ? ensureHttp(firm.website) : undefined,
    telephone: firm.phone ?? undefined,
    description: `${firm.firmName} is a small U.S. immigration law firm in ${firm.city}, ${firm.state} handling ${firm.practiceFocus.join(", ")}.`,
    areaServed: { "@type": "Country", name: "United States" },
    address: {
      "@type": "PostalAddress",
      addressLocality: firm.city,
      addressRegion: firm.state,
      addressCountry: "US"
    },
    knowsLanguage: firm.languagesSpoken,
    knowsAbout: firm.practiceFocus,
    ...(firm.rating != null && firm.reviewCount != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: firm.rating,
            reviewCount: firm.reviewCount,
            bestRating: 5
          }
        }
      : {}),
    subjectOf: {
      "@type": "Dataset",
      name: `${firm.firmName} directory listing`,
      dateModified: generatedAt,
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: siteIdentity.name, url: siteIdentity.url }
    }
  };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(legalServiceData) }} />
      <PublicNavbar currentPath="/lawyers" />

      <main className="content-container-visual py-10 md:py-14 lg:py-16">
        <div className="space-y-8">
          <div>
            <Link
              className="inline-flex items-center gap-1.5 text-body-sm text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
              href="/lawyers"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All immigration firms
            </Link>
          </div>

          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="max-w-[78ch]">
              <h1 className="text-display max-w-[24ch]">{firm.firmName}</h1>
              <p className="text-body mt-5 max-w-[72ch]">
                Small immigration firm in {firm.city}, {firm.state}, serving employment-track immigration clients across
                the U.S. Listing compiled {formatDate(firm.verifiedAsOf)}.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {firm.website ? (
                  <a
                    className="inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-sky-ink)] underline-offset-4 hover:underline"
                    href={ensureHttp(firm.website)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Globe className="h-4 w-4" />
                    {formatWebsiteHost(firm.website)}
                  </a>
                ) : null}
                {firm.phone ? (
                  <a
                    className="inline-flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline"
                    href={`tel:${firm.phone.replace(/[^+\d]/g, "")}`}
                  >
                    <Phone className="h-4 w-4" />
                    {firm.phone}
                  </a>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {firm.barVerified ? (
                  <span className="tag tag-active inline-flex items-center gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {firm.barVerified.state} bar — {firm.barVerified.status}
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
                    {firm.reviewCount != null ? ` · ${new Intl.NumberFormat("en-US").format(firm.reviewCount)} reviews` : ""}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link className={buttonVariants({ variant: "default" })} href="/tools/grace-period-calculator">
                  Check your grace period
                </Link>
                <Link className={buttonVariants({ variant: "outline" })} href="/jobs">
                  Find H-1B sponsors
                </Link>
              </div>
            </div>

            <aside className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5 text-center">
              <p className="text-caption">Trust signal</p>
              <p className="mt-1 text-[44px] font-semibold leading-none text-[var(--haven-ink)]">{firm.trustScore}</p>
              <p className="text-body-sm mt-3">
                Relative prioritization score from bar verification, AILA membership, and client reviews. Higher means a
                stronger verified track record — not legal advice or an endorsement.
              </p>
            </aside>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[var(--haven-ink-mid)]" />
                <h2 className="text-h3">Practice focus</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {firm.practiceFocus.map((area) => (
                  <span className="tag tag-visa" key={area}>
                    {area}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-[var(--haven-ink-mid)]" />
                <h2 className="text-h3">Languages spoken</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {firm.languagesSpoken.map((language) => (
                  <span className="tag tag-community" key={language}>
                    {language}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {claim ? (
            <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-white)] p-5">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-[var(--haven-sage-strong)]" />
                <h2 className="text-h3">Provided by the firm</h2>
              </div>
              <p className="text-caption mt-1 max-w-[95ch]">
                Submitted by {firm.firmName} — not independently verified by Haven. Use the proof links below to confirm.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {claim.ailaMember || claim.certifiedSpecialist || claim.yearsInPractice ? (
                  <div>
                    <p className="text-label">Credentials (firm-stated)</p>
                    <div className="mt-2 space-y-1 text-body-sm">
                      {claim.ailaMember ? <p>AILA member</p> : null}
                      {claim.certifiedSpecialist ? (
                        <p>
                          Certified Specialist in Immigration Law
                          {claim.certifiedSpecialistState ? ` (${claim.certifiedSpecialistState})` : ""}
                        </p>
                      ) : null}
                      {claim.yearsInPractice ? <p>{claim.yearsInPractice} years in practice</p> : null}
                    </div>
                  </div>
                ) : null}

                {claim.pricingStructure || claim.consultation || claim.consultationFee || claim.feeRange ? (
                  <div>
                    <p className="text-label">Pricing</p>
                    <div className="mt-2 space-y-1 text-body-sm">
                      {claim.pricingStructure ? <p>{claim.pricingStructure}</p> : null}
                      {claim.consultation ? (
                        <p>
                          {claim.consultation} consultation
                          {claim.consultation === "Paid" && claim.consultationFee ? ` · ${claim.consultationFee}` : ""}
                        </p>
                      ) : null}
                      {claim.feeRange ? <p>Typical: {claim.feeRange}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>

              {claim.hardCases && claim.hardCases.length ? (
                <div className="mt-4">
                  <p className="text-label">Also handles</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {claim.hardCases.map((item) => (
                      <span className="tag tag-visa" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {claim.bio ? <p className="text-body-sm mt-4 max-w-[95ch]">{claim.bio}</p> : null}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {claim.bookingUrl ? (
                  <a
                    className={buttonVariants({ variant: "accent" })}
                    href={claim.bookingUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Book a consultation
                  </a>
                ) : null}
                {claim.virtualAvailability ? (
                  <span className="text-body-sm text-[var(--haven-ink-mid)]">Available virtually nationwide</span>
                ) : null}
              </div>

              {evidence && (evidence.website || evidence.barUrl || evidence.ailaUrl || evidence.specialistUrl) ? (
                <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                  <p className="text-label">Firm-provided proof — verify for yourself</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {evidence.website ? (
                      <a className="tag tag-pending" href={evidence.website} rel="noopener noreferrer" target="_blank">
                        Firm website ↗
                      </a>
                    ) : null}
                    {evidence.barUrl ? (
                      <a className="tag tag-pending" href={evidence.barUrl} rel="noopener noreferrer" target="_blank">
                        State bar profile ↗
                      </a>
                    ) : null}
                    {evidence.ailaUrl ? (
                      <a className="tag tag-pending" href={evidence.ailaUrl} rel="noopener noreferrer" target="_blank">
                        AILA profile ↗
                      </a>
                    ) : null}
                    {evidence.specialistUrl ? (
                      <a className="tag tag-pending" href={evidence.specialistUrl} rel="noopener noreferrer" target="_blank">
                        Certified Specialist ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-h3">Is this your firm?</p>
                <p className="text-body-sm mt-1 max-w-[70ch]">
                  Claim this listing to add your specialties, languages, pricing, and proof links — free.
                </p>
              </div>
              <Link className={buttonVariants({ variant: "outline" })} href={`/lawyers/${firm.id}/claim`}>
                Claim this listing
              </Link>
            </section>
          )}

          <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
            <h2 className="text-h3">About this listing</h2>
            <p className="text-body-sm mt-2 max-w-[95ch]">
              This profile is compiled from public business listings, with client ratings, languages, and practice focus
              enriched from the firm&rsquo;s own website.{" "}
              {firm.barVerified
                ? `${firm.firmName}'s ${firm.barVerified.state} bar license was confirmed active with no public discipline on record.`
                : "We have not yet independently confirmed this firm's state-bar license status — please verify it directly."}{" "}
              A listing is not a referral, an endorsement, or legal advice — always confirm licensing, scope, and fees
              directly with {firm.firmName}. Compiled {formatDate(firm.verifiedAsOf)}; data generated{" "}
              {formatDate(generatedAt)}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sources.map((source) => (
                <a className="tag tag-pending" href={source.url} key={source.label} rel="noopener noreferrer" target="_blank">
                  {source.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

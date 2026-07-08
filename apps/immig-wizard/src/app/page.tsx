import Link from 'next/link';
import { ArrowRight, CheckCircle, Clock, FileText, Shield } from 'lucide-react';
import { HavenMark } from '@/components/branding/HavenMark';
import { Badge } from '@/components/ui/badge';
import { filingServices } from '@/lib/filings';

const HAVEN_HOME_URL = 'https://haven-h1b.com/';

const platformFeatures = [
  {
    icon: <Clock className="h-5 w-5 text-primary" />,
    title: 'One structure for every filing type',
    description:
      'Each filing card can have its own intake flow, checklist, summary page, and form preparation logic.',
  },
  {
    icon: <FileText className="h-5 w-5 text-primary" />,
    title: 'Reusable filing ingredients',
    description:
      'Keep a consistent pattern for eligibility questions, document collection, and step-by-step filing instructions.',
  },
  {
    icon: <Shield className="h-5 w-5 text-primary" />,
    title: 'Private by default',
    description:
      'Progress stays in the browser so applicants can work through a filing path without creating an account.',
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--neutral-25)_0%,var(--neutral-50)_38%,var(--neutral-25)_100%)] text-foreground">
      <div className="relative overflow-hidden border-b border-border bg-[color:rgb(250_249_247_/_0.8)]">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,rgba(201,137,40,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(30,82,65,0.1),transparent_34%)]" />

        <nav className="relative border-b border-border/80 bg-[color:rgb(250_249_247_/_0.82)] backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <Link href={HAVEN_HOME_URL} prefetch={false}>
                <HavenMark labelClassName="text-[1.75rem]" />
              </Link>
              <div className="hidden h-8 w-px bg-border sm:block" />
              <p className="hidden text-sm text-muted-foreground sm:block">
                Guided immigration filing workflows
              </p>
            </div>
            <Badge variant="outline" className="border-[color:var(--amber-200)] bg-[color:var(--amber-50)] text-[color:var(--amber-700)]">
              Beta
            </Badge>
          </div>
        </nav>

        <section className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--green-100)] bg-white/85 px-4 py-2 text-sm font-medium text-primary shadow-[var(--shadow-xs)]">
              <CheckCircle className="h-4 w-4" />
              Choose a filing path and review the service before you begin
            </div>

            <h1 className="max-w-3xl text-5xl font-light leading-[0.95] text-foreground sm:text-6xl lg:text-7xl">
              Immigration filing guidance,
              <span className="mt-2 block text-primary">organized by application type.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--neutral-600)]">
              Build your service catalog one filing type at a time. Each filing now has a dedicated shell page before
              intake starts, so you can add positioning, included forms, and customer-facing details later.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-[color:var(--neutral-600)]">
              <div className="rounded-full border border-border bg-white px-4 py-2 shadow-[var(--shadow-xs)]">
                Service detail pages
              </div>
              <div className="rounded-full border border-border bg-white px-4 py-2 shadow-[var(--shadow-xs)]">
                {filingServices.length} filing types in the shell
              </div>
              <div className="rounded-full border border-border bg-white px-4 py-2 shadow-[var(--shadow-xs)]">
                Coming soon paths marked clearly
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-white/92 p-6 shadow-[var(--shadow-xl)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              How the landing page works
            </p>
            <div className="mt-6 space-y-4">
              {[
                'Choose a filing type from the library below',
                'Open a service page that explains the workflow and forms included',
                'Continue from that service page into the application intake',
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-4 rounded-[var(--radius-xl-token)] border border-border bg-secondary/85 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="pt-2 text-sm leading-6 text-[color:var(--neutral-700)]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section id="filing-types">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Filing library</p>
              <h2 className="mt-2 text-4xl font-light text-foreground">The service lineup shell</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">
              The live workflow is available for Marriage Green Card via Adjustment of Status. Other filing paths are
              marked coming soon while their workflows are prepared.
            </p>
          </div>

          <div className="mb-8 rounded-[2rem] border border-border bg-white p-6 shadow-[var(--shadow-md)]">
            <div className="grid gap-4 md:grid-cols-2">
              {filingServices.map((filing) => (
                <div
                  key={`${filing.slug}-list`}
                  className="border-l border-[color:var(--amber-200)] pl-5 text-lg leading-8 text-[color:var(--neutral-800)]"
                >
                  {filing.title}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {filingServices.map((filing) => (
              <Link
                key={filing.slug}
                href={`/filings/${filing.slug}`}
                className="group block h-full rounded-[1.75rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring-soft)]"
              >
                <article className="flex h-full flex-col rounded-[1.75rem] border border-border bg-white p-6 shadow-[var(--shadow-md)] transition-[box-shadow,border-color,transform] duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:border-[color:var(--border-strong)] group-hover:shadow-[var(--shadow-lg)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge
                        variant="outline"
                        className={
                          filing.available
                            ? 'border-transparent bg-[color:var(--success-tint)] text-[color:var(--success-ink)]'
                            : 'border-transparent bg-[color:var(--warning-tint)] text-[color:var(--warning-foreground)]'
                        }
                      >
                        {filing.status}
                      </Badge>
                      <h3 className="mt-4 text-3xl font-light text-foreground">{filing.title}</h3>
                      <p className="mt-2 text-sm font-medium text-primary">{filing.subtitle}</p>
                    </div>
                    <div className="rounded-[var(--radius-lg-token)] bg-secondary px-3 py-2 text-right">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Forms</p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--neutral-800)]">
                        {filing.landingForms.length}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-7 text-muted-foreground">{filing.description}</p>

                  <div className="mt-6 rounded-[var(--radius-lg-token)] bg-secondary p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Shell status
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--neutral-700)]">
                      {filing.available
                        ? 'This filing type already connects to a live intake flow.'
                        : 'This filing type has a service shell page ready for you to fill in later.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-2">
                    {filing.available ? (
                      <span className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md-token)] border border-transparent bg-primary px-5 text-[0.95rem] font-medium text-primary-foreground shadow-[var(--shadow-xs)] transition-[background-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:bg-[var(--primary-hover)] group-hover:shadow-[var(--shadow-md)]">
                        Start my application
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </span>
                    ) : (
                      <span className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-md-token)] border border-[color:var(--neutral-200)] bg-[color:var(--neutral-100)] px-5 text-[0.95rem] font-medium text-[color:var(--neutral-600)] shadow-none transition-[background-color,border-color,color] duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:border-[color:var(--neutral-300)] group-hover:bg-[color:var(--neutral-200)] group-hover:text-[color:var(--neutral-700)]">
                        Coming soon
                      </span>
                    )}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3">
          {platformFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[1.5rem] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,239,0.92))] p-6 shadow-[var(--shadow-sm)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg-token)] bg-primary-subtle">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-[1.6rem] font-normal text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center">
        <p className="text-xs leading-6 text-muted-foreground">
          <strong>Disclaimer:</strong> ImmigWizard is an informational tool, not a law firm and does not provide legal
          advice. Immigration law is complex and case-specific. Review official USCIS instructions and consult a
          licensed immigration attorney before filing.
        </p>
      </footer>
    </div>
  );
}

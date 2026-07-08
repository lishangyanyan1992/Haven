import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Shield } from 'lucide-react';
import { HavenMark } from '@/components/branding/HavenMark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { filingServices, getFilingService } from '@/lib/filings';

const HAVEN_HOME_URL = 'https://haven-h1b.com/';

export function generateStaticParams() {
  return filingServices.map((service) => ({ slug: service.slug }));
}

export default async function FilingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getFilingService(slug);

  if (!service) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--neutral-25)_0%,var(--neutral-50)_42%,var(--neutral-25)_100%)] text-foreground">
      <header className="border-b border-border bg-[color:rgb(250_249_247_/_0.86)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <Link href={HAVEN_HOME_URL} prefetch={false}>
              <HavenMark labelClassName="text-[1.7rem]" />
            </Link>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <p className="hidden text-sm text-muted-foreground sm:block">Service overview</p>
          </div>

          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to filing library
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-border bg-white p-8 shadow-[var(--shadow-lg)]">
            <Badge
              variant="outline"
              className={
                service.available
                  ? 'border-transparent bg-[color:var(--success-tint)] text-[color:var(--success-ink)]'
                  : 'border-transparent bg-[color:var(--warning-tint)] text-[color:var(--warning-foreground)]'
              }
            >
              {service.status}
            </Badge>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {service.detailEyebrow}
            </p>
            <h1 className="mt-3 text-5xl font-light leading-[0.98] text-foreground sm:text-6xl">
              {service.title}
            </h1>
            <p className="mt-4 text-lg font-medium text-primary">{service.subtitle}</p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground">{service.detailIntro}</p>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{service.detailSummary}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <FileText className="h-5 w-5 text-primary" />,
                  title: 'Forms included',
                  description: `${service.completedForms.length} forms listed for this service`,
                },
                {
                  icon: <CheckCircle2 className="h-5 w-5 text-primary" />,
                  title: 'Guided intake',
                  description: 'Users review the service first, then continue into the filing flow',
                },
                {
                  icon: <Shield className="h-5 w-5 text-primary" />,
                  title: 'Private progress',
                  description: 'Answers remain local in the browser while applicants work',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-[var(--radius-xl-token)] border border-border bg-secondary p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg-token)] bg-primary-subtle">
                    {item.icon}
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-[color:var(--green-700)] bg-[color:var(--green-800)] p-7 text-white shadow-[var(--shadow-xl)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--green-200)]">
              Next step
            </p>
            <h2 className="mt-3 text-4xl font-light leading-none text-white">Start this application</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--green-200)]">
              Review the service details below, then move into the filing intake when you are ready.
            </p>

            {service.available && service.wizardHref ? (
              <Link href={service.wizardHref} className="mt-8 block">
                <Button size="lg" className="h-12 w-full bg-white text-[color:var(--green-800)] hover:bg-[color:var(--neutral-50)]">
                  Start my application
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                disabled
                className="mt-8 h-12 w-full border-white/10 bg-white/15 text-white/75 shadow-none"
              >
                Coming soon
              </Button>
            )}

            <div className="mt-8 rounded-[var(--radius-xl-token)] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--green-100)]">
                This service includes
              </p>
              <div className="mt-4 space-y-3">
                {service.serviceIncludes.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--green-200)]" />
                    <p className="text-sm leading-6 text-[color:var(--neutral-50)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-10 rounded-[2rem] border border-border bg-white p-8 shadow-[var(--shadow-md)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Forms package</p>
              <h2 className="mt-2 text-4xl font-light text-foreground">{service.completedFormsHeading}</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-muted-foreground">{service.completedFormsNote}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {service.completedForms.map((form) => (
              <div
                key={form}
                className="flex items-start gap-3 rounded-[var(--radius-xl-token)] border border-border bg-secondary px-4 py-4"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md-token)] bg-primary-subtle">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm leading-6 text-[color:var(--neutral-700)]">{form}</p>
              </div>
            ))}
          </div>
        </section>

        {service.faqs.length > 0 && (
          <section className="mt-10 rounded-[2rem] border border-border bg-white p-8 shadow-[var(--shadow-md)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">FAQ</p>
                <h2 className="mt-2 text-4xl font-light text-foreground">
                  Common questions about {service.title}
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Answers below are summarized from official USCIS or U.S. Department of State guidance linked with each item.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {service.faqs.map((faq) => (
                <article key={faq.question} className="rounded-[var(--radius-xl-token)] border border-border bg-secondary p-5">
                  <h3 className="text-[1.75rem] font-normal text-foreground">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--neutral-700)]">{faq.answer}</p>
                  <a
                    href={faq.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Source: {faq.sourceLabel}
                  </a>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

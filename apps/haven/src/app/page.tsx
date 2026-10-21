import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, MessageCircle, Send, ShieldAlert } from "lucide-react";

import { BlogCard } from "@/components/app/blog-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { PublicNavbar, getPublicImmigWizardUrl } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { getRecentBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const HOME_DESCRIPTION =
  "Haven is an invitation-only client assistant for immigration law firms. Invite your clients to upload their documents and get plain-language answers between appointments.";

const steps = [
  {
    icon: Send,
    title: "Invite your clients",
    description: "Send each client an invite from your firm. Haven is closed to everyone else."
  },
  {
    icon: FileText,
    title: "They upload their documents",
    description: "Approval notices, I-20s, work permits. Haven reads them, so answers start from the client's own dates."
  },
  {
    icon: MessageCircle,
    title: "They ask, Haven answers",
    description: "Plain-language answers built from what people in the same situation did. Anything that needs a lawyer goes back to you."
  }
];

export const metadata: Metadata = {
  title: "Haven — A client assistant for immigration law firms",
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: absoluteUrl("/"),
    title: "Haven — A client assistant for immigration law firms",
    description: HOME_DESCRIPTION
  },
  twitter: {
    title: "Haven — A client assistant for immigration law firms",
    description: HOME_DESCRIPTION
  }
};

/**
 * Shows the differentiator rather than asserting it: many real accounts on one
 * visa path, narrowing into a single answer weighed against your own case.
 * Deliberately no invented case counts — the claim stays qualitative.
 */
function CrowdWisdomGraphic() {
  const accounts = [
    { label: "Most common", text: "Filed for H-4 to hold status while job hunting" },
    { label: "Also worked", text: "Found a cap-exempt employer and transferred" },
    { label: "Cost them time", text: "Waited on the transfer before starting the new job" }
  ];

  return (
    <div className="rounded-[1.5rem] border border-[rgba(74,92,84,0.16)] bg-[rgba(255,255,255,0.72)] p-5 shadow-[0_12px_30px_-18px_rgba(44,54,48,0.28)] sm:p-6">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">
        Real accounts, same visa path
      </p>

      <div className="mt-4 space-y-2.5">
        {accounts.map((account) => (
          <div
            className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-3"
            key={account.text}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-ink-mid)]">
              {account.label}
            </p>
            <p className="mt-1 text-[14px] leading-snug text-[var(--haven-ink)]">{account.text}</p>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="flex justify-center py-3">
        <svg fill="none" height="30" viewBox="0 0 120 30" width="120">
          <g stroke="var(--haven-ink-mid)" strokeLinecap="round" strokeOpacity="0.45" strokeWidth="1.5">
            <path d="M14 0 V8 Q14 17 60 17" />
            <path d="M60 0 V17" />
            <path d="M106 0 V8 Q106 17 60 17" />
            <path d="M60 17 V25" />
            <path d="M55 21 L60 26 L65 21" strokeLinejoin="round" />
          </g>
        </svg>
      </div>

      <div className="rounded-[var(--radius-xl)] bg-[var(--haven-ink)] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(247,244,239,0.72)]">
          Your answer
        </p>
        <p className="mt-1 text-[14px] leading-snug text-[var(--haven-cream)]">
          Weighed against your visa, your dates, and your employer.
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const recentPosts = getRecentBlogPosts(3);
  const immigWizardUrl = getPublicImmigWizardUrl();
  const pageSectionClass = "border-t border-[var(--color-border)]";
  const pageSectionInnerClass = "content-container-visual pt-16 pb-18 md:pt-20 md:pb-20 lg:pt-24 lg:pb-24";

  return (
    <div className="min-h-screen">
      <PublicNavbar currentPath="/" />

      <main>
        <section className="bg-[var(--haven-cream)]">
          <div className="content-container-visual flex flex-col items-center pt-10 pb-14 text-center md:pt-12 md:pb-16 lg:pt-14 lg:pb-20">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--haven-ink-mid)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--haven-ink)]" />
              Invitation only · for immigration law firms
            </p>
            <h1 className="text-display mt-5 max-w-[22ch]">
              Your clients&apos; questions, answered between appointments.
            </h1>
            <p className="text-body mt-5 max-w-[58ch]">
              Invite your clients to Haven. They upload their documents and ask in plain words. Haven answers with what
              people in the same situation actually did, so your team spends less time on intake and repeat questions.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ size: "lg" })} href="/register">
                Request an invite for your firm
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/register">
                My lawyer invited me
              </Link>
            </div>

            <div className="mt-10 w-full max-w-[46rem] rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] px-5 py-4 text-left sm:px-6 sm:py-5">
              <p className="flex items-start gap-2.5 text-[16px] font-semibold leading-snug text-[var(--haven-ink)]">
                <ShieldAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                Haven doesn&apos;t replace you.
              </p>
              <p className="text-body-sm mt-2 text-[var(--haven-ink-mid)]">
                Haven does not give legal advice. It shares what other people in the same situation went through, and
                tells clients to bring any decision they can&apos;t undo to their attorney: you.
              </p>
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="how-it-works">
          <div className={pageSectionInnerClass}>
            <div className="max-w-[76ch]">
              <p className="text-label">How it works</p>
              <h2 className="text-h1 mt-4 text-balance">Three steps, and your clients stop waiting on email.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
              {steps.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-6 xl:p-8"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--haven-white)] text-[var(--haven-ink)]">
                    <step.icon className="h-[18px] w-[18px]" />
                  </div>
                  <p className="text-label mt-5">Step {index + 1}</p>
                  <h3 className="text-h2 mt-2">{step.title}</h3>
                  <p className="text-body mt-2">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-sky-light)]")}>
          <div className={pageSectionInnerClass}>
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="max-w-[62ch]">
                <p className="text-label">Why the answers are different</p>
                <h2 className="text-h1 mt-4 text-balance">Answers grounded in real outcomes, not a forum thread.</h2>
                <p className="text-body mt-4">
                  Your clients are already searching Reddit at midnight. Haven gives them something better: thousands of
                  moderated, real accounts from people on the same visa path, weighed against the client&apos;s own
                  documents.
                </p>
                <p className="text-body mt-4">
                  It covers the moments that send clients into a panic (the lottery, the layoff, the deadline) and the
                  slow questions that eat your team&apos;s time: where a case stands, what a filing means, what comes next.
                </p>
              </div>
              <CrowdWisdomGraphic />
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="for-clients">
          <div className={pageSectionInnerClass}>
            <p className="text-label">For people going through immigration</p>
            <h2 className="text-h1 mt-4 max-w-[28ch] text-balance">Haven works through your lawyer.</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
              <article className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-6 xl:p-8">
                <h3 className="text-h2">Invited by your lawyer?</h3>
                <p className="text-body mt-2">Use the email they invited to create your account, then upload your documents and ask away.</p>
                <Link className={cn(buttonVariants(), "mt-5")} href="/register">
                  Accept my invite
                </Link>
              </article>
              <article className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-6 xl:p-8">
                <h3 className="text-h2">Don&apos;t have a lawyer yet?</h3>
                <p className="text-body mt-2">
                  Ask yours if they use Haven, or find an immigration attorney near you. Our guides and calculators stay
                  free for everyone.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link className={buttonVariants({ variant: "outline" })} href="/lawyers">
                    Find a lawyer
                  </Link>
                  <Link className={buttonVariants({ variant: "outline" })} href="/resources">
                    Free guides
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")}>
          <div className={pageSectionInnerClass}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[62ch]">
                <p className="text-label">Free for everyone</p>
                <h2 className="text-h1 mt-4 max-w-[26ch]">Plain-language guides for layoffs, grace periods, and transfers.</h2>
                <p className="text-body mt-4 max-w-[58ch]">
                  Open to everyone, no account needed — along with the{" "}
                  <Link className="underline underline-offset-4" href="/tools">
                    free calculators
                  </Link>
                  ,{" "}
                  <Link className="underline underline-offset-4" href="/resources">
                    resource library
                  </Link>
                  , and{" "}
                  <Link className="underline underline-offset-4" href="/jobs">
                    sponsor history directory
                  </Link>
                  .
                </p>
              </div>
              <Link className={buttonVariants({ variant: "outline" })} href="/resources?category=h1b">
                Browse the guides
              </Link>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {recentPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "content-container-visual bg-[var(--haven-cream)] pt-16 pb-20 md:pt-20 md:pb-20 lg:pt-24 lg:pb-24")}>
          <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-10 text-[var(--haven-cream)] md:px-10 md:py-12">
            <h2 className="text-h1 max-w-[20ch] text-[var(--haven-cream)]">
              Give your clients somewhere to go between appointments.
            </h2>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
              Haven is opening to a small group of immigration firms. Request an invite and we&apos;ll set yours up.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "cream", size: "lg" })} href="/register">
                Request an invite
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className={buttonVariants({ variant: "ghost-light", size: "lg" })} href="/login">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="content-container-visual flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <HavenBrand compact />
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/resources?category=h1b">
              Guides
            </Link>
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/blog">
              Blog
            </Link>
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/resources">
              Resources
            </Link>
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/tools">
              Free tools
            </Link>
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/jobs">
              Sponsor jobs
            </Link>
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/about">
              About
            </Link>
            {immigWizardUrl ? (
              <a
                href={immigWizardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
              >
                <FileText className="h-3 w-3" />
                ImmigWizard — Green Card Forms
              </a>
            ) : null}
          </div>
          <p className="text-caption">Haven provides information, not legal advice. Verify decisions with a qualified attorney.</p>
        </div>
      </footer>
    </div>
  );
}

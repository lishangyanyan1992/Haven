import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, FileCheck, FileText, Sparkles, UserCheck } from "lucide-react";

import { BlogCard } from "@/components/app/blog-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { PublicNavbar, getPublicImmigWizardUrl } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { getRecentBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const HOME_DESCRIPTION =
  "Haven is a client intake, urgency triage, and AI-assisted preparation platform for immigration law firms. Collect structured intakes, organize required documents, and triage leads by urgency.";

const steps = [
  {
    icon: UserCheck,
    title: "Invite clients or share your link",
    description: "Send clients an invite directly or embed your intake link on your website. Collect prospective leads and current clients in one unified queue."
  },
  {
    icon: ClipboardList,
    title: "They answer questions & upload files",
    description: "Clients complete your firm's customized intake questions (status, employer, priority dates) and upload required notices directly into a secure vault."
  },
  {
    icon: Sparkles,
    title: "Triage urgency & prep your response",
    description: "Receive a prioritized lead queue ranked by urgency (expiring visas, layoffs, RFE deadlines). Haven AI helps you analyze the case and prep your client response."
  }
];

export const metadata: Metadata = {
  title: "Haven — Client Intake & Urgency Triage for Immigration Law Firms",
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: absoluteUrl("/"),
    title: "Haven — Client Intake & Urgency Triage for Immigration Law Firms",
    description: HOME_DESCRIPTION
  },
  twitter: {
    title: "Haven — Client Intake & Urgency Triage for Immigration Law Firms",
    description: HOME_DESCRIPTION
  }
};

/**
 * Visual preview of the firm triage and lead prioritization queue,
 * highlighting urgency ranking, checklist progress, and AI-assisted response prep.
 */
function FirmTriageGraphic() {
  const leads = [
    {
      name: "Alex Chen",
      visa: "H-1B",
      reason: "Layoff grace period ends in 18 days",
      urgency: "Urgent",
      urgencyClass: "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]",
      docs: "3/3 uploaded"
    },
    {
      name: "Priya Sharma",
      visa: "F-1 OPT",
      reason: "OPT expiring · evaluating STEM extension & O-1",
      urgency: "Soon",
      urgencyClass: "bg-[var(--haven-sand)] text-[var(--haven-ink)]",
      docs: "2/3 uploaded"
    },
    {
      name: "Lucas Silva",
      visa: "EB-2 PERM",
      reason: "I-140 approved · priority date tracking",
      urgency: "Later",
      urgencyClass: "bg-[var(--haven-sky-light)] text-[var(--haven-ink)]",
      docs: "1/2 uploaded"
    }
  ];

  return (
    <div className="rounded-[1.5rem] border border-[rgba(74,92,84,0.16)] bg-[rgba(255,255,255,0.85)] p-5 shadow-[0_12px_30px_-18px_rgba(44,54,48,0.28)] sm:p-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">
            Incoming Client & Lead Triage
          </p>
          <p className="text-[13px] text-[var(--haven-ink)] font-medium mt-0.5">Prioritized by timeline & case urgency</p>
        </div>
        <span className="rounded-full bg-[var(--haven-ink)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-cream)]">
          Live Queue
        </span>
      </div>

      <div className="mt-3.5 space-y-2.5">
        {leads.map((lead) => (
          <div
            className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3 sm:p-3.5"
            key={lead.name}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[var(--haven-ink)]">{lead.name}</span>
                <span className="rounded bg-[var(--haven-cream)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--haven-ink-mid)]">
                  {lead.visa}
                </span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${lead.urgencyClass}`}>
                {lead.urgency}
              </span>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-[var(--haven-ink-mid)]">{lead.reason}</p>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--haven-ink-mid)]">
              <span className="inline-flex items-center gap-1 font-medium text-[var(--haven-ink)]">
                <FileCheck className="h-3.5 w-3.5 text-[var(--haven-sage)]" />
                {lead.docs}
              </span>
              <span>Intake complete</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[var(--radius-xl)] bg-[var(--haven-ink)] p-4 text-[var(--haven-cream)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(247,244,239,0.78)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--haven-sand)]" />
          Haven AI Response Prep
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--haven-cream)]">
          Surfaces critical dates, gaps in status, and recommended response outlines based on the client&apos;s questionnaire and uploaded documents.
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
              For immigration law firms
            </p>
            <h1 className="text-display mt-5 max-w-[24ch]">
              Structured client intake, urgency triage, and faster responses.
            </h1>
            <p className="text-body mt-5 max-w-[62ch]">
              Share your intake link on your website or invite clients directly. They answer questions about their case situation and upload required documents. Haven prioritizes every lead by urgency and helps you prepare your response in minutes.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ size: "lg" })} href="/register?role=lawyer">
                Request a pilot for your firm
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/register">
                My lawyer invited me
              </Link>
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="how-it-works">
          <div className={pageSectionInnerClass}>
            <div className="max-w-[76ch]">
              <p className="text-label">How it works</p>
              <h2 className="text-h1 mt-4 text-balance">From first inquiry to prepared response in three simple steps.</h2>
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
                <p className="text-label">Smart Intake & Urgency Triage</p>
                <h2 className="text-h1 mt-4 text-balance">Know who needs you first—before the consultation even begins.</h2>
                <p className="text-body mt-4">
                  Prospective clients and current petitioners arrive with complex, time-sensitive situations: impending grace period expirations, upcoming travel, or urgent USCIS RFE notices.
                </p>
                <p className="text-body mt-4">
                  Haven automatically parses the client&apos;s questionnaire and documents to rank leads by urgency tier. When you review a case, Haven AI gives you a structured situation brief and helps you think through your response so your team can follow up swiftly and accurately.
                </p>
                <div className="mt-6 flex flex-col gap-2.5 text-body-sm font-medium text-[var(--haven-ink)]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)] shrink-0" />
                    <span>Configurable intake questions & document checklists tailored to your firm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)] shrink-0" />
                    <span>Automated urgency classification based on real immigration deadlines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)] shrink-0" />
                    <span>AI-assisted case analysis and response drafting for attorneys</span>
                  </div>
                </div>
              </div>
              <FirmTriageGraphic />
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
                <p className="text-body mt-2">Use the email your law firm invited to access your account, complete your intake questionnaire, and securely upload your case documents.</p>
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
            <h2 className="text-h1 max-w-[22ch] text-[var(--haven-cream)]">
              Streamline your firm&apos;s intake and respond to urgent leads faster.
            </h2>
            <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
              Haven is opening pilots to a select group of immigration law firms. Request a pilot for your practice and see your intake triage in action.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "cream", size: "lg" })} href="/register?role=lawyer">
                Request a pilot for your firm
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className={buttonVariants({ variant: "ghost-light", size: "lg" })} href="/login?role=lawyer">
                Lawyer sign in
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

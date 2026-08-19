import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, MessageCircle, Users, UserCheck } from "lucide-react";

import { BlogCard } from "@/components/app/blog-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { HomeQuestionBox } from "@/components/app/home-question-box";
import { PublicNavbar, getPublicImmigWizardUrl } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { getRecentBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const HOME_DESCRIPTION =
  "Ask what you're facing — a missed H-1B lottery, a layoff, status running out — and get an answer built from what people in the same situation actually did.";

const steps = [
  {
    icon: MessageCircle,
    title: "Ask in your own words",
    description: "No forms to decode. Describe what happened the way you'd tell a friend."
  },
  {
    icon: UserCheck,
    title: "Tell us your situation once",
    description: "Visa, dates, employer. It takes a minute, and it's why the answer fits your case instead of a generic one."
  },
  {
    icon: Users,
    title: "Get what people actually did",
    description: "Your answer is built from the experiences of people who were where you are — what worked, what cost them time."
  }
];

export const metadata: Metadata = {
  title: "Haven — Immigration answers from people who've been through it",
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: absoluteUrl("/"),
    title: "Haven — Immigration answers from people who've been through it",
    description: HOME_DESCRIPTION
  },
  twitter: {
    title: "Haven — Immigration answers from people who've been through it",
    description: HOME_DESCRIPTION
  }
};

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
            <h1 className="text-display max-w-[22ch]">
              You are not the first person <em>this</em> has happened to.
            </h1>
            <p className="text-body mt-5 max-w-[54ch]">
              Ask what you&apos;re facing. Haven answers with what people in the same situation actually did — the
              lottery they missed, the layoff clock, the status running out.
            </p>

            <div className="mt-8 w-full max-w-[46rem] text-left">
              <HomeQuestionBox />
            </div>

            <p className="text-caption mt-6 max-w-[52ch]">
              Haven provides information from real experiences, not legal advice. For a decision you can&apos;t undo,
              check with a qualified attorney.
            </p>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="how-it-works">
          <div className={pageSectionInnerClass}>
            <div className="max-w-[62ch]">
              <p className="text-label">How it works</p>
              <h2 className="text-h1 mt-4 max-w-[26ch]">Three steps, then an answer you can act on.</h2>
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
            <div className="max-w-[62ch]">
              <p className="text-label">Why the answers are different</p>
              <h2 className="text-h1 mt-4 max-w-[30ch]">Wisdom of the crowd, not a search result.</h2>
              <p className="text-body mt-4">
                Most immigration advice online is either a forum thread you can&apos;t verify or a page written for
                everyone. Haven reads thousands of moderated, real accounts from people on the same visa path, keeps
                what held up, and answers your specific question with it.
              </p>
              <p className="text-body mt-4">
                We start with the hardest moments — the lottery, the layoff, the deadline — because that&apos;s when a
                wrong answer costs the most. Longer-term planning comes next.
              </p>
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")}>
          <div className={pageSectionInnerClass}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[62ch]">
                <p className="text-label">Read first, sign up later</p>
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
              <Link className={buttonVariants({ variant: "outline" })} href="/guides">
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
              Whatever just happened, someone has been here before.
            </h2>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
              Ask your question and find out what they did next.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "cream", size: "lg" })} href="/register">
                Ask your question
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link className={buttonVariants({ variant: "ghost-light", size: "lg" })} href="/login">
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="content-container-visual flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <HavenBrand compact />
            <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/guides">
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

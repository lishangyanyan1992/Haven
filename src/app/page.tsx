import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, FileText, MessageCircle, ShieldAlert, Sparkles, Star, Users } from "lucide-react";

const KNOWN_BROKEN_IMMIG_WIZARD_HOST = "immig.haven-h1b.com";

function getImmigWizardUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_IMMIG_WIZARD_URL?.trim();

  if (!configuredUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(configuredUrl);
    if (parsedUrl.hostname === KNOWN_BROKEN_IMMIG_WIZARD_HOST) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
}

const IMMIG_WIZARD_URL = getImmigWizardUrl();

import { BlogCard } from "@/components/app/blog-card";
import { GuideCard } from "@/components/app/guide-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
import { getRecentBlogPosts } from "@/lib/blog";
import { getFeaturedGuides } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Clock,
    title: "Personal timelines",
    description: "See the dates, ranges, and action windows that actually matter for your path."
  },
  {
    icon: ShieldAlert,
    title: "Layoff planning",
    description: "A calmer 60-day plan with one clear action at a time instead of panic-driven checklists."
  },
  {
    icon: Users,
    title: "Matched community",
    description: "Stories and tactics from people in the same visa stage, country queue, and moment."
  }
];

const stories = [
  {
    title: "You have 48 days. Here’s what helped.",
    body: "Haven translated the noise into a plan I could actually follow. The community examples mattered as much as the dates.",
    author: "Priya S.",
    detail: "H-1B → EB-2 · India queue",
    initials: "PS"
  },
  {
    title: "It felt like a friend who’d done this before.",
    body: "The timeline didn’t just tell me when things happened. It told me what to do now and what to ignore.",
    author: "Marcus L.",
    detail: "OPT → H-1B · Employer change",
    initials: "ML"
  }
];

export const metadata: Metadata = {
  title: "Haven",
  description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: absoluteUrl("/"),
    title: "Haven",
    description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders."
  },
  twitter: {
    title: "Haven",
    description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders."
  }
};

export default function HomePage() {
  const recentPosts = getRecentBlogPosts(3);
  const featuredGuides = getFeaturedGuides(3);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
        <div className="content-container-wide flex h-16 items-center justify-between gap-4">
          <HavenBrand />
          <nav className="hidden items-center gap-7 md:flex">
            <a className="text-body-sm hover:text-[var(--haven-ink)]" href="#how-it-works">
              How it works
            </a>
            <a className="text-body-sm hover:text-[var(--haven-ink)]" href="#features">
              Features
            </a>
            <a className="text-body-sm hover:text-[var(--haven-ink)]" href="#community">
              Community
            </a>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/blog">
              Blog
            </Link>
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/guides">
              Guides
            </Link>
            {IMMIG_WIZARD_URL ? (
              <a
                className="inline-flex items-center gap-1 text-body-sm text-[var(--haven-sage-ink,var(--haven-ink))] font-medium hover:text-[var(--haven-ink)]"
                href={IMMIG_WIZARD_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Green Card Forms
                <ArrowRight className="h-3 w-3" />
              </a>
            ) : null}
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/about">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/login">
              Sign in
            </Link>
            <Link className={buttonVariants({ variant: "default" })} href="/register">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="content-container-wide grid gap-8 px-0 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="animate-enter">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
                <span className="h-1.5 w-1.5 animate-[haven-pulse_2s_ease-in-out_infinite] rounded-full bg-[var(--haven-sage)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">12,000+ H-1B holders trust Haven</p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
                <Sparkles className="h-3 w-3 text-[var(--haven-sky-ink)]" />
                <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">AI-powered</p>
              </div>
            </div>
            <h1 className="text-display mt-5 max-w-[12ch]">
              Immigration support that feels calm, specific, and <em>human</em>.
            </h1>
            <p className="text-body mt-6 max-w-[60ch]">
              Haven is the knowledgeable friend for H-1B and adjacent visa holders: timelines you can trust, layoff planning that de-escalates panic, and community guidance grounded in real cases.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "default", size: "lg" })} href="/register">
                Start your plan
              </Link>
              <a className={buttonVariants({ variant: "outline", size: "lg" })} href="#how-it-works">
                See how Haven works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["No legal jargon", "Built for H-1B holders", "Community-led guidance"].map((item) => (
                <span key={item} className="tag tag-visa">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-enter rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-[0_8px_40px_-8px_rgba(44,54,48,0.10)] lg:p-7">
            <div className="overflow-hidden rounded-[var(--radius-2xl)]">
              <Image
                src="/hero-banner.png"
                alt="Three people reviewing immigration documents together"
                width={640}
                height={427}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Day 12 of 60", "A calmer grace-period tracker"],
                ["8 similar stories", "Community proof when timing gets tight"],
                ["1 clear next step", "Specificity over generic warnings"]
              ].map(([title, copy]) => (
                <div key={title} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4">
                  <p className="text-h3">{title}</p>
                  <p className="text-body-sm mt-2">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--color-border)] bg-[var(--haven-white)]">
          <div className="content-container-wide py-8">
            <div className="grid grid-cols-2 gap-y-8 gap-x-6 lg:grid-cols-4">
              {[
                ["12,000+", "members navigating visas"],
                ["60-day", "layoff action plans"],
                ["50+", "countries represented"],
                ["4.9 / 5", "average member rating"],
              ].map(([num, label]) => (
                <div key={label} className="flex flex-col items-center gap-1.5 text-center">
                  <p className="font-[family-name:var(--font-display)] text-[2rem] leading-none tracking-tight text-[var(--haven-ink)]">{num}</p>
                  <p className="text-body-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-container-wide py-20 lg:py-28" id="features">
          <div className="max-w-[62ch]">
            <p className="text-label">What Haven gives you</p>
            <h2 className="text-h1 mt-4">The parts of immigration support that usually live in six tabs and a stressed group chat.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className={cn(
                  "animate-enter group relative overflow-hidden rounded-[var(--radius-2xl)] p-6",
                  "shadow-[0_2px_16px_-4px_rgba(44,54,48,0.07)] transition-all duration-200",
                  "hover:shadow-[0_8px_32px_-8px_rgba(44,54,48,0.14)] hover:-translate-y-0.5",
                  index === 1 ? "bg-[var(--haven-sky-light)]" : "bg-[var(--haven-sand)]"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-[3px]",
                    index === 1 ? "bg-[var(--haven-sky)]" : "bg-[var(--haven-sage)]"
                  )}
                />
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] text-[var(--haven-ink)]",
                    index === 1 ? "bg-white/70" : "bg-[var(--haven-white)]"
                  )}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-h2 mt-5">{feature.title}</h3>
                <p className="text-body mt-3">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-container-wide py-20 lg:py-28" id="how-it-works">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-label">How it works</p>
              <h2 className="text-h1 mt-4">Give Haven a few details. Get value back immediately.</h2>
              <p className="text-body mt-4 max-w-[60ch]">
                The setup is short by design. Each answer unlocks a timeline, better recommendations, or a more relevant cohort.
              </p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6">
              <div className="timeline">
                {[
                  ["Step 1", "Add your visa status and country of birth", "So Haven can place you in the right path."],
                  ["Step 2", "See your milestone dates and action windows", "Deterministic dates where possible, honest ranges where not."],
                  ["Step 3", "Plan for layoffs, renewals, and employer changes", "One calm plan instead of a generic warning banner."],
                  ["Step 4", "Learn from people who already went through it", "Community guidance shows what worked in practice."]
                ].map(([label, title, copy], index) => (
                  <div key={label} className="timeline-item">
                    <div className="timeline-track">
                      <div className={cn("timeline-dot", index === 1 ? "timeline-dot-active" : "timeline-dot-done")} />
                    </div>
                    <div className="timeline-content">
                      <p className="text-label">{label}</p>
                      <p className="text-h3 mt-1">{title}</p>
                      <p className="text-body-sm mt-2">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {IMMIG_WIZARD_URL ? (
          <section className="border-y border-[var(--color-border)] bg-[var(--haven-sage-light,var(--haven-sand))]">
            <div className="content-container-wide py-14 lg:py-20">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-white)] px-3 py-1">
                    <FileText className="h-3.5 w-3.5 text-[var(--haven-sage)]" />
                    <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">Free companion tool</p>
                  </div>
                  <h2 className="text-h1 max-w-[22ch]">
                    Applying for a marriage-based green card? We've got you.
                  </h2>
                  <p className="text-body mt-4 max-w-[58ch]">
                    ImmigWizard walks you through Forms I-130, I-485, I-864, I-765, and I-131 — step by step — and generates pre-filled PDFs ready to mail to USCIS. No attorney needed for a straightforward case.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {["I-130 · I-485 · I-864", "Pre-filled PDFs", "Free to use"].map((tag) => (
                      <span key={tag} className="tag tag-visa">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <a
                    href={IMMIG_WIZARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-ink)] px-6 py-3 text-[15px] font-semibold text-[var(--haven-cream)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--haven-ink-mid,var(--haven-ink))] hover:shadow-md"
                  >
                    Start the wizard
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <p className="text-caption text-center lg:text-right">Takes about 10 minutes</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="content-container-wide py-20 lg:py-28" id="community">
          <div className="max-w-[62ch]">
            <p className="text-label">Community stories</p>
            <h2 className="text-h1 mt-4">People trust specifics, not slogans.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {stories.map((story) => (
              <article key={story.title} className="flex flex-col rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 shadow-[0_2px_12px_-4px_rgba(58,110,132,0.08)]">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[var(--haven-sky-ink)] text-[var(--haven-sky-ink)]" />
                  ))}
                </div>
                <h3 className="text-h2 mt-4">{story.title}</h3>
                <p className="text-body mt-3 flex-1">{story.body}</p>
                <div className="mt-5 flex items-center gap-3 border-t border-[var(--haven-sky-mid)] pt-4">
                  <div className="avatar avatar-sm avatar-community flex-shrink-0">{story.initials}</div>
                  <div>
                    <p className="text-[13px] font-medium leading-none text-[var(--haven-ink)]">{story.author}</p>
                    <p className="text-caption mt-1">{story.detail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-container-wide py-20 lg:py-28">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">Popular guides</p>
              <h2 className="text-h1 mt-4">Search-intent pages for layoffs, grace periods, and transfers.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                These public guides are built for the moments when people are actively trying to understand what to do next on an H-1B timeline.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/guides">
              Browse all guides
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featuredGuides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>

        <section className="content-container-wide py-20 lg:py-28">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">From the blog</p>
              <h2 className="text-h1 mt-4">Practical reads for layoffs, transfers, and green card uncertainty.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                The blog is where Haven publishes clear, tactical articles you can share, revisit, and update over time.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/blog">
              Browse all articles
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {recentPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>

        <section className="content-container-wide py-20 lg:py-28">
          <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-10 text-[var(--haven-cream)] md:px-10 md:py-12">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(253,250,246,0.18)] bg-[rgba(253,250,246,0.08)] px-3 py-1">
              <Sparkles className="h-3 w-3 text-[rgba(253,250,246,0.72)]" />
              <p className="text-[11px] font-medium tracking-wide text-[rgba(253,250,246,0.72)]">Join 12,000+ members navigating this right now</p>
            </div>
            <h2 className="text-h1 mt-4 max-w-[18ch] text-[var(--haven-cream)]">This is a lot. Let’s take it one step at a time.</h2>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
              Set up your profile, see your timeline, and get one clear next step grounded in your actual situation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "cream", size: "lg" })} href="/register">
                Create your Haven profile
              </Link>
              <Link className={buttonVariants({ variant: "ghost-light", size: "lg" })} href="/login">
                I already have an account
              </Link>
            </div>
            <p className="mt-4 text-[12px] text-[rgba(253,250,246,0.45)]">Free to start · No credit card required · Cancel anytime</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="content-container-wide flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <HavenBrand compact />
            {IMMIG_WIZARD_URL ? (
              <a
                href={IMMIG_WIZARD_URL}
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

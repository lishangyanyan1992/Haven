import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, MessageCircle, ShieldAlert, Users } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
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
    body: "Haven translated the noise into a plan I could actually follow. The community examples mattered as much as the dates."
  },
  {
    title: "It felt like a friend who’d done this before.",
    body: "The timeline didn’t just tell me when things happened. It told me what to do now and what to ignore."
  }
];

export default function HomePage() {
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--haven-sage)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">H-1B · OPT · L-1 · O-1</p>
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
          <div className="content-container-wide py-5">
            <p className="text-body-sm text-center">
              Based on what Haven members shared, the product shows what to do now, what can wait, and what people in the same situation tried next.
            </p>
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
                  "animate-enter rounded-[var(--radius-2xl)] p-6 shadow-[0_2px_16px_-4px_rgba(44,54,48,0.07)]",
                  index === 1 ? "bg-[var(--haven-sky-light)]" : "bg-[var(--haven-sand)]"
                )}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--haven-white)] text-[var(--haven-ink)]">
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

        <section className="content-container-wide py-20 lg:py-28" id="community">
          <div className="max-w-[62ch]">
            <p className="text-label">Community stories</p>
            <h2 className="text-h1 mt-4">People trust specifics, not slogans.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {stories.map((story) => (
              <article key={story.title} className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-6 shadow-[0_2px_12px_-4px_rgba(58,110,132,0.08)]">
                <MessageCircle className="h-5 w-5 text-[var(--haven-sky-ink)]" />
                <h3 className="text-h2 mt-4">{story.title}</h3>
                <p className="text-body mt-3">{story.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="content-container-wide py-20 lg:py-28">
          <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-10 text-[var(--haven-cream)] md:px-10 md:py-12">
            <p className="text-label text-[rgba(253,250,246,0.72)]">Start here</p>
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
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)]">
        <div className="content-container-wide flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <HavenBrand compact />
          <p className="text-caption">Haven provides information, not legal advice. Verify decisions with a qualified attorney.</p>
        </div>
      </footer>
    </div>
  );
}

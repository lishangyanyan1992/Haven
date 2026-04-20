import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, FolderOpen, ShieldAlert, Users } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getAuthorProfile, getOrganizationStructuredData } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Haven — Immigration Planning for H-1B Holders",
  description:
    "Haven is built by someone who lived through two H-1B layoffs. We help H-1B, F-1, O-1, and employment-based green card holders navigate layoffs, transfers, priority dates, and critical next steps — all in one place.",
  alternates: {
    canonical: "/about"
  },
  openGraph: {
    url: absoluteUrl("/about"),
    title: "About Haven — Immigration Planning for H-1B Holders",
    description:
      "Haven is built by someone who lived through two H-1B layoffs. We help H-1B, F-1, O-1, and employment-based green card holders navigate layoffs, transfers, priority dates, and critical next steps — all in one place."
  },
  twitter: {
    title: "About Haven — Immigration Planning for H-1B Holders",
    description:
      "Haven is built by someone who lived through two H-1B layoffs. We help H-1B, F-1, O-1, and employment-based green card holders navigate layoffs, transfers, priority dates, and critical next steps — all in one place."
  }
};

const whatHavenDoes = [
  {
    icon: Clock,
    title: "Personal immigration timeline",
    description:
      "See exactly which dates, grace periods, and action windows apply to your situation — not a generic guide, but your specific path.",
    bg: "bg-[var(--haven-sand)]"
  },
  {
    icon: ShieldAlert,
    title: "H-1B layoff planning",
    description:
      "A calm 60-day plan that surfaces one clear action at a time, so you know exactly what to do the day a layoff happens.",
    bg: "bg-[var(--haven-sky-light)]"
  },
  {
    icon: Users,
    title: "Matched community",
    description:
      "Stories and tactics from people at the same visa stage, country queue, and moment — not random forum posts.",
    bg: "bg-[rgba(236,243,238,0.92)]"
  },
  {
    icon: FolderOpen,
    title: "Document vault",
    description:
      "One place for I-94s, approval notices, offer letters, and attorney communications — so nothing gets lost when it matters most.",
    bg: "bg-[rgba(240,247,249,0.92)]"
  }
];

const audience = [
  "H-1B holders",
  "H-1B transfer applicants",
  "F-1 / OPT graduates",
  "O-1 applicants",
  "EB-2 / EB-3 green card applicants",
  "I-485 adjustment of status",
  "International tech workers",
  "Laid-off visa holders"
];

const editorialPillars = [
  {
    icon: BookOpen,
    heading: "Experience-first",
    body: "Guides and articles are written by H-1B holders, green card applicants, and immigration practitioners who have been through the process."
  },
  {
    icon: ShieldAlert,
    heading: "Policy-grounded",
    body: "Content is checked against USCIS policy guidance, the Federal Register, and attorney-reviewed sources. We cite primary sources wherever possible."
  },
  {
    icon: Clock,
    heading: "Actively maintained",
    body: "Immigration rules change. We review and update content when USCIS policy, Visa Bulletin dates, or processing times shift materially."
  }
];

const faqs = [
  {
    question: "What is Haven?",
    answer:
      "Haven is an immigration planning platform for H-1B and adjacent visa holders in the United States. It provides personal timelines, layoff planning tools, a matched community, and a document vault — all in one place."
  },
  {
    question: "Is Haven free to use?",
    answer:
      "Yes. Haven's core tools, public guides, and immigration timeline are free to use. There is no credit card required to get started."
  },
  {
    question: "Who is Haven built for?",
    answer:
      "Haven is built for H-1B holders, F-1/OPT graduates, O-1 applicants, and anyone navigating employment-based immigration in the U.S. — especially during layoffs, employer changes, and priority date transitions."
  },
  {
    question: "Does Haven provide legal advice?",
    answer:
      "No. Haven provides information and planning tools, not legal advice. All content is written to help you understand your options and ask better questions. For decisions with legal consequences, consult a qualified immigration attorney."
  }
];

export default function AboutPage() {
  const founder = getAuthorProfile("Haven founder");
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" }
  ]);
  const organizationData = getOrganizationStructuredData();

  const personData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Yanyan",
    jobTitle: "Founder",
    worksFor: {
      "@type": "Organization",
      name: "Haven",
      url: absoluteUrl("/").toString()
    },
    description:
      "Yanyan built Haven after experiencing two H-1B layoffs firsthand. She is focused on reducing uncertainty for global talent navigating U.S. immigration.",
    url: absoluteUrl("/about#founder").toString()
  };

  const aboutPageData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Haven",
    description:
      "Haven is an immigration planning platform built by someone who lived through two H-1B layoffs. It helps H-1B holders, F-1/OPT graduates, and employment-based green card applicants navigate layoffs, transfers, and priority date decisions.",
    url: absoluteUrl("/about").toString(),
    publisher: {
      "@type": "Organization",
      name: "Haven",
      url: absoluteUrl("/").toString()
    }
  };

  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer
      }
    }))
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
      />
      <PublicNavbar currentPath="/about" />

      <main>
        {/* Hero */}
        <section className="content-container-visual py-16 lg:py-24 xl:py-28">
          <div className="max-w-[72ch]">
            <p className="text-label">About Haven</p>
            <h1 className="text-display mt-5 max-w-fit">
              <span className="block whitespace-nowrap">Built by those who&apos;ve lived it,</span>
              <span className="block whitespace-nowrap">for those navigating it now.</span>
            </h1>
            <p className="text-body mt-6 max-w-[62ch]">
              Haven exists to reduce uncertainty for global talent navigating layoffs, employer changes, deadlines, and
              critical next-step decisions that are often scattered across group chats, attorney calls, and forum
              threads.
            </p>
          </div>
        </section>

        {/* What Haven does */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-white)]">
          <div className="content-container-visual py-16 lg:py-20 xl:py-24">
            <div className="max-w-[62ch]">
              <p className="text-label">What Haven does</p>
              <h2 className="text-h1 mt-4">Everything you need to navigate U.S. immigration, in one place.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                Immigration decisions are time-sensitive and consequential. Haven replaces scattered sources with a
                single, structured place to plan, decide, and track.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {whatHavenDoes.map((item) => (
                <article
                  key={item.title}
                  className={`rounded-[var(--radius-2xl)] p-6 shadow-[0_2px_16px_-4px_rgba(44,54,48,0.07)] ${item.bg}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--haven-white)] text-[var(--haven-ink)]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-h2 mt-5">{item.title}</h3>
                  <p className="text-body mt-3">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-sand)]">
          <div className="content-container-visual py-16 lg:py-20 xl:py-24">
            <div className="max-w-[62ch]">
              <p className="text-label">Who it&apos;s for</p>
              <h2 className="text-h1 mt-4">Made for international talent navigating the U.S. immigration system.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                Whether you are maintaining status, preparing for a transfer, or managing a layoff, Haven is built for
                the moments when the stakes are high and time is short.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {audience.map((label) => (
                <span key={label} className="tag tag-visa">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-white)]">
          <div className="content-container-visual py-16 lg:py-20 xl:py-24">
            <article id="founder" className="max-w-[72ch] rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7">
              <p className="text-label">Founder</p>
              <div className="relative mt-5 aspect-square max-w-[220px] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-cream)]">
                <Image
                  src="/about/yanyan-passport.jpg"
                  alt="Portrait of Yanyan, founder of Haven"
                  width={600}
                  height={600}
                  className="h-full w-full object-cover"
                  sizes="220px"
                />
              </div>
              <h2 className="text-h1 mt-4">{founder.name}</h2>
              <p className="text-body mt-4">
                Yanyan built Haven after experiencing two H-1B layoffs firsthand and seeing how difficult it can be to
                build a life in the United States while navigating immigration uncertainty.
              </p>
              <p className="text-body mt-4">
                Those experiences made one thing clear: the hardest part is not just finding information. It is staying
                proactive, making time-sensitive decisions with incomplete visibility, and navigating a system with no
                shared source of truth.
              </p>
              <blockquote className="mt-6 border-l-2 border-[var(--haven-ink)] pl-5">
                <p className="text-body italic text-[var(--haven-ink-mid)]">
                  &ldquo;I built Haven because I couldn&apos;t find one place that told me what to do next — not just
                  what the rules were, but what my specific next step was, given my situation, my employer, and my
                  deadline.&rdquo;
                </p>
                <footer className="mt-2 text-[13px] font-medium text-[var(--haven-ink)]">— Yanyan, Founder</footer>
              </blockquote>
              <div className="mt-6">
                <Link className={buttonVariants({ variant: "outline" })} href="/blog/why-i-started-haven">
                  Read the founder story
                </Link>
              </div>
            </article>
          </div>
        </section>

        {/* Editorial */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-cream)]">
          <div id="editorial" className="content-container-visual py-16 lg:py-20 xl:py-24">
            <div className="max-w-[62ch]">
              <p className="text-label">Editorial</p>
              <h2 className="text-h1 mt-4">How Haven content is written and maintained.</h2>
              <p className="text-body mt-4">
                All public content on Haven is written by people with direct experience navigating H-1B and
                employment-based immigration — not generated automatically or sourced from unverified forums.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {editorialPillars.map((item) => (
                <div
                  key={item.heading}
                  className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-sand)] text-[var(--haven-ink)]">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-h2 mt-4">{item.heading}</h3>
                  <p className="text-body mt-2">{item.body}</p>
                </div>
              ))}
            </div>
            <p className="text-caption mt-6 text-[var(--haven-ink-mid)]">
              Haven provides information, not legal advice. For decisions with legal consequences, consult a qualified
              immigration attorney.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-white)]">
          <div className="content-container-visual py-16 lg:py-20 xl:py-24">
            <div className="max-w-[72ch]">
              <p className="text-label">FAQ</p>
              <h2 className="text-h1 mt-4">Common questions about Haven.</h2>
              <dl className="mt-8 flex flex-col gap-4">
                {faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6"
                  >
                    <dt className="text-h2">{faq.question}</dt>
                    <dd className="text-body mt-3">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[var(--color-border)] bg-[var(--haven-cream)]">
          <div className="content-container-visual py-16 lg:py-20 xl:py-24">
            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-10 text-[var(--haven-cream)] md:px-10 md:py-12">
              <h2 className="text-h1 max-w-[22ch] text-[var(--haven-cream)]">
                Your situation is specific. Your plan should be too.
              </h2>
              <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
                Set up your profile in minutes and see your personal immigration timeline, layoff readiness, and one
                clear next step grounded in your actual visa status.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className={buttonVariants({ variant: "cream", size: "lg" })} href="/register">
                  Get started free
                </Link>
                <Link className={buttonVariants({ variant: "ghost-light", size: "lg" })} href="/guides">
                  Explore public guides
                </Link>
              </div>
              <p className="mt-4 text-[12px] text-[rgba(253,250,246,0.45)]">Free to start · No credit card required</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

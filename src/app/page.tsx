import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calculator, CalendarCheck, Clock, FileText, FolderOpen, Heart, Landmark, MessageCircle, Search, ShieldAlert, Sparkles, Star, Users } from "lucide-react";

import { BlogCard } from "@/components/app/blog-card";
import { GuideCard } from "@/components/app/guide-card";
import { HavenBrand } from "@/components/app/haven-brand";
import { HowItWorksShowcase } from "@/components/app/how-it-works-showcase";
import { PublicNavbar, getPublicImmigWizardUrl } from "@/components/app/public-navbar";
import { WaitlistModalProvider, WaitlistTrigger } from "@/components/app/waitlist-modal";
import { buttonVariants } from "@/components/ui/button";
import { getRecentBlogPosts } from "@/lib/blog";
import { getFeaturedGuides } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";
import { publicTools, type ToolSlug } from "@/lib/tools";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Clock,
    title: "Personal timelines",
    description: "See the dates, ranges, and action windows that actually matter for your path.",
    preview: TimelineFeaturePreview,
    cardClass: "bg-[var(--haven-sand)]",
    accentClass: "bg-[var(--haven-sage)]",
    iconClass: "bg-[var(--haven-white)]",
    layoutClass: "xl:col-span-4"
  },
  {
    icon: ShieldAlert,
    title: "Layoff planning",
    description: "A calmer 60-day plan with one clear action at a time instead of panic-driven checklists.",
    preview: LayoffFeaturePreview,
    cardClass: "bg-[var(--haven-sky-light)]",
    accentClass: "bg-[var(--haven-sky)]",
    iconClass: "bg-white/70",
    layoutClass: "xl:col-span-4"
  },
  {
    icon: Users,
    title: "Matched community",
    description: "Stories and tactics from people in the same visa stage, country queue, and moment.",
    preview: CommunityFeaturePreview,
    cardClass: "bg-[rgba(236,243,238,0.92)]",
    accentClass: "bg-[var(--haven-sage)]",
    iconClass: "bg-[var(--haven-white)]",
    layoutClass: "xl:col-span-4"
  },
  {
    icon: FolderOpen,
    title: "Document vault",
    description: "Save your documents and keep communication with employers, lawyers, and more in one place so you never lose a thing.",
    preview: DocumentVaultFeaturePreview,
    cardClass: "bg-[rgba(240,247,249,0.92)]",
    accentClass: "bg-[var(--haven-sky)]",
    iconClass: "bg-[var(--haven-white)]",
    layoutClass: "xl:col-span-3"
  },
  {
    icon: Heart,
    title: "Green card packet builder",
    description: "A guided home for your adjustment-of-status packet, with one place for forms, documents, and next steps.",
    preview: WaitlistFeaturePreview,
    cardClass: "bg-[rgba(249,242,236,0.96)]",
    accentClass: "bg-[var(--haven-blush)]",
    iconClass: "bg-[var(--haven-white)]",
    layoutClass: "xl:col-span-3"
  },
  {
    icon: Search,
    title: "Service provider marketplace",
    description: "Find lawyers, insurance, and other service providers tailored to international talent in the U.S.",
    preview: MarketplaceFeaturePreview,
    cardClass: "bg-[rgba(241,245,250,0.96)]",
    accentClass: "bg-[var(--haven-sky)]",
    iconClass: "bg-[var(--haven-white)]",
    layoutClass: "xl:col-span-3"
  },
  {
    icon: Sparkles,
    title: "H-1B-friendly job board",
    description: "Find roles from employers that understand sponsorship, transfers, and hiring international talent.",
    preview: JobBoardFeaturePreview,
    cardClass: "bg-[rgba(242,246,239,0.96)]",
    accentClass: "bg-[var(--haven-sage)]",
    iconClass: "bg-[var(--haven-white)]",
    layoutClass: "xl:col-span-3"
  }
];

const stories = [
  {
    title: "You have 60 days. Here’s what helped.",
    body: "Haven translated the noise into a plan I could actually follow. The community examples mattered as much as the dates.",
    author: "Priya S.",
    detail: "Layoff → F-1 → I-140 → back to H-1B",
    initials: "PS"
  },
  {
    title: "It felt like a friend who’d done this before.",
    body: "The timeline didn’t just tell me when things happened. It told me what to do now and what to ignore.",
    author: "Marcus L.",
    detail: "H-1B → O-1 → EB-1A",
    initials: "ML"
  },
  {
    title: "The transfer timeline made the move feel manageable.",
    body: "I could finally see what had to happen first, what could wait, and where premium processing actually changed the math.",
    author: "Ananya R.",
    detail: "H-1B transfer · new employer",
    initials: "AR"
  }
];

const toolIcons: Record<ToolSlug, typeof Sparkles> = {
  "uscis-vaccine-finder": ShieldAlert,
  "grace-period-calculator": Calculator,
  "priority-date-checker": Sparkles,
  "document-pack-builder": FolderOpen
};

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

function TimelineFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(74,92,84,0.16)] bg-[rgba(255,255,255,0.84)] p-4 shadow-[0_12px_30px_-18px_rgba(44,54,48,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">Your timeline</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">H-1B transfer in progress</p>
        </div>
        <span className="rounded-full bg-[var(--haven-sage-light)] px-2.5 py-1 text-[11px] font-medium text-[var(--haven-ink-mid)]">
          USCIS synced
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { label: "Receipt notice expected", date: "Apr 22", state: "done" },
          { label: "Travel decision window", date: "May 03", state: "active" },
          { label: "Premium processing latest safe date", date: "May 16", state: "upcoming" }
        ].map((item) => (
          <div key={item.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border",
                item.state === "done" && "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]",
                item.state === "active" && "border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)]",
                item.state === "upcoming" && "border-[var(--color-border)] bg-[rgba(255,255,255,0.76)]"
              )}
            >
              <CalendarCheck className="h-4 w-4 text-[var(--haven-ink)]" />
            </div>
            <div>
              <p className="text-[13px] font-medium leading-tight text-[var(--haven-ink)]">{item.label}</p>
              <div className="mt-1 h-1.5 rounded-full bg-[rgba(74,92,84,0.09)]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    item.state === "done" && "w-full bg-[var(--haven-sage)]",
                    item.state === "active" && "w-3/5 bg-[var(--haven-sky)]",
                    item.state === "upcoming" && "w-1/4 bg-[rgba(74,92,84,0.18)]"
                  )}
                />
              </div>
            </div>
            <p className="text-[12px] font-semibold text-[var(--haven-ink-mid)]">{item.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LayoffFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(58,110,132,0.18)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_12px_30px_-18px_rgba(58,110,132,0.26)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-sky-ink)]">60-day plan</p>
          <p className="mt-1 text-[28px] font-semibold leading-none text-[var(--haven-ink)]">Day 18</p>
        </div>
        <div className="rounded-[1rem] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-2 text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--haven-sky-ink)]">Next step</p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--haven-ink)]">Book transfer consult</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {[
          ["Today", "Preserve payroll docs and I-94 copy"],
          ["This week", "Shortlist cap-exempt and transfer-ready roles"],
          ["By day 30", "Choose transfer, B-2, or departure path"]
        ].map(([label, action], index) => (
          <div key={label} className="flex items-start gap-3 rounded-[1rem] border border-[rgba(58,110,132,0.12)] bg-[rgba(248,251,252,0.86)] p-3">
            <div
              className={cn(
                "mt-0.5 h-2.5 w-2.5 rounded-full",
                index === 0 ? "bg-[var(--haven-blush)]" : index === 1 ? "bg-[var(--haven-sky)]" : "bg-[var(--haven-sage)]"
              )}
            />
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-ink-mid)]">{label}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--haven-ink)]">{action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommunityFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(74,92,84,0.14)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_12px_30px_-18px_rgba(44,54,48,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">Matched stories</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">People in your queue and stage</p>
        </div>
        <div className="flex -space-x-2">
          {["A", "R", "N"].map((initial) => (
            <div
              key={initial}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--haven-white)] bg-[var(--haven-sky-light)] text-[12px] font-semibold text-[var(--haven-sky-ink)]"
            >
              {initial}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[
          {
            title: "H-1B transfer after layoff",
            meta: "India queue · day 21",
            body: "Reached out to three transfer-ready recruiters first, then upgraded to premium processing."
          },
          {
            title: "OPT to H-1B backup plan",
            meta: "Nigeria · STEM OPT",
            body: "Used the same checklist to compare cap-gap timing, travel risk, and fallback options."
          }
        ].map((story, index) => (
          <div
            key={story.title}
            className={cn(
              "rounded-[1rem] border p-3",
              index === 0
                ? "border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)]"
                : "border-[rgba(74,92,84,0.14)] bg-[rgba(255,255,255,0.86)]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-[var(--haven-ink)]">{story.title}</p>
              <MessageCircle className="h-4 w-4 text-[var(--haven-ink-mid)]" />
            </div>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--haven-ink-mid)]">{story.meta}</p>
            <p className="mt-2 text-[13px] leading-snug text-[var(--haven-ink-mid)]">{story.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentVaultFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(58,110,132,0.16)] bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_12px_30px_-18px_rgba(58,110,132,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-sky-ink)]">Document vault</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">Everything for this case, saved</p>
        </div>
        <span className="rounded-full bg-[var(--haven-sky-light)] px-2.5 py-1 text-[11px] font-medium text-[var(--haven-sky-ink)]">
          14 items
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {[
          { label: "H-1B approval notice", meta: "PDF · uploaded today", icon: FileText },
          { label: "Employer immigration email", meta: "Forwarded from HR", icon: MessageCircle },
          { label: "Attorney checklist", meta: "Shared by counsel", icon: FolderOpen }
        ].map(({ label, meta, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-[1rem] border border-[rgba(58,110,132,0.12)] bg-[rgba(248,251,252,0.92)] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-[var(--haven-white)] text-[var(--haven-sky-ink)] shadow-[0_8px_18px_-16px_rgba(58,110,132,0.32)]">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--haven-ink)]">{label}</p>
              <p className="mt-1 text-[12px] text-[var(--haven-ink-mid)]">{meta}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[1rem] border border-dashed border-[var(--haven-sky-mid)] bg-[rgba(236,247,251,0.76)] px-3 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sky-ink)]">Also saved</p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--haven-ink-mid)]">Offer letters, USCIS receipts, lawyer notes, and any message thread tied to your case.</p>
      </div>
    </div>
  );
}

function WaitlistFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(186,123,114,0.18)] bg-[rgba(255,255,255,0.9)] p-4 shadow-[0_12px_30px_-18px_rgba(100,56,48,0.2)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(186,123,114,0.24)] bg-[rgba(255,245,242,0.9)] px-3 py-1">
            <Heart className="h-3.5 w-3.5 text-[var(--haven-blush-ink)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-blush-ink)]">Coming soon</p>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-[var(--haven-ink)]">10+ forms. One packet. Zero guesswork.</p>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-snug text-[var(--haven-ink-mid)]">
            We&apos;re building a guided green card packet builder so you can keep forms, evidence, and communications in one place.
          </p>
        </div>
        <div className="rounded-[1rem] border border-[rgba(186,123,114,0.18)] bg-[rgba(255,248,246,0.92)] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-blush-ink)]">Includes</p>
          <p className="mt-1 text-[13px] font-medium text-[var(--haven-ink)]">Family-based and employment-based packet flows</p>
        </div>
      </div>

      <WaitlistTrigger
        className="mt-5 w-full justify-center"
        interestKey="green-card-packet-builder"
        interestLabel="Green card packet builder"
      >
        Join the waitlist
      </WaitlistTrigger>

      <p className="mt-3 text-[12px] text-[var(--haven-ink-mid)]">Enter your name and email to save your spot and hear when this opens.</p>
    </div>
  );
}

function MarketplaceFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(86,114,142,0.18)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_12px_30px_-18px_rgba(61,90,120,0.2)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(86,114,142,0.2)] bg-[rgba(239,246,251,0.92)] px-3 py-1">
            <Search className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sky-ink)]">Coming soon</p>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-[var(--haven-ink)]">Trusted help for the parts you shouldn&apos;t guess on.</p>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-snug text-[var(--haven-ink-mid)]">
            Browse lawyers, insurance, tax help, and other providers that actually work with international talent in the United States.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {["Immigration lawyers", "Health insurance", "Tax and payroll help", "Move and relocation support"].map((item) => (
          <div key={item} className="rounded-[1rem] border border-[rgba(86,114,142,0.12)] bg-[rgba(243,248,251,0.92)] px-3 py-2">
            <p className="text-[13px] font-medium text-[var(--haven-ink)]">{item}</p>
          </div>
        ))}
      </div>

      <WaitlistTrigger
        className="mt-5 w-full justify-center"
        interestKey="service-provider-marketplace"
        interestLabel="Service provider marketplace"
      >
        Join the waitlist
      </WaitlistTrigger>

      <p className="mt-3 text-[12px] text-[var(--haven-ink-mid)]">Join the list to hear when the marketplace opens.</p>
    </div>
  );
}

function JobBoardFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(96,136,101,0.18)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_12px_30px_-18px_rgba(74,92,84,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(96,136,101,0.2)] bg-[rgba(239,246,238,0.92)] px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-[var(--haven-sage)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sage)]">Coming soon</p>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-[var(--haven-ink)]">A job board built for sponsorship reality.</p>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-snug text-[var(--haven-ink-mid)]">
            Search H-1B-friendly jobs with clearer signals on transfer support, immigration experience, timing, and cross-sourced leads shared by users.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {["H-1B transfer-friendly roles", "Cap-exempt employers", "Immigration-aware recruiters", "Layoff-safe next-step filters"].map((item) => (
          <div key={item} className="rounded-[1rem] border border-[rgba(96,136,101,0.12)] bg-[rgba(243,248,241,0.92)] px-3 py-2">
            <p className="text-[13px] font-medium text-[var(--haven-ink)]">{item}</p>
          </div>
        ))}
      </div>

      <WaitlistTrigger
        className="mt-5 w-full justify-center"
        interestKey="h1b-job-board"
        interestLabel="H-1B-friendly job board"
      >
        Join the waitlist
      </WaitlistTrigger>

      <p className="mt-3 text-[12px] text-[var(--haven-ink-mid)]">Join the list to hear when the job board opens.</p>
    </div>
  );
}

export default function HomePage() {
  const recentPosts = getRecentBlogPosts(3);
  const featuredGuides = getFeaturedGuides(3);
  const immigWizardUrl = getPublicImmigWizardUrl();
  const pageSectionClass = "border-t border-[var(--color-border)]";
  const pageSectionInnerClass = "content-container-visual pt-16 pb-18 md:pt-20 md:pb-20 lg:pt-24 lg:pb-24 xl:pt-28 xl:pb-28";

  return (
    <WaitlistModalProvider sourcePath="/">
      <div className="min-h-screen">
        <PublicNavbar currentPath="/" />

        <main>
        <section className="content-container-visual relative overflow-hidden bg-[var(--haven-cream)] pt-20 pb-18 md:pt-20 md:pb-20 lg:pt-24 lg:pb-24 xl:pt-28 xl:pb-28">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-x-[-4%] inset-y-4 rounded-[3rem] opacity-[0.32]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, rgba(191, 10, 48, 0.3) 0 30px, rgba(255, 255, 255, 0) 30px 60px)"
              }}
            />
            <div className="absolute right-[8%] top-6 h-[11rem] w-[14rem] rounded-[1.75rem] bg-[rgba(10,49,97,0.24)] shadow-[0_20px_60px_-40px_rgba(10,49,97,0.45)] md:h-[12.5rem] md:w-[16rem] lg:right-[18%] lg:top-8 lg:h-[15rem] lg:w-[19rem]">
              <div className="grid h-full w-full grid-cols-5 gap-3 p-4 md:p-5">
                {Array.from({ length: 20 }).map((_, index) => (
                  <span key={index} className="h-1.5 w-1.5 rounded-full bg-[rgba(255,255,255,0.78)]" />
                ))}
              </div>
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(253,250,246,0.92)_0%,rgba(253,250,246,0.72)_42%,rgba(253,250,246,0.76)_100%)]" />
          </div>

          <div className="relative z-10 grid gap-8 px-0 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 xl:grid-cols-[0.84fr_1.16fr] xl:gap-20 2xl:gap-24">
          <div className="animate-enter">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-4 py-2">
                <Landmark className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-sky-ink)]">
                  Built for U.S. immigration
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">
                  Free to use
                </p>
              </div>
            </div>
            <h1 className="text-display mt-5 max-w-[12ch]">
              You don&apos;t have to navigate immigration <em>alone</em>.
            </h1>
            <p className="text-body mt-6 max-w-[60ch]">
              Haven helps global talent navigate U.S. visas and green cards, from H-1B and F-1/OPT to job changes, layoffs, priority dates, and family- or employment-based pathways.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "default", size: "lg" })} href="/register">
                Get Started
              </Link>
            </div>
          </div>

          <div className="animate-enter rounded-[2rem] border border-[var(--color-border)] bg-[var(--haven-white)] p-3 shadow-[0_12px_48px_-12px_rgba(44,54,48,0.12)] lg:p-4">
            <div className="relative overflow-hidden rounded-[calc(var(--radius-2xl)+0.25rem)]">
              <Image
                src="/hero-banner.png"
                alt="Three people reviewing immigration documents together"
                width={1536}
                height={1024}
                className="h-auto w-full object-cover"
                sizes="(min-width: 1728px) 62rem, (min-width: 1440px) 58rem, (min-width: 1280px) 54rem, (min-width: 1024px) 50vw, 100vw"
                quality={95}
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_42%,rgba(44,54,48,0.08)_100%)]" />
            </div>
          </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="features">
          <div className={pageSectionInnerClass}>
            <div className="max-w-[62ch]">
              <p className="text-label">Why Haven</p>
              <h2 className="text-h1 mt-4 max-w-none whitespace-nowrap">All your immigration support, in one place</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-6">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className={cn(
                    "animate-enter group relative overflow-hidden rounded-[var(--radius-2xl)] p-6",
                    "shadow-[0_2px_16px_-4px_rgba(44,54,48,0.07)] transition-all duration-200",
                    "hover:shadow-[0_8px_32px_-8px_rgba(44,54,48,0.14)] hover:-translate-y-0.5",
                    feature.cardClass,
                    feature.layoutClass
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-[3px]",
                      feature.accentClass
                    )}
                  />
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] text-[var(--haven-ink)]",
                      feature.iconClass
                    )}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-h2 mt-5">{feature.title}</h3>
                  <p className="text-body mt-3">{feature.description}</p>
                  <feature.preview />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")} id="how-it-works">
          <div className={pageSectionInnerClass}>
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <p className="text-label">How it works</p>
                <h2 className="text-h1 mt-4">Give Haven a few details. Get value back immediately.</h2>
                <p className="text-body mt-4 max-w-[60ch]">
                  The setup is short by design. Each answer unlocks a timeline, better recommendations, or more relevant stories from people in the same situation.
                </p>
              </div>
              <HowItWorksShowcase />
            </div>
          </div>
        </section>

        {immigWizardUrl ? (
          <section className={cn(pageSectionClass, "bg-[var(--haven-sage-light,var(--haven-sand))]")}>
            <div className={pageSectionInnerClass}>
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
                    href={immigWizardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-ink)] px-6 py-3 text-[15px] font-semibold text-[var(--haven-cream)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--haven-ink-mid,var(--haven-ink))] hover:shadow-md"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <p className="text-caption text-center lg:text-right">Takes about 10 minutes</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className={cn(pageSectionClass, "bg-[var(--haven-sky-light)]")} id="community">
          <div className={pageSectionInnerClass}>
            <div className="max-w-[62ch]">
              <p className="text-label">Community stories</p>
              <h2 className="text-h1 mt-4">People trust specifics, not slogans.</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
              {stories.map((story) => (
                <article key={story.title} className="flex flex-col rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-white)] p-6 shadow-[0_2px_12px_-4px_rgba(58,110,132,0.08)]">
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
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")}>
          <div className={pageSectionInnerClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">Free tools</p>
              <h2 className="text-h1 mt-4 max-w-[24ch]">Useful calculators and checkers you can open right now — no account needed.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                Try any tool before you sign up. Grace periods, Visa Bulletin math, document prep — useful on their own, more powerful inside Haven.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/tools">
              Get Started
            </Link>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {publicTools.map((tool) => {
              const Icon = toolIcons[tool.slug];

              return (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_8px_32px_-12px_rgba(44,54,48,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-12px_rgba(44,54,48,0.18)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-h2 mt-5">{tool.title}</h3>
                <p className="text-body mt-3">{tool.teaser}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--haven-ink)]">
                  Use this tool
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
            })}
          </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-sand)]")}>
          <div className={pageSectionInnerClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">Popular guides</p>
              <h2 className="text-h1 mt-4">Plain-language guides for layoffs, grace periods, and transfers.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                Step-by-step guidance for the moments when you need to know what to do next — written in plain language, not legalese.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/guides">
              Get Started
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featuredGuides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-white)]")}>
          <div className={pageSectionInnerClass}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[62ch]">
              <p className="text-label">From the blog</p>
              <h2 className="text-h1 mt-4">Practical reads for layoffs, transfers, and green card uncertainty.</h2>
              <p className="text-body mt-4 max-w-[58ch]">
                The blog is where Haven publishes clear, tactical articles you can share, revisit, and update over time.
              </p>
            </div>
            <Link className={buttonVariants({ variant: "outline" })} href="/blog">
              Get Started
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {recentPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
          </div>
        </section>

        <section className={cn(pageSectionClass, "bg-[var(--haven-cream)] content-container-visual pt-16 pb-20 md:pt-20 md:pb-20 lg:pt-24 lg:pb-24 xl:pt-28 xl:pb-28")}>
          <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-10 text-[var(--haven-cream)] md:px-10 md:py-12">
            <h2 className="text-h1 mt-4 max-w-[18ch] text-[var(--haven-cream)]">This is a lot. Let’s take it one step at a time.</h2>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
              Set up your profile, see your timeline, and get one clear next step grounded in your actual situation.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ variant: "cream", size: "lg" })} href="/register">
                Get Started
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
          <div className="content-container-visual flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
              <HavenBrand compact />
              <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/tools">
                Free tools
              </Link>
              <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/guides">
                Guides
              </Link>
              <Link className="text-caption text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]" href="/blog">
                Blog
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
    </WaitlistModalProvider>
  );
}

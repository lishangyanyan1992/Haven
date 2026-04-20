"use client";

import { motion } from "framer-motion";
import { CalendarCheck, FileText, FolderOpen, Heart, MessageCircle, Search, Sparkles } from "lucide-react";

import { WaitlistTrigger } from "@/components/app/waitlist-modal";
import { cn } from "@/lib/utils";

export function TimelineFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(74,92,84,0.16)] bg-[rgba(255,255,255,0.84)] p-4 shadow-[0_12px_30px_-18px_rgba(44,54,48,0.28)] transition-all hover:shadow-[0_16px_40px_-12px_rgba(44,54,48,0.3)] group">
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
        ].map((item, index) => (
          <div key={item.label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                item.state === "done" && "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]",
                item.state === "active" && "border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)]",
                item.state === "upcoming" && "border-[var(--color-border)] bg-[rgba(255,255,255,0.76)]"
              )}
            >
              <CalendarCheck className="h-4 w-4 text-[var(--haven-ink)]" />
            </div>
            <div>
              <p className="text-[13px] font-medium leading-tight text-[var(--haven-ink)]">{item.label}</p>
              <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-[rgba(74,92,84,0.09)]">
                <motion.div
                  initial={{ width: "0%" }}
                  whileInView={{
                    width: item.state === "done" ? "100%" : item.state === "active" ? "60%" : "25%"
                  }}
                  transition={{ duration: 1, delay: 0.1 * index, ease: "easeOut" }}
                  viewport={{ once: true }}
                  className={cn(
                    "h-full rounded-full",
                    item.state === "done" && "bg-[var(--haven-sage)]",
                    item.state === "active" && "bg-[var(--haven-sky)]",
                    item.state === "upcoming" && "bg-[rgba(74,92,84,0.18)]"
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

export function LayoffFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(58,110,132,0.18)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_12px_30px_-18px_rgba(58,110,132,0.26)] transition-all hover:shadow-[0_16px_40px_-12px_rgba(58,110,132,0.3)]">
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
          <motion.div
            key={label}
            whileHover={{ scale: 1.02 }}
            className="flex items-start gap-3 rounded-[1rem] border border-[rgba(58,110,132,0.12)] bg-[rgba(248,251,252,0.86)] p-3 cursor-default"
          >
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
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function CommunityFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(74,92,84,0.14)] bg-[rgba(255,255,255,0.88)] p-4 shadow-[0_12px_30px_-18px_rgba(44,54,48,0.24)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--haven-ink-mid)]">Matched stories</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--haven-ink)]">People in your queue and stage</p>
        </div>
        <div className="flex -space-x-2">
          {["A", "R", "N"].map((initial, i) => (
            <motion.div
              key={initial}
              initial={{ x: -10, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              viewport={{ once: true }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--haven-white)] bg-[var(--haven-sky-light)] text-[12px] font-semibold text-[var(--haven-sky-ink)] shadow-sm"
            >
              {initial}
            </motion.div>
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
          <motion.div
            key={story.title}
            whileHover={{ y: -2 }}
            className={cn(
              "rounded-[1rem] border p-3 hover:shadow-sm cursor-default",
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
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function DocumentVaultFeaturePreview() {
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
        ].map(({ label, meta, icon: Icon }, i) => (
          <motion.div
            key={label}
            whileHover={{ scale: 1.01 }}
            className="flex items-center gap-3 rounded-[1rem] border border-[rgba(58,110,132,0.12)] bg-[rgba(248,251,252,0.92)] p-3 cursor-default"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-[var(--haven-white)] text-[var(--haven-sky-ink)] shadow-[0_8px_18px_-16px_rgba(58,110,132,0.32)]">
              <Icon className="h-4 w-4 relative z-10" />
              {i === 0 && (
                <motion.div
                  className="absolute inset-0 rounded-[0.9rem] bg-current opacity-10"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--haven-ink)]">{label}</p>
              <p className="mt-1 text-[12px] text-[var(--haven-ink-mid)]">{meta}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 rounded-[1rem] border border-dashed border-[var(--haven-sky-mid)] bg-[rgba(236,247,251,0.76)] px-3 py-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sky-ink)]">Also saved</p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--haven-ink-mid)]">Offer letters, USCIS receipts, lawyer notes, and any message thread tied to your case.</p>
      </div>
    </div>
  );
}

export function WaitlistFeaturePreview() {
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
            We're building a guided green card packet builder so you can keep forms, evidence, and communications in one place.
          </p>
        </div>
        <div className="rounded-[1rem] border border-[rgba(186,123,114,0.18)] bg-[rgba(255,248,246,0.92)] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-blush-ink)]">Includes</p>
          <p className="mt-1 text-[13px] font-medium text-[var(--haven-ink)]">Family-based and employment-based packet flows</p>
        </div>
      </div>

      <WaitlistTrigger
        className="mt-5 w-full justify-center opacity-90 transition-opacity hover:opacity-100"
        interestKey="green-card-packet-builder"
        interestLabel="Green card packet builder"
      >
        Join the waitlist
      </WaitlistTrigger>

      <p className="mt-3 text-[12px] text-[var(--haven-ink-mid)]">Enter your name and email to save your spot and hear when this opens.</p>
    </div>
  );
}

export function MarketplaceFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(86,114,142,0.18)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_12px_30px_-18px_rgba(61,90,120,0.2)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(86,114,142,0.2)] bg-[rgba(239,246,251,0.92)] px-3 py-1">
            <Search className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sky-ink)]">Coming soon</p>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-[var(--haven-ink)]">Trusted help for the parts you shouldn't guess on.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {["Immigration lawyers", "Health insurance", "Tax and payroll help", "Move and relocation support"].map((item) => (
          <motion.div whileHover={{ scale: 1.02 }} key={item} className="rounded-[1rem] border border-[rgba(86,114,142,0.12)] bg-[rgba(243,248,251,0.92)] px-3 py-2 cursor-default">
            <p className="text-[13px] font-medium text-[var(--haven-ink)]">{item}</p>
          </motion.div>
        ))}
      </div>

      <WaitlistTrigger
        className="mt-5 w-full justify-center opacity-90 transition-opacity hover:opacity-100"
        interestKey="service-provider-marketplace"
        interestLabel="Service provider marketplace"
      >
        Join the waitlist
      </WaitlistTrigger>

      <p className="mt-3 text-[12px] text-[var(--haven-ink-mid)]">Join the list to hear when the marketplace opens.</p>
    </div>
  );
}

export function JobBoardFeaturePreview() {
  return (
    <div className="mt-8 rounded-[1.5rem] border border-[rgba(96,136,101,0.18)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_12px_30px_-18px_rgba(74,92,84,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(96,136,101,0.2)] bg-[rgba(239,246,238,0.92)] px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-[var(--haven-sage)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-sage)]">Coming soon</p>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-[var(--haven-ink)]">A job board built for sponsorship reality.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {["H-1B transfer-friendly roles", "Cap-exempt employers", "Immigration-aware recruiters", "Layoff-safe next-step filters"].map((item) => (
          <motion.div whileHover={{ scale: 1.02 }} key={item} className="rounded-[1rem] border border-[rgba(96,136,101,0.12)] bg-[rgba(243,248,241,0.92)] px-3 py-2 cursor-default">
            <p className="text-[13px] font-medium text-[var(--haven-ink)]">{item}</p>
          </motion.div>
        ))}
      </div>

      <WaitlistTrigger
        className="mt-5 w-full justify-center opacity-90 transition-opacity hover:opacity-100"
        interestKey="h1b-job-board"
        interestLabel="H-1B-friendly job board"
      >
        Join the waitlist
      </WaitlistTrigger>

      <p className="mt-3 text-[12px] text-[var(--haven-ink-mid)]">Join the list to hear when the job board opens.</p>
    </div>
  );
}

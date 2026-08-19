# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Employment-track immigrants in the United States, on the F-1 → OPT/CPT → H-1B → employment-based green card path. The primary visitor arrives in a bad moment and needs an answer today: an H-1B holder who was just laid off and is inside a 60-day clock, or an F-1/OPT student who was not selected in the H-1B lottery and is watching status run out. Both are weighted equally. They are anxious, time-pressed, often reading on a phone, and usually already lost in forum threads and law-firm pages that do not match their case.

A separate, broader family-based audience is served by ImmigWizard, a sibling product that is cross-promoted but deliberately not merged into Haven.

## Product Purpose

A person describes what just happened in their own words and gets an answer assembled from what people in the same situation actually did. Success is that they trust the answer enough to act on it — and, on the home page specifically, that they complete sign-up and onboarding, because the answer is only worth reading once it knows their case.

## Positioning

Answers are built from a moderated corpus of real, first-hand accounts from people on the same visa path — imported, deduplicated, summarized, and searched semantically — not from generic guidance written for everyone. The internal name for this is "wisdom of the crowd." A neighboring product with a generic LLM and a public knowledge base cannot truthfully claim it.

Sequencing is part of the position: the hardest moments first (missed lottery, layoff, status running out), long-term planning later.

## Operating Context

- Entry is usually a search result or a link shared inside an immigrant community, arriving during or just after a crisis.
- Reading happens on a phone, at night, often after a call with an employer or a lawyer.
- The alternatives visitors are comparing against are Reddit threads, employer HR, paid attorney consultations, and an unread pile of USCIS notices.
- Guides, resources, calculators and the sponsor-history directory are open to everyone without an account and carry organic search traffic; the answer flow requires an account.

## Capabilities and Constraints

- Live: an AI advisor that answers a question against the community corpus and the person's own case details; a short onboarding that captures visa, dates, and employer; account and settings; free public guides, blog, resource library, calculators, sponsor-history directory, and Day-1-CPT directory.
- Deliberately parked as of 2026-08-19 and switched off at the edge (listed with reasons in `src/lib/archived-routes.ts`): dashboard, layoff planner checklist, case timeline, document vault and email import, community browse/feed/insights, lawyer directory. Long-term planning is a later phase, not a dropped idea.
- Onboarding comes before the answer, by decision. A question typed on the home page is carried through sign-up and onboarding and waits in the composer.
- Stack: Next.js 15 App Router, React 19, Tailwind 4, shadcn/ui on Radix, Supabase, deployed on Vercel.
- Hard constraint: Supabase egress is the tightest budget in the project. Public pages must not add per-visit database reads.
- Terminology to keep exact: H-1B, F-1, OPT, CPT, EB-2/EB-3, I-140, priority date, grace period, cap-exempt. These are how users search and how they describe themselves.

## Brand Commitments

The name Haven and the house logo mark are binding. Everything else about the current look — the cream and sage palette, the serif display type, the card-heavy layout — is open to replacement.

Voice: plain, calm, specific, never alarmist and never cheerful about a crisis. No legalese, no false certainty.

## Evidence on Hand

- A real, growing corpus of imported and moderated community stories with advice summaries and case-data points; funnel logging exists for the import.
- Real, dated editorial content: guides and blog posts on USCIS backlogs, PERM, e-filing rules, layoffs, grace periods, transfers.
- A sponsor-history directory built from DOL LCA filings and USCIS approval data.
- Free calculators: grace period, priority date, document pack, vaccine finder.
- The founder lived through two H-1B layoffs; this is stated on the About page.
- No user counts, no funding claims, no press, no named customer testimonials. The three quoted testimonials that were on the old home page are personas, not real people, and must not be reused as real.

## Product Principles

1. One question box beats a menu of features. If something does not help a person ask or get answered, it does not belong on the home page.
2. Answer from what people actually did, and say where it came from. Never invent certainty about someone's case.
3. Meet the worst day first. The lottery, the layoff, the deadline — that is when a wrong answer costs the most.
4. Ask for setup only where it visibly buys a better answer, and never make anyone type their question twice.
5. Information, not legal advice — stated plainly, without hiding behind it.

## Accessibility & Inclusion

Visitors are reading under stress, in a second language, mostly on phones. Plain language, generous type, real touch targets, and full keyboard and screen-reader support on the question box and onboarding are requirements, not polish.

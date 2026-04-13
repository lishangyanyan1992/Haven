import type { Metadata } from "next";
import Link from "next/link";

import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/seo";
import { buildBreadcrumbStructuredData, getAuthorProfile } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Why Haven exists, who is behind it, and how public content is written and maintained.",
  alternates: {
    canonical: "/about"
  },
  openGraph: {
    url: absoluteUrl("/about"),
    title: "About Haven",
    description: "Why Haven exists, who is behind it, and how public content is written and maintained."
  },
  twitter: {
    title: "About Haven",
    description: "Why Haven exists, who is behind it, and how public content is written and maintained."
  }
};

export default function AboutPage() {
  const founder = getAuthorProfile("Haven founder");
  const editorial = getAuthorProfile("Haven editorial team");
  const breadcrumbData = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "About", path: "/about" }
  ]);

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      <PublicNavbar currentPath="/about" />

      <main className="content-container-visual py-16 lg:py-24 xl:py-28">
        <section className="max-w-[72ch]">
          <p className="text-label">About Haven</p>
          <h1 className="text-display mt-5 max-w-[14ch]">Built for the moments when immigration decisions get expensive.</h1>
          <p className="text-body mt-6 max-w-[62ch]">
            Haven exists to reduce uncertainty for H-1B and adjacent visa holders navigating layoffs, employer changes,
            deadlines, and next-step decisions that usually get scattered across group chats, attorney calls, and forum threads.
          </p>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article id="founder" className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7">
            <p className="text-label">Founder</p>
            <h2 className="text-h1 mt-4">{founder.name}</h2>
            <p className="text-body mt-4">{founder.description}</p>
            <p className="text-body mt-4">
              Haven started after two H-1B layoffs made one thing obvious: the hardest part was not just finding
              information. It was making time-sensitive decisions with incomplete visibility and no shared system of truth.
            </p>
            <div className="mt-6">
              <Link className={buttonVariants({ variant: "outline" })} href="/blog/why-i-started-haven">
                Read the founder story
              </Link>
            </div>
          </article>

          <article id="editorial" className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-7">
            <p className="text-label">Editorial approach</p>
            <h2 className="text-h1 mt-4">{editorial.name}</h2>
            <p className="text-body mt-4">{editorial.description}</p>
            <ul className="mt-5 space-y-3 pl-5">
              <li className="text-body list-disc">Write for real decisions, not generic traffic.</li>
              <li className="text-body list-disc">Prefer concrete next steps and comparison frameworks.</li>
              <li className="text-body list-disc">Keep legal boundaries clear: informational guidance, not legal advice.</li>
              <li className="text-body list-disc">Update public pages when workflows or assumptions change.</li>
            </ul>
          </article>
        </section>

        <section className="mt-12 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7">
          <p className="text-label">What to expect from Haven content</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {[
              ["Decision-first", "Public pages are written to help users evaluate what matters next, not just define terms."],
              ["Pattern-aware", "Guides are designed to connect individual decisions to broader timing and workflow patterns."],
              ["Source-conscious", "Haven does not replace counsel. Public content is meant to reduce confusion and improve preparation."]
            ].map(([title, body]) => (
              <div key={title} className="rounded-[var(--radius-xl)] bg-[var(--haven-cream)] p-5">
                <h3 className="text-h3">{title}</h3>
                <p className="text-body-sm mt-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 flex flex-col gap-4 sm:flex-row">
          <Link className={buttonVariants({ variant: "default", size: "lg" })} href="/guides">
            Explore public guides
          </Link>
          <Link className={buttonVariants({ variant: "outline", size: "lg" })} href="/blog">
            Read the blog
          </Link>
        </section>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
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
          <h1 className="text-display mt-5 max-w-fit">
            <span className="block whitespace-nowrap">Built by those who&apos;ve lived it,</span>
            <span className="block whitespace-nowrap">for those navigating it now.</span>
          </h1>
          <p className="text-body mt-6 max-w-[62ch]">
            Haven exists to reduce uncertainty for global talent navigating layoffs, employer changes, deadlines, and
            critical next-step decisions that are often scattered across group chats, attorney calls, and forum
            threads.
          </p>
        </section>

        <section className="mt-12 max-w-[72ch]">
          <article id="founder" className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-7">
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
            <div className="mt-6">
              <Link className={buttonVariants({ variant: "outline" })} href="/blog/why-i-started-haven">
                Read the founder story
              </Link>
            </div>
          </article>
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

import type { Metadata } from "next";
import Link from "next/link";

import { PublicNavbar } from "@/components/app/public-navbar";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not available — Haven",
  robots: { index: false, follow: false }
};

/**
 * Rendered (with a 404 status) in place of any surface parked in
 * `src/lib/archived-routes.ts`.
 */
export default function GonePage() {
  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <PublicNavbar currentPath="/gone" />
      <main className="content-container-visual flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-heading-lg text-[var(--haven-ink)]">This page isn&apos;t part of Haven right now</h1>
        <p className="max-w-prose text-body text-[var(--color-text-secondary)]">
          We&apos;ve made Haven simpler. Ask your question and we&apos;ll answer it from what people in the same
          situation actually did.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link className={buttonVariants()} href="/">
            Ask a question
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/blog">
            Read the guides
          </Link>
        </div>
      </main>
    </div>
  );
}

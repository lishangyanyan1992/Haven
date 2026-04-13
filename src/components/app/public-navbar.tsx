import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KNOWN_BROKEN_IMMIG_WIZARD_HOST = "immig.haven-h1b.com";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "Tools" },
  { href: "/guides", label: "Guides" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" }
];

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

export function getPublicImmigWizardUrl() {
  return getImmigWizardUrl();
}

function isNavItemActive(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function PublicNavbar({ currentPath }: { currentPath: string }) {
  const immigWizardUrl = getPublicImmigWizardUrl();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
      <div className="content-container-visual flex h-16 items-center justify-between gap-4">
        <Link href="/">
          <HavenBrand />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => {
            const isActive = isNavItemActive(currentPath, item.href);

            return (
              <Link
                key={item.href}
                className={cn(
                  "text-body-sm transition-colors hover:text-[var(--haven-ink)]",
                  isActive ? "font-medium text-[var(--haven-ink)]" : "text-[var(--color-text-secondary)]"
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
          {immigWizardUrl ? (
            <a
              className="inline-flex items-center gap-1 text-body-sm font-medium text-[var(--haven-sage-ink,var(--haven-ink))] transition-colors hover:text-[var(--haven-ink)]"
              href={immigWizardUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Green Card Forms
              <ArrowRight className="h-3 w-3" />
            </a>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <Link className="text-body-sm hover:text-[var(--haven-ink)]" href="/login">
            Sign in
          </Link>
          <Link className={buttonVariants({ variant: "default" })} href="/register">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

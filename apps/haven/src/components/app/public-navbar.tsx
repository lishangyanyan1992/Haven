import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { MobilePublicNav } from "@/components/app/mobile-public-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HAVEN_HOME_URL = "https://haven-h1b.com/";
const IMMIG_WIZARD_URL = "https://immig.haven-h1b.com/";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/jobs", label: "Jobs" },
  { href: "/community", label: "Community" }
];

const marketplaceNavItems = [
  { href: "/lawyers", label: "Immigration Lawyers" },
  { href: "/day-1-cpt-schools", label: "Day 1 CPT Schools" }
];

const resourceNavItems = [
  { href: "/tools", label: "Tools" },
  { href: "/resources", label: "Resources" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" }
];

function getImmigWizardUrl() {
  return IMMIG_WIZARD_URL;
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
  const isMarketplaceActive = marketplaceNavItems.some((item) => isNavItemActive(currentPath, item.href));
  const isResourcesActive = resourceNavItems.some((item) => isNavItemActive(currentPath, item.href));

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.92)] backdrop-blur-md">
      <div className="content-container-visual flex h-16 items-center justify-between gap-4">
        <Link href={HAVEN_HOME_URL} prefetch={false}>
          <HavenBrand />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
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
          <details className="group relative">
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-1 text-body-sm transition-colors hover:text-[var(--haven-ink)] [&::-webkit-details-marker]:hidden",
                isMarketplaceActive ? "font-medium text-[var(--haven-ink)]" : "text-[var(--color-text-secondary)]"
              )}
            >
              Marketplace
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-1/2 top-8 z-50 min-w-52 -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-2 shadow-[0_18px_40px_-24px_rgba(44,54,48,0.45)]">
              {marketplaceNavItems.map((item) => {
                const isActive = isNavItemActive(currentPath, item.href);

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "block rounded-[var(--radius-md)] px-3 py-2 text-body-sm transition-colors",
                      isActive
                        ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
          <details className="group relative">
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center gap-1 text-body-sm transition-colors hover:text-[var(--haven-ink)] [&::-webkit-details-marker]:hidden",
                isResourcesActive ? "font-medium text-[var(--haven-ink)]" : "text-[var(--color-text-secondary)]"
              )}
            >
              Resources
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-1/2 top-8 z-50 min-w-44 -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-2 shadow-[0_18px_40px_-24px_rgba(44,54,48,0.45)]">
              {resourceNavItems.map((item) => {
                const isActive = isNavItemActive(currentPath, item.href);

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "block rounded-[var(--radius-md)] px-3 py-2 text-body-sm transition-colors",
                      isActive
                        ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
          {immigWizardUrl ? (
            <a
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-body-sm font-medium text-[var(--haven-sage-ink,var(--haven-ink))] transition-colors hover:text-[var(--haven-ink)]"
              href={immigWizardUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="xl:hidden">Application Forms</span>
              <span className="hidden xl:inline">Visa & Green Card Forms</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </a>
          ) : null}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link className="hidden text-body-sm hover:text-[var(--haven-ink)] lg:inline" href="/login">
            Sign in
          </Link>
          <Link className={cn(buttonVariants({ variant: "default" }), "hidden lg:inline-flex")} href="/register">
            Get Started
          </Link>
          <MobilePublicNav
            currentPath={currentPath}
            immigWizardUrl={immigWizardUrl}
            marketplaceNavItems={marketplaceNavItems}
            navItems={navItems}
            resourceNavItems={resourceNavItems}
          />
        </div>
      </div>
    </header>
  );
}

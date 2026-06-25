"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicNavItem = {
  href: string;
  label: string;
};

function isNavItemActive(currentPath: string, href: string) {
  if (href === "/") {
    return currentPath === "/";
  }

  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function MobilePublicNav({
  currentPath,
  immigWizardUrl,
  marketplaceNavItems,
  navItems,
  resourceNavItems
}: {
  currentPath: string;
  immigWizardUrl: string | null;
  marketplaceNavItems: PublicNavItem[];
  navItems: PublicNavItem[];
  resourceNavItems: PublicNavItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(() =>
    marketplaceNavItems.some((item) => isNavItemActive(currentPath, item.href))
  );
  const [isResourcesOpen, setIsResourcesOpen] = useState(() =>
    resourceNavItems.some((item) => isNavItemActive(currentPath, item.href))
  );
  const isMarketplaceActive = marketplaceNavItems.some((item) => isNavItemActive(currentPath, item.href));
  const isResourcesActive = resourceNavItems.some((item) => isNavItemActive(currentPath, item.href));

  return (
    <>
      <button
        aria-controls="mobile-public-nav"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-ink)] lg:hidden"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {isOpen ? (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-[var(--color-border)] bg-[var(--haven-cream)] shadow-[0_16px_40px_-24px_rgba(44,54,48,0.35)] lg:hidden">
          <div className="content-container-visual py-3" id="mobile-public-nav">
            <nav className="grid gap-1">
              {navItems.map((item) => {
                const isActive = isNavItemActive(currentPath, item.href);

                return (
                  <Link
                    key={item.href}
                    className={cn(
                      "flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-body-sm transition-colors",
                      isActive
                        ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                    )}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div>
                <button
                  aria-expanded={isMarketplaceOpen}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-body-sm transition-colors",
                    isMarketplaceActive
                      ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                  )}
                  onClick={() => setIsMarketplaceOpen((open) => !open)}
                  type="button"
                >
                  Marketplace
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isMarketplaceOpen && "rotate-180")} />
                </button>
                {isMarketplaceOpen ? (
                  <div className="mt-1 grid gap-1 pl-3">
                    {marketplaceNavItems.map((item) => {
                      const isActive = isNavItemActive(currentPath, item.href);

                      return (
                        <Link
                          key={item.href}
                          className={cn(
                            "flex min-h-10 items-center rounded-[var(--radius-md)] px-3 text-body-sm transition-colors",
                            isActive
                              ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                          )}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div>
                <button
                  aria-expanded={isResourcesOpen}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-[var(--radius-md)] px-3 text-left text-body-sm transition-colors",
                    isResourcesActive
                      ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                  )}
                  onClick={() => setIsResourcesOpen((open) => !open)}
                  type="button"
                >
                  Resources
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isResourcesOpen && "rotate-180")} />
                </button>
                {isResourcesOpen ? (
                  <div className="mt-1 grid gap-1 pl-3">
                    {resourceNavItems.map((item) => {
                      const isActive = isNavItemActive(currentPath, item.href);

                      return (
                        <Link
                          key={item.href}
                          className={cn(
                            "flex min-h-10 items-center rounded-[var(--radius-md)] px-3 text-body-sm transition-colors",
                            isActive
                              ? "bg-[var(--haven-sage-light)] font-medium text-[var(--haven-ink)]"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--haven-sage-light)] hover:text-[var(--haven-ink)]"
                          )}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {immigWizardUrl ? (
                <a
                  className="flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-body-sm font-medium text-[var(--haven-ink)] hover:bg-[var(--haven-sage-light)]"
                  href={immigWizardUrl}
                  onClick={() => setIsOpen(false)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Visa & Green Card Forms
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </nav>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href="/login"
                onClick={() => setIsOpen(false)}
              >
                Sign in
              </Link>
              <Link
                className={buttonVariants({ variant: "default", size: "sm" })}
                href="/register"
                onClick={() => setIsOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { Fragment, useState, type ReactNode } from "react";

type ResourceCategorySummary = {
  category: string;
  slug: string;
  count: number;
};

// Filters the server-rendered category sections with local state so /resources
// can stay fully static; the old ?view=/?category= links made every request a
// server render and gave crawlers endless URL permutations.
export function ResourcesExplorer({
  totalCount,
  categories,
  groups,
  dateView
}: {
  totalCount: number;
  categories: ResourceCategorySummary[];
  groups: Array<{ slug: string; node: ReactNode }>;
  dateView: ReactNode;
}) {
  const [isDateView, setIsDateView] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = categories.find((category) => category.slug === selectedSlug);
  const visibleGroups = selected ? groups.filter((group) => group.slug === selected.slug) : groups;

  return (
    <>
      <div className="mt-12 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)]/80 p-6 shadow-[0_8px_30px_-12px_rgba(44,54,48,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-label">{isDateView ? "Browse by date" : "Browse by category"}</p>
            <p className="text-body mt-2 max-w-[72ch]">
              {isDateView
                ? "See the full resource library in reverse chronological order."
                : "Browse the library through broader reference buckets, or switch to a simple date-based view."}
            </p>
          </div>
          <p className="text-caption">
            {isDateView
              ? `${totalCount} total resources`
              : selected
                ? `${selected.count} resource${selected.count === 1 ? "" : "s"} in ${selected.category}`
                : `${totalCount} total resources`}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsDateView(false)}
            className={isDateView ? "tag tag-pending" : "tag tag-active"}
          >
            By category
          </button>
          <button
            type="button"
            onClick={() => setIsDateView(true)}
            className={isDateView ? "tag tag-active" : "tag tag-pending"}
          >
            By date
          </button>
        </div>

        {!isDateView ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedSlug(null)}
              className={selected ? "tag tag-pending" : "tag tag-active"}
            >
              All resources
            </button>
            {categories.map((category) => {
              const isSelected = category.slug === selectedSlug;
              return (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => setSelectedSlug(isSelected ? null : category.slug)}
                  className={isSelected ? "tag tag-active" : "tag tag-visa"}
                >
                  {category.category} · {category.count}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-12 space-y-12">
        {isDateView ? dateView : visibleGroups.map((group) => <Fragment key={group.slug}>{group.node}</Fragment>)}
      </div>
    </>
  );
}

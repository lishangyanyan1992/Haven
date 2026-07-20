"use client";

import { Fragment, useState, type ReactNode } from "react";

type BlogCategorySummary = {
  category: string;
  slug: string;
  count: number;
};

// Filters the server-rendered post cards with local state so /blog can stay
// fully static; the old ?category= links made every request a server render
// and gave crawlers query-param permutations to churn on.
export function BlogExplorer({
  totalCount,
  categories,
  posts
}: {
  totalCount: number;
  categories: BlogCategorySummary[];
  posts: Array<{ slug: string; categorySlug: string; node: ReactNode }>;
}) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = categories.find((category) => category.slug === selectedSlug);
  const visiblePosts = selected ? posts.filter((post) => post.categorySlug === selected.slug) : posts;

  return (
    <>
      <div className="mt-12 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)]/80 p-6 shadow-[0_8px_30px_-12px_rgba(44,54,48,0.08)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-label">Browse by date</p>
            <p className="text-body mt-2 max-w-[72ch]">
              The blog defaults to newest-first. Use the topic filters to narrow the stream without changing the layout.
            </p>
          </div>
          <p className="text-caption">
            {selected
              ? `${selected.count} article${selected.count === 1 ? "" : "s"} in ${selected.category}`
              : `${totalCount} total articles`}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSelectedSlug(null)}
            className={selected ? "tag tag-pending" : "tag tag-active"}
          >
            All articles
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
      </div>

      <div className="mt-12 space-y-6">
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[76ch]">
            <p className="text-label">{selected ? selected.category : "Latest posts"}</p>
            <h2 className="text-h1 mt-3">{selected ? `${selected.category} articles` : "Newest articles first"}</h2>
            <p className="text-body mt-3">
              {selected
                ? "Filtered by label, still sorted by publish date so the latest changes stay at the top."
                : "Every article in the blog stream, sorted by publish date with the newest posts first."}
            </p>
          </div>
          <p className="text-caption">
            {visiblePosts.length} article{visiblePosts.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visiblePosts.map((post) => (
            <Fragment key={post.slug}>{post.node}</Fragment>
          ))}
        </div>
      </div>
    </>
  );
}

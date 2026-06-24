import Link from "next/link";

import type { CaseStatsBlock } from "@/lib/advisor/case-stats";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function CaseOutcomesCard({ block }: { block: CaseStatsBlock }) {
  const isEmpty = block.tier === "tier0";

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] p-6">
      <header className="mb-1">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {isEmpty ? "What people like you did" : `What ${block.totalN} people like you did`}
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {block.segmentLabel}
          {!isEmpty ? ` · last ${block.recencyMonths} months` : ""}
          {block.widened ? " · broadened to nearest segment" : ""}
        </p>
      </header>

      {isEmpty ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">{block.caveat}</p>
          <Link
            href="/community/contribute"
            className="inline-block text-sm font-medium text-[var(--haven-sage)] hover:underline"
          >
            Share your path to help others →
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {block.paths.map((path) => (
              <li key={path.path}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-[var(--color-text-primary)]">{capitalize(path.pathLabel)}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-text-secondary)]">
                    {path.pct}% · {path.n}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-mid)]">
                  <div
                    className="h-full rounded-full bg-[var(--haven-sage)]"
                    style={{ width: `${Math.max(path.pct, 2)}%` }}
                  />
                </div>
                {block.showOutcomes && path.approvedPct != null ? (
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                    ~{path.approvedPct}% approved
                    {path.rfePct != null ? ` · ~${path.rfePct}% hit an RFE` : ""}
                    {path.medianDaysToDecision != null ? ` · ~${path.medianDaysToDecision} days to decision` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="mt-5 border-t border-[var(--color-border-mid)] pt-4 text-xs text-[var(--color-text-tertiary)]">
            {block.caveat}
          </p>
          <Link
            href="/resources"
            className="mt-2 inline-block text-sm font-medium text-[var(--haven-sage)] hover:underline"
          >
            Talk to an immigration attorney →
          </Link>
        </>
      )}
    </section>
  );
}

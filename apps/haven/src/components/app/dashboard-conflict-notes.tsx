"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardConflict } from "@/lib/dashboard-consistency";
import { endPetitionAction } from "@/server/petition-actions";

const VISIBLE = 3;

/** "Check this" notes for answers that contradict each other. */
export function DashboardConflictNotes({ conflicts }: { conflicts: DashboardConflict[] }) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (conflicts.length === 0) return null;
  const shown = showAll ? conflicts : conflicts.slice(0, VISIBLE);

  return (
    <section
      aria-label="Answers to check"
      className="rounded-[var(--radius-xl)] border border-[var(--haven-sand-strong,#E5C9A8)] bg-[#FDF8F1] p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <CircleAlert className="h-4 w-4 text-[var(--haven-ink)]" />
        <p className="text-body-sm font-semibold text-[var(--haven-ink)]">
          Check this: {conflicts.length === 1 ? "one answer doesn't match" : `${conflicts.length} answers don't match`}
        </p>
      </div>
      <ul className="mt-3 space-y-3">
        {shown.map((conflict) => (
          <li key={conflict.id} className="text-body-sm text-[var(--haven-ink-mid)]">
            <p>{conflict.message}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {conflict.quickFix && (
                <Button
                  size="sm"
                  disabled={pendingId === conflict.id}
                  onClick={() => {
                    const fix = conflict.quickFix!;
                    setPendingId(conflict.id);
                    setError(null);
                    startTransition(async () => {
                      try {
                        const result = await endPetitionAction(fix.petitionId, fix.reason, fix.date);
                        if (result.ok) router.refresh();
                        else setError(result.error);
                      } catch {
                        setError("We couldn't save that. Try again in a moment.");
                      } finally {
                        setPendingId(null);
                      }
                    });
                  }}
                >
                  {pendingId === conflict.id ? "Saving..." : conflict.quickFix.label}
                </Button>
              )}
              <Link
                className="text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-2"
                href={conflict.fixHref}
              >
                Review in settings
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-[12px] text-[var(--haven-blush-ink)]">{error}</p>}
      {conflicts.length > VISIBLE && (
        <button
          type="button"
          className="mt-3 text-[12px] font-semibold text-[var(--haven-ink)] underline underline-offset-2"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer" : `Show all ${conflicts.length}`}
        </button>
      )}
    </section>
  );
}

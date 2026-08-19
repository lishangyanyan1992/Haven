import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { CrisisState } from "@/lib/get-crisis-state";
import { resolveCrisisMode } from "@/server/crisis-actions";

interface CrisisBannerProps {
  crisisState: CrisisState;
}

export function CrisisBanner({ crisisState }: CrisisBannerProps) {
  const { dayNumber, daysRemaining, expired } = crisisState;
  const isUrgent = !expired && daysRemaining <= 14;

  return (
    <div
      className="sticky top-14 z-10 flex items-center justify-between gap-4 border-b px-4 py-3 md:px-6"
      style={{
        background: "var(--haven-blush-light)",
        borderColor: "var(--haven-blush)",
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--haven-blush-ink)" }}
        />
        <p className="text-body-sm font-medium" style={{ color: "var(--haven-blush-ink)" }}>
          {expired ? (
            <>
              {/* Named plainly rather than counted. Somebody past the ceiling is
                  the person who most needs to be told, and "Day 60 of 60" — what
                  the clamped counter used to show them forever — reads as though
                  they still have a day left. */}
              <span className="font-semibold">Your 60-day window has passed</span>
              <span className="mx-2 opacity-50">·</span>
              <span>Day {dayNumber} since your last day of work</span>
              <span className="mx-2 opacity-50">·</span>
              <span className="font-semibold">Talk to an immigration attorney</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Day {dayNumber} of 60</span>
              <span className="mx-2 opacity-50">·</span>
              <span>
                {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
              </span>
              {isUrgent && (
                <>
                  <span className="mx-2 opacity-50">·</span>
                  <span className="font-semibold">File before your grace period ends</span>
                </>
              )}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/advisor"
          className="text-body-sm font-medium underline underline-offset-4"
          style={{ color: "var(--haven-blush-ink)" }}
        >
          Ask what to do next
        </Link>
        <form action={resolveCrisisMode.bind(null, "dismissed")}>
          <button
            type="submit"
            className="text-body-sm opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--haven-blush-ink)" }}
          >
            Mark resolved
          </button>
        </form>
      </div>
    </div>
  );
}

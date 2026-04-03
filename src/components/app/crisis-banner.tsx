import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { CrisisState } from "@/lib/get-crisis-state";
import { resolveCrisisMode } from "@/server/crisis-actions";

interface CrisisBannerProps {
  crisisState: CrisisState;
}

export function CrisisBanner({ crisisState }: CrisisBannerProps) {
  const { dayNumber, daysRemaining } = crisisState;
  const isUrgent = daysRemaining <= 14;

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
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/planner"
          className="text-body-sm font-medium underline underline-offset-4"
          style={{ color: "var(--haven-blush-ink)" }}
        >
          View checklist
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

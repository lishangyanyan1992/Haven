"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { resetDemoFirmAction } from "@/server/firm-actions";

export function ResetDemoButton() {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = () => {
    startTransition(async () => {
      try {
        const result = await resetDemoFirmAction();
        if (result.ok) {
          setMessage("Reset complete! Dates updated relative to today.");
          setShowConfirm(false);
          setTimeout(() => setMessage(null), 4000);
        }
      } catch (err: any) {
        setMessage(err.message || "Reset failed");
      }
    });
  };

  return (
    <div className="relative inline-flex items-center">
      {showConfirm ? (
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-1 shadow-sm">
          <span className="text-[12px] text-[var(--haven-ink-mid)]">Reset 50 leads to today?</span>
          <button
            type="button"
            disabled={isPending}
            onClick={handleReset}
            className="rounded-full bg-[var(--haven-ink)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-cream)] hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Resetting..." : "Yes, reset"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowConfirm(false)}
            className="text-[11px] text-[var(--haven-ink-mid)] underline hover:text-[var(--haven-ink)]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--haven-sand)] px-3 py-1 text-body-sm font-medium text-[var(--haven-ink)] transition-colors hover:bg-[var(--haven-white)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset demo data
        </button>
      )}

      {message ? (
        <span className="absolute -bottom-6 left-0 whitespace-nowrap text-[11px] font-medium text-[var(--haven-ink)]">
          {message}
        </span>
      ) : null}
    </div>
  );
}

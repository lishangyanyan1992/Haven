"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { syncVisaBulletinAction, type SyncBulletinActionResponse } from "@/server/admin-actions";

export function ManualSyncButton({
  label = "Run Manual Sync",
  className = ""
}: {
  label?: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<SyncBulletinActionResponse | null>(null);

  const handleSync = () => {
    setLastResult(null);
    startTransition(async () => {
      try {
        const response = await syncVisaBulletinAction();
        setLastResult(response);
      } catch (err) {
        setLastResult({
          success: false,
          message: err instanceof Error ? err.message : "An unexpected error occurred."
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--haven-sky-ink)] px-4 py-2.5 text-body-sm font-semibold text-[var(--haven-white)] shadow-sm transition hover:bg-[var(--haven-ink)] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Syncing bulletin...</span>
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            <span>{label}</span>
          </>
        )}
      </button>

      {lastResult && (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-caption ${
            lastResult.success
              ? "border-[var(--color-border-success,#86efac)] bg-[var(--color-bg-success,#f0fdf4)] text-[var(--color-text-success,#166534)]"
              : "border-[var(--haven-blush-mid)] bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
          }`}
        >
          {lastResult.message}
        </div>
      )}
    </div>
  );
}

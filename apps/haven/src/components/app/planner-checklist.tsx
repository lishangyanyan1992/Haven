"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import type { ChecklistItem } from "@/lib/crisis-checklist";
import { cn } from "@/lib/utils";
import { toggleChecklistItem } from "@/server/crisis-actions";

interface PlannerChecklistProps {
  eventId: string;
  items: ChecklistItem[];
  completedItemKeys: string[];
}

export function PlannerChecklist({
  eventId,
  items,
  completedItemKeys,
}: PlannerChecklistProps) {
  const router = useRouter();
  const [completedKeys, setCompletedKeys] = useState<string[]>(completedItemKeys);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCompletedKeys(completedItemKeys);
  }, [completedItemKeys]);

  function handleCheckedChange(itemKey: string, checked: boolean) {
    const previous = completedKeys;
    setError(null);
    setPendingKey(itemKey);
    setCompletedKeys((current) =>
      checked ? Array.from(new Set([...current, itemKey])) : current.filter((key) => key !== itemKey),
    );

    startTransition(async () => {
      try {
        await toggleChecklistItem(eventId, itemKey, checked);
        router.refresh();
      } catch (toggleError) {
        setCompletedKeys(previous);
        setError(toggleError instanceof Error ? toggleError.message : "Unable to update checklist item.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  const completedCount = completedKeys.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
        <div>
          <p className="text-label">Checklist progress</p>
          <p className="mt-2 text-h3">
            {completedCount} of {items.length} completed
          </p>
        </div>
        <p className="text-body-sm text-[var(--color-text-secondary)]">
          Save as you go. Every change persists to your current crisis event.
        </p>
      </div>

      {error ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3 text-body-sm text-[var(--haven-blush-ink)]">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const isCompleted = completedKeys.includes(item.key);
          const isItemPending = pendingKey === item.key && isPending;

          return (
            <label
              key={item.key}
              className={cn(
                "flex cursor-pointer gap-4 rounded-[var(--radius-lg)] border p-4 transition-colors",
                isCompleted
                  ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]"
                  : "border-[var(--color-border)] bg-[var(--haven-white)] hover:border-[var(--color-border-mid)]",
                isItemPending && "opacity-70",
              )}
            >
              <input
                checked={isCompleted}
                className="sr-only"
                disabled={isItemPending}
                onChange={(event) => handleCheckedChange(item.key, event.target.checked)}
                type="checkbox"
              />
              <div className="pt-0.5 text-[var(--haven-sage)]">
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="tag tag-pending">{item.window}</span>
                  {isItemPending ? <span className="text-caption">Saving...</span> : null}
                </div>
                <p className={cn("mt-3 text-h3", isCompleted && "line-through opacity-60")}>{item.title}</p>
                <p className={cn("mt-2 text-body-sm text-[var(--color-text-secondary)]", isCompleted && "line-through opacity-60")}>
                  {item.detail}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

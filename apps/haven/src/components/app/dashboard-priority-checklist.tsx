"use client";

import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StoredPriorityChecklist = {
  checkedDefaults: Record<string, boolean>;
  removedDefaults: string[];
  customItems: Array<{
    id: string;
    text: string;
    checked: boolean;
  }>;
};

type PriorityChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  kind: "default" | "custom";
  normalizedText: string;
};

const EMPTY_STORAGE: StoredPriorityChecklist = {
  checkedDefaults: {},
  removedDefaults: [],
  customItems: []
};

function normalizeChecklistText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildDefaultItemId(text: string, index: number) {
  return `default-${index}-${normalizeChecklistText(text).replace(/[^a-z0-9]+/g, "-")}`;
}

function readStoredChecklist(storageKey: string): StoredPriorityChecklist {
  if (typeof window === "undefined") return EMPTY_STORAGE;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return EMPTY_STORAGE;

    const parsed = JSON.parse(raw) as Partial<StoredPriorityChecklist>;

    return {
      checkedDefaults:
        parsed.checkedDefaults && typeof parsed.checkedDefaults === "object" ? parsed.checkedDefaults as Record<string, boolean> : {},
      removedDefaults: Array.isArray(parsed.removedDefaults) ? parsed.removedDefaults.filter((value): value is string => typeof value === "string") : [],
      customItems: Array.isArray(parsed.customItems)
        ? parsed.customItems
            .filter(
              (item): item is { id: string; text: string; checked: boolean } =>
                Boolean(item) &&
                typeof item.id === "string" &&
                typeof item.text === "string" &&
                typeof item.checked === "boolean"
            )
        : []
    };
  } catch {
    return EMPTY_STORAGE;
  }
}

function writeStoredChecklist(storageKey: string, value: StoredPriorityChecklist) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function buildChecklistItems(
  initialItems: string[],
  storedChecklist: StoredPriorityChecklist
): PriorityChecklistItem[] {
  const removedDefaults = new Set(storedChecklist.removedDefaults);

  const defaultItems = initialItems
    .map((text, index) => {
      const normalizedText = normalizeChecklistText(text);
      if (!normalizedText || removedDefaults.has(normalizedText)) return null;

      return {
        id: buildDefaultItemId(text, index),
        text,
        checked: Boolean(storedChecklist.checkedDefaults[normalizedText]),
        kind: "default" as const,
        normalizedText
      };
    })
    .filter(
      (
        item
      ): item is {
        id: string;
        text: string;
        checked: boolean;
        kind: "default";
        normalizedText: string;
      } => Boolean(item)
    );

  const customItems = storedChecklist.customItems
    .map((item) => {
      const normalizedText = normalizeChecklistText(item.text);
      if (!normalizedText) return null;

      return {
        id: item.id,
        text: item.text,
        checked: item.checked,
        kind: "custom" as const,
        normalizedText
      };
    })
    .filter(
      (
        item
      ): item is {
        id: string;
        text: string;
        checked: boolean;
        kind: "custom";
        normalizedText: string;
      } => Boolean(item)
    );

  return [...defaultItems, ...customItems];
}

export function DashboardPriorityChecklist({
  initialItems,
  profileId
}: {
  initialItems: string[];
  profileId: string;
}) {
  const storageKey = `haven-dashboard-priority-checklist:${profileId}`;
  const [draft, setDraft] = useState("");
  const [storedChecklist, setStoredChecklist] = useState<StoredPriorityChecklist>(EMPTY_STORAGE);

  useEffect(() => {
    setStoredChecklist(readStoredChecklist(storageKey));
  }, [storageKey]);

  useEffect(() => {
    writeStoredChecklist(storageKey, storedChecklist);
  }, [storageKey, storedChecklist]);

  const items = useMemo(() => buildChecklistItems(initialItems, storedChecklist), [initialItems, storedChecklist]);
  const completedCount = items.filter((item) => item.checked).length;

  function toggleItem(target: PriorityChecklistItem, checked: boolean) {
    if (target.kind === "default") {
      setStoredChecklist((current) => ({
        ...current,
        checkedDefaults: {
          ...current.checkedDefaults,
          [target.normalizedText]: checked
        }
      }));
      return;
    }

    setStoredChecklist((current) => ({
      ...current,
      customItems: current.customItems.map((item) =>
        item.id === target.id
          ? {
              ...item,
              checked
            }
          : item
      )
    }));
  }

  function removeItem(target: PriorityChecklistItem) {
    if (target.kind === "default") {
      setStoredChecklist((current) => ({
        ...current,
        removedDefaults: Array.from(new Set([...current.removedDefaults, target.normalizedText]))
      }));
      return;
    }

    setStoredChecklist((current) => ({
      ...current,
      customItems: current.customItems.filter((item) => item.id !== target.id)
    }));
  }

  function addItem() {
    const text = draft.trim();
    if (!text) return;

    setStoredChecklist((current) => ({
      ...current,
      customItems: [
        ...current.customItems,
        {
          id: `custom-${Date.now()}`,
          text,
          checked: false
        }
      ]
    }));
    setDraft("");
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-label">Priority</p>
          <CardTitle className="mt-2">What to focus on now</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
          <div>
            <p className="text-label">Checklist progress</p>
            <p className="mt-2 text-h3">
              {completedCount} of {items.length} completed
            </p>
          </div>
          <p className="text-body-sm text-[var(--color-text-secondary)]">Add, remove, and check off items. Saved in this browser.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="min-h-11 flex-1 rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-2.5 text-sm text-[var(--haven-ink)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--haven-sage)]"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
            placeholder="Add a priority item"
            value={draft}
          />
          <Button onClick={addItem} type="button" variant="outline">
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-4 rounded-[var(--radius-lg)] border p-4 transition-colors",
                item.checked
                  ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]"
                  : "border-[var(--color-border)] bg-[var(--haven-white)]"
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-4">
                <input
                  checked={item.checked}
                  className="sr-only"
                  onChange={(event) => toggleItem(item, event.target.checked)}
                  type="checkbox"
                />
                <div className="pt-0.5 text-[var(--haven-sage)]">
                  {item.checked ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-body-sm", item.checked && "line-through opacity-60")}>{item.text}</p>
                </div>
              </label>
              <button
                aria-label={`Remove ${item.text}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--haven-blush)] hover:bg-[var(--haven-blush-light)] hover:text-[var(--haven-blush-ink)]"
                onClick={() => removeItem(item)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

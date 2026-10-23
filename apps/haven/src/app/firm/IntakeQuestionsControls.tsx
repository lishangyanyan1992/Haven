"use client";

import { useState, useTransition } from "react";
import { Check, Edit3, HelpCircle, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDefaultIntakeQuestions,
  PRESET_INTAKE_QUESTIONS,
  slugifyCustomQuestionKey,
  type IntakeQuestionGroup
} from "@/lib/firms/intake-questions";
import type { IntakeQuestionItem } from "@/lib/firms/types";
import { saveFirmIntakeQuestionsAction } from "@/server/firm-actions";

const QUESTION_GROUPS: IntakeQuestionGroup[] = [
  "Profile",
  "Employment",
  "Green card",
  "Situation",
  "Deadlines"
];

export function IntakeQuestionsControls({
  initialItems
}: {
  initialItems: IntakeQuestionItem[] | null;
}) {
  const [savedItems, setSavedItems] = useState<IntakeQuestionItem[]>(() =>
    initialItems && initialItems.length > 0 ? initialItems : getDefaultIntakeQuestions()
  );
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const item of savedItems) {
      if (!item.isCustom) set.add(item.key);
    }
    return set;
  });

  const [customItems, setCustomItems] = useState<Array<{ key: string; label: string }>>(() =>
    savedItems.filter((item) => item.isCustom).map((i) => ({ key: i.key, label: i.label }))
  );

  const [newCustomLabel, setNewCustomLabel] = useState("");

  function handleTogglePreset(key: string) {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAddCustom() {
    const trimmed = newCustomLabel.trim();
    if (!trimmed) return;
    if (trimmed.length > 120) {
      setError("Custom question must be 120 characters or less.");
      return;
    }
    const key = slugifyCustomQuestionKey(trimmed);
    setCustomItems((prev) => [...prev, { key, label: trimmed }]);
    setNewCustomLabel("");
    setError(null);
  }

  function handleRemoveCustom(index: number) {
    setCustomItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    setError(null);
    const itemsToSave: IntakeQuestionItem[] = [];

    for (const preset of PRESET_INTAKE_QUESTIONS) {
      if (selectedPresets.has(preset.key)) {
        itemsToSave.push({
          key: preset.key,
          label: preset.label,
          isCustom: false
        });
      }
    }

    for (const custom of customItems) {
      itemsToSave.push({
        key: custom.key,
        label: custom.label,
        isCustom: true
      });
    }

    if (itemsToSave.length === 0) {
      setError("Please select or add at least one intake question.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveFirmIntakeQuestionsAction(itemsToSave);
        if (res.ok) {
          setSavedItems(res.items);
          setSelectedPresets(new Set(res.items.filter((item) => !item.isCustom).map((item) => item.key)));
          setCustomItems(res.items.filter((item) => item.isCustom).map((item) => ({ key: item.key, label: item.label })));
          setIsEditing(false);
        } else {
          setError(res.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save intake questions.");
      }
    });
  }

  function handleCancel() {
    setError(null);
    const presets = new Set<string>();
    for (const item of savedItems) {
      if (!item.isCustom) presets.add(item.key);
    }
    setSelectedPresets(presets);
    setCustomItems(savedItems.filter((i) => i.isCustom).map((i) => ({ key: i.key, label: i.label })));
    setIsEditing(false);
  }

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h3">Client intake questions</h2>
          <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
            Questions your firm asks clients during intake setup. Uses standard questions by default.
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} size="sm" type="button" variant="outline">
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Edit intake questions
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {savedItems.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--haven-cream)] px-3 py-1 text-body-sm text-[var(--haven-ink)]"
              >
                <HelpCircle className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                <span>{item.label}</span>
                {item.isCustom && (
                  <span className="text-[11px] font-medium text-[var(--haven-ink-mid)]">(Custom)</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {QUESTION_GROUPS.map((groupName) => {
            const groupPresets = PRESET_INTAKE_QUESTIONS.filter((q) => q.group === groupName);
            return (
              <div key={groupName} className="space-y-2">
                <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{groupName}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {groupPresets.map((preset) => {
                    const isChecked = selectedPresets.has(preset.key);
                    return (
                      <label
                        key={preset.key}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-lg)] border p-3 transition-colors ${
                          isChecked
                            ? "border-[var(--haven-sage)] bg-[var(--haven-sage-light)]"
                            : "border-[var(--color-border)] bg-[var(--haven-white)] hover:bg-[var(--haven-cream)]"
                        }`}
                      >
                        <input
                          checked={isChecked}
                          className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--haven-sage)]"
                          onChange={() => handleTogglePreset(preset.key)}
                          type="checkbox"
                        />
                        <div className="min-w-0">
                          <p className="text-body-sm font-medium text-[var(--haven-ink)]">{preset.label}</p>
                          <p className="text-[11px] text-[var(--haven-ink-mid)]">{preset.detail}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="text-body-sm font-medium text-[var(--haven-ink)]">Custom intake questions:</p>
            {customItems.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {customItems.map((item, idx) => (
                  <div
                    key={`${item.key}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--haven-cream)] px-3 py-1.5 text-body-sm text-[var(--haven-ink)]"
                  >
                    <span>{item.label}</span>
                    <button
                      aria-label={`Remove ${item.label}`}
                      className="text-[var(--haven-ink-mid)] hover:text-[var(--haven-blush-ink)]"
                      onClick={() => handleRemoveCustom(idx)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex max-w-md items-center gap-2">
              <Input
                placeholder="e.g. Have you ever been denied a U.S. visa or entry?"
                value={newCustomLabel}
                onChange={(e) => setNewCustomLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
              />
              <Button onClick={handleAddCustom} size="sm" type="button" variant="outline">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>

          {error && <p className="text-body-sm text-[var(--haven-blush-ink)]">{error}</p>}

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <Button disabled={isPending} onClick={handleSave} type="button">
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              {isPending ? "Saving..." : "Save intake questions"}
            </Button>
            <Button disabled={isPending} onClick={handleCancel} type="button" variant="outline">
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

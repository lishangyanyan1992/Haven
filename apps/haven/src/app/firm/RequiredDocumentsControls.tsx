"use client";

import { useState, useTransition } from "react";
import { Check, Edit3, FileText, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getDefaultRequiredDocuments,
  isPerSponsor,
  PRESET_REQUIRED_DOCUMENTS,
  slugifyCustomKey
} from "@/lib/document-vault";
import type { RequiredDocumentItem } from "@/lib/firms/types";
import { saveFirmRequiredDocumentsAction } from "@/server/firm-actions";

function toCustomDraft(item: RequiredDocumentItem) {
  return { key: item.key, label: item.label, perSponsor: isPerSponsor(item) };
}

export function RequiredDocumentsControls({
  initialItems
}: {
  initialItems: RequiredDocumentItem[] | null;
}) {
  const [savedItems, setSavedItems] = useState<RequiredDocumentItem[]>(() =>
    initialItems && initialItems.length > 0 ? initialItems : getDefaultRequiredDocuments()
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

  const [customItems, setCustomItems] = useState<Array<{ key: string; label: string; perSponsor: boolean }>>(() => {
    return savedItems.filter((item) => item.isCustom).map(toCustomDraft);
  });

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
    if (trimmed.length > 80) {
      setError("Custom document label must be 80 characters or less.");
      return;
    }
    const key = slugifyCustomKey(trimmed);
    setCustomItems((prev) => [...prev, { key, label: trimmed, perSponsor: false }]);
    setNewCustomLabel("");
    setError(null);
  }

  function handleToggleCustomSponsor(index: number) {
    setCustomItems((prev) => prev.map((item, i) => (i === index ? { ...item, perSponsor: !item.perSponsor } : item)));
  }

  function handleRemoveCustom(index: number) {
    setCustomItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    setError(null);
    const itemsToSave: RequiredDocumentItem[] = [];

    // Presets in order of catalog
    for (const preset of PRESET_REQUIRED_DOCUMENTS) {
      if (selectedPresets.has(preset.key)) {
        itemsToSave.push({
          key: preset.key,
          label: preset.label,
          isCustom: false,
          perSponsor: isPerSponsor({ key: preset.key })
        });
      }
    }

    // Custom items
    for (const custom of customItems) {
      itemsToSave.push({
        key: custom.key,
        label: custom.label,
        isCustom: true,
        perSponsor: custom.perSponsor
      });
    }

    if (itemsToSave.length === 0) {
      setError("Please select or add at least one required document.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveFirmRequiredDocumentsAction(itemsToSave);
        if (res.ok) {
          setSavedItems(res.items);
          setSelectedPresets(new Set(res.items.filter((item) => !item.isCustom).map((item) => item.key)));
          setCustomItems(res.items.filter((item) => item.isCustom).map(toCustomDraft));
          setIsEditing(false);
        } else {
          setError(res.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save required documents.");
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
    setCustomItems(savedItems.filter((i) => i.isCustom).map(toCustomDraft));
    setIsEditing(false);
  }

  const currentItems = savedItems;

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-h3">Required client documents</h2>
          </div>
          <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
            Documents your firm asks clients to upload during intake and in their Document Vault.
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} size="sm" type="button" variant="outline">
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            Edit required documents
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {currentItems.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--haven-cream)] px-3 py-1 text-body-sm text-[var(--haven-ink)]"
              >
                <FileText className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
                <span>{item.label}</span>
                {item.isCustom && (
                  <span className="text-[11px] font-medium text-[var(--haven-ink-mid)]">(Custom)</span>
                )}
                {isPerSponsor(item) && (
                  <span className="text-[11px] font-medium text-[var(--haven-ink-mid)]">· per sponsor</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-body-sm font-medium text-[var(--haven-ink)]">
            Select standard immigration documents:
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PRESET_REQUIRED_DOCUMENTS.map((preset) => {
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
                    {isPerSponsor({ key: preset.key }) && (
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--haven-ink-mid)]">Asked once per sponsor</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="text-body-sm font-medium text-[var(--haven-ink)]">Custom required documents:</p>
            {customItems.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {customItems.map((item, idx) => (
                  <div
                    key={`${item.key}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--haven-cream)] px-3 py-1.5 text-body-sm text-[var(--haven-ink)]"
                  >
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-[var(--haven-ink-mid)]">
                      <input
                        checked={item.perSponsor}
                        className="h-3.5 w-3.5 rounded border-[var(--color-border)]"
                        onChange={() => handleToggleCustomSponsor(idx)}
                        type="checkbox"
                      />
                      Tied to a sponsor
                    </label>
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
                placeholder="e.g. Updated Resume, Prior I-20s, Marriage Certificate"
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
              {isPending ? "Saving..." : "Save required documents"}
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

"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { ALL_VISA_OPTIONS, VISA_CATEGORY_GROUPS, type VisaOptionItem } from "@/lib/visas";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface VisaSelectorProps {
  value?: string;
  customValue?: string;
  onChange: (value: string, customValue?: string) => void;
  hasError?: boolean;
  /** Field name for screen readers, read before the selected status. */
  ariaLabel?: string;
}

export function VisaSelector({ value = "", customValue = "", onChange, hasError, ariaLabel }: VisaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isCustom = useMemo(() => {
    if (!value) return false;
    if (value === "other") return true;
    return !ALL_VISA_OPTIONS.some((opt) => opt.value.toLowerCase() === value.toLowerCase());
  }, [value]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return VISA_CATEGORY_GROUPS;
    const q = search.toLowerCase();
    const result: typeof VISA_CATEGORY_GROUPS = {} as typeof VISA_CATEGORY_GROUPS;

    Object.entries(VISA_CATEGORY_GROUPS).forEach(([groupName, items]) => {
      const matched = items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.value.toLowerCase().includes(q) ||
          (item.detail && item.detail.toLowerCase().includes(q))
      );
      if (matched.length > 0) {
        result[groupName as keyof typeof VISA_CATEGORY_GROUPS] = matched;
      }
    });
    return result;
  }, [search]);

  const selectedItem = useMemo(() => {
    if (isCustom) {
      return {
        value: "other",
        label: customValue || value || "Other / Custom Status",
        group: "Other"
      };
    }
    return ALL_VISA_OPTIONS.find((opt) => opt.value.toLowerCase() === value.toLowerCase());
  }, [value, isCustom, customValue]);

  const handleSelect = (item: VisaOptionItem) => {
    if (item.value === "other") {
      onChange("other", customValue || "");
    } else {
      onChange(item.value, undefined);
    }
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-label={ariaLabel ? `${ariaLabel}: ${selectedItem?.label ?? "not set"}` : undefined}
          aria-expanded={isOpen}
          className={cn(
            "flex w-full min-h-11 items-center justify-between rounded-[var(--radius-md)] border bg-[var(--haven-white)] px-3.5 py-2 text-left text-sm transition-colors",
            hasError ? "border-[#e8b4b4] bg-[#fdf0f0]" : "border-[var(--color-border)] hover:border-[var(--haven-sage)]",
            isOpen && "border-[var(--haven-sage)] ring-1 ring-[var(--haven-sage)]"
          )}
        >
          <div className="flex flex-col truncate">
            {selectedItem ? (
              <span className="font-medium text-[var(--haven-ink)]">{selectedItem.label}</span>
            ) : (
              <span className="text-[var(--color-text-tertiary)]">Search or select your visa / status...</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--haven-ink-mid)] transition-transform duration-200" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-2 shadow-lg">
              <div className="sticky top-0 z-10 mb-2 bg-[var(--haven-white)] pb-1">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-tertiary)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search e.g. B-2, F-1, H-1B, O-1, Tourist, TPS..."
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] py-1.5 pl-9 pr-3 text-sm focus:border-[var(--haven-sage)] focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {Object.keys(filteredGroups).length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-body-sm text-[var(--color-text-secondary)]">No matching statuses found.</p>
                  <button
                    type="button"
                    onClick={() => {
                      onChange("other", search);
                      setIsOpen(false);
                    }}
                    className="mt-2 text-sm font-medium text-[var(--haven-sage)] underline underline-offset-2"
                  >
                    Use &ldquo;{search}&rdquo; as custom status
                  </button>
                </div>
              ) : (
                Object.entries(filteredGroups).map(([groupName, items]) => (
                  <div key={groupName} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      {groupName}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((opt) => {
                        const isSelected = value.toLowerCase() === opt.value.toLowerCase();
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelect(opt)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm transition-colors",
                              isSelected
                                ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)] font-medium"
                                : "text-[var(--haven-ink)] hover:bg-[var(--haven-cream)]"
                            )}
                          >
                            <div>
                              <p className="font-medium leading-snug">{opt.label}</p>
                              {opt.detail && (
                                <p className="text-xs text-[var(--color-text-secondary)]">{opt.detail}</p>
                              )}
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--haven-sage)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {isCustom && (
        <div className="rounded-[var(--radius-md)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)]/40 p-3.5 space-y-2">
          <label className="field-label" htmlFor="custom-visa-detail">
            Specify your status or class of admission <span className="text-[var(--haven-sage)]">*</span>
          </label>
          <Input
            id="custom-visa-detail"
            value={customValue || (value !== "other" ? value : "")}
            onChange={(e) => onChange("other", e.target.value)}
            placeholder="e.g. G-4, NATO, Paroled pending asylum, Withholding of removal, etc."
            required
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "custom-visa-detail-error" : undefined}
          />
          {hasError ? (
            <p className="text-caption text-[#b42318]" id="custom-visa-detail-error">
              Type your visa or status, or pick one from the list.
            </p>
          ) : null}
          <p className="text-caption text-[var(--color-text-secondary)]">
            Haven will record your exact status for tailored guidance and attorney review.
          </p>
        </div>
      )}
    </div>
  );
}

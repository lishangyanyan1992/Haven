"use client";

import type { FormEvent } from "react";
import { startTransition, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRESET_REQUIRED_DOCUMENTS } from "@/lib/document-vault";
import { willTakeSentence } from "@/lib/document-facts/catalog";

export function DocumentContextUploader({
  documentKind,
  displayLabel,
  buttonLabel = "Upload",
  allowCategorySelect = false,
  availableCategories,
  compact = false,
  petitionId,
  sponsorOptions = [],
  perSponsorKeys = [],
  onUploaded
}: {
  documentKind?: string;
  displayLabel?: string;
  buttonLabel?: string;
  allowCategorySelect?: boolean;
  availableCategories?: Array<{ key: string; label: string }>;
  compact?: boolean;
  /** Links the upload to this green card (set by a sponsor's checklist item). */
  petitionId?: string;
  /** The user's green cards, asked for when a sponsor-tied kind is uploaded without one. */
  sponsorOptions?: Array<{ id: string; label: string }>;
  /** Document kinds that belong to a sponsor. */
  perSponsorKeys?: string[];
  onUploaded?: (doc: { id: string; originalName: string; displayLabel: string; documentKind: string }) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<string>(documentKind ?? "");
  const [selectedSponsor, setSelectedSponsor] = useState<string>("");
  const effectiveKindNow = documentKind || selectedKind;
  // Ask which sponsor only when it matters: a sponsor document, no sponsor yet, and more than one to choose from.
  const askSponsor = !petitionId && sponsorOptions.length > 1 && perSponsorKeys.includes(effectiveKindNow);

  const categories = useMemo(() => {
    const list = [...PRESET_REQUIRED_DOCUMENTS.map((p) => ({ key: p.key, label: p.label }))];
    const seen = new Set(list.map((c) => c.key));
    if (availableCategories) {
      for (const cat of availableCategories) {
        if (!seen.has(cat.key)) {
          list.push(cat);
          seen.add(cat.key);
        }
      }
    }
    return list;
  }, [availableCategories]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("purpose", "context");

    const effectiveKind = documentKind || selectedKind;
    if (effectiveKind) {
      formData.set("documentKind", effectiveKind);
      const match = categories.find((p) => p.key === effectiveKind);
      formData.set("displayLabel", displayLabel || match?.label || effectiveKind);
    }

    const sponsorId = petitionId || (askSponsor ? selectedSponsor : sponsorOptions.length === 1 && perSponsorKeys.includes(effectiveKind) ? sponsorOptions[0].id : "");
    if (askSponsor && !sponsorId) {
      setError("Choose which sponsor this document is for.");
      return;
    }
    if (sponsorId) formData.set("petitionId", sponsorId);

    setIsUploading(true);
    setError(null);
    try {
      const fileInput = formData.get("file");
      const originalName = fileInput instanceof File ? fileInput.name : "Uploaded document";
      const response = await fetch("/api/files/sign", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      formRef.current?.reset();
      onUploaded?.({
        id: String(payload.id ?? ""),
        originalName,
        displayLabel: String(payload.displayLabel ?? displayLabel ?? ""),
        documentKind: String(payload.documentKind ?? effectiveKind ?? "")
      });
      startTransition(() => router.refresh());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      {documentKind ? <input type="hidden" name="documentKind" value={documentKind} /> : null}
      {displayLabel ? <input type="hidden" name="displayLabel" value={displayLabel} /> : null}

      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "sm:gap-3"}`}>
        {allowCategorySelect && !documentKind && (
          <select
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-2 text-body-sm text-[var(--haven-ink)]"
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
          >
            <option value="">Auto-detect category</option>
            {categories.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        {askSponsor && (
          <select
            aria-label="Which sponsor is this for?"
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-2 text-body-sm text-[var(--haven-ink)]"
            value={selectedSponsor}
            onChange={(e) => setSelectedSponsor(e.target.value)}
          >
            <option value="">Which sponsor is this for?</option>
            {sponsorOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        <Input
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt"
          className={compact ? "max-w-[220px] text-[13px]" : "max-w-sm"}
          name="file"
          required
          type="file"
        />

        <Button disabled={isUploading} size={compact ? "sm" : "default"} type="submit" variant="default">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isUploading ? "Uploading..." : buttonLabel}
        </Button>
      </div>

      {!compact && <p className="text-caption">PDF, JPG, PNG or text. 15 MB max.</p>}
      {!compact && allowCategorySelect && effectiveKindNow ? (
        <p className="text-caption">{willTakeSentence(effectiveKindNow)}</p>
      ) : null}
      {!compact && allowCategorySelect && !effectiveKindNow ? (
        <p className="text-caption">
          Haven takes a few details from I-140 notices, PERM certifications, H-1B approvals, I-94s and passports, and fills
          them in for you. You can change any of them in Settings.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-[var(--radius-lg)] bg-[var(--haven-blush-light)] px-3 py-2 text-body-sm text-[var(--haven-blush-ink)]">
          {error}
        </p>
      ) : null}
    </form>
  );
}

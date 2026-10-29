"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, UserRound } from "lucide-react";

import { formatSourceValue } from "@/lib/field-sources/format";
import { labelFor, type FieldSource } from "@/lib/field-sources/plan";
import { applyDocumentValueAction, keepMineAction } from "@/server/field-source-actions";

/**
 * Where a value came from, under its field: "From your I-140 notice, page 1",
 * "You entered this", or a disagreement with a document and the two ways to
 * settle it. Shows nothing for an empty field nobody has filled.
 */
export function FieldSourceLabel({
  fieldKey,
  source,
  hasValue = true,
  readOnly = false
}: {
  fieldKey: string;
  source: FieldSource | null | undefined;
  /** Whether the field holds a value now. */
  hasValue?: boolean;
  /** The lawyer's view: shows the label without the buttons. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!source && !hasValue) return null;

  const label = labelFor(source ?? undefined, formatSourceValue);
  const Icon = label.tone === "warning" ? AlertTriangle : label.tone === "document" ? FileText : UserRound;
  const tone =
    label.tone === "warning"
      ? "border-[var(--haven-blush)] bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
      : label.tone === "document"
        ? "border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
        : "border-transparent bg-transparent text-[var(--haven-ink-mid)]";

  function run(action: (key: string) => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(fieldKey);
      if (!result.ok) setError(result.error ?? "That didn't save. Try again.");
      else router.refresh();
    });
  }

  const showButtons = !readOnly && (label.canUseDocument || label.canKeepMine);
  return (
    <div className={`mt-1.5 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-[12px] ${tone}`} data-field-source={fieldKey}>
      <p className="flex items-start gap-1.5">
        <Icon aria-hidden className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        <span>{label.text}</span>
      </p>
      {showButtons ? (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {label.canUseDocument ? (
            <button
              className="rounded-[var(--radius-sm)] border border-current px-2 py-0.5 font-medium disabled:opacity-60"
              disabled={pending}
              onClick={() => run(applyDocumentValueAction)}
              type="button"
            >
              Use the document&apos;s value
            </button>
          ) : null}
          {label.canKeepMine ? (
            <button
              className="rounded-[var(--radius-sm)] border border-current px-2 py-0.5 font-medium disabled:opacity-60"
              disabled={pending}
              onClick={() => run(keepMineAction)}
              type="button"
            >
              Keep mine
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[var(--haven-blush-ink)]">{error}</p> : null}
    </div>
  );
}

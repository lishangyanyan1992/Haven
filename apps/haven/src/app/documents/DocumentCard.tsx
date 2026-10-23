"use client";

import { useState } from "react";
import { Download, Edit3, ExternalLink, FileText, Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PendingSubmitButton } from "@/components/app/pending-submit-button";
import { formatBytes, PRESET_REQUIRED_DOCUMENTS } from "@/lib/document-vault";
import { deleteVaultDocument, updateVaultDocumentAction } from "@/server/document-actions";
import { readDocumentAction } from "@/server/document-context-actions";
import type { UserDocument } from "@/types/domain";

const STATUS: Record<NonNullable<UserDocument["readingStatus"]>, string> = {
  done: "Ready — the chat can use it",
  pending: "Being read…",
  reading: "Being read…",
  deferred: "Daily reading limit reached — will be read tomorrow",
  failed: "Could not be read",
  not_requested: "Not read yet"
};

export function DocumentCard({ document }: { document: UserDocument }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(document.displayLabel || document.originalName);
  const [editKind, setEditKind] = useState<string>(document.documentKind || "other");
  const status = document.readingStatus ?? "not_requested";

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-body-sm font-semibold text-[var(--haven-ink)]">{document.originalName}</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--haven-cream)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--haven-ink)]">
            <FileText className="h-3 w-3 text-[var(--haven-ink-mid)]" />
            <span>{document.displayLabel || document.documentKind}</span>
          </span>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-[12px] text-[var(--haven-ink-mid)] hover:text-[var(--haven-ink)]"
              type="button"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isEditing ? (
          <form
            action={async (formData) => {
              await updateVaultDocumentAction(formData);
              setIsEditing(false);
            }}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="documentId" value={document.id} />
            <select
              name="documentKind"
              value={editKind}
              onChange={(e) => {
                setEditKind(e.target.value);
                const match = PRESET_REQUIRED_DOCUMENTS.find((p) => p.key === e.target.value);
                if (match) setEditLabel(match.label);
              }}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] px-2.5 py-1 text-body-sm text-[var(--haven-ink)]"
            >
              {PRESET_REQUIRED_DOCUMENTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="displayLabel"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] px-2.5 py-1 text-body-sm text-[var(--haven-ink)]"
              placeholder="Display label"
              required
            />
            <Button size="sm" type="submit">
              Save
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setIsEditing(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
            {formatBytes(document.fileSizeBytes)} · uploaded {new Date(document.uploadedAt).toLocaleDateString()} · {STATUS[status]}
          </p>
        )}

        {status === "failed" && document.readingError ? (
          <p className="mt-1 text-body-sm text-[var(--haven-blush-ink)]">{document.readingError}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={`/api/files/sign?documentId=${document.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] px-3 text-body-sm font-medium text-[var(--haven-ink)] hover:bg-[var(--haven-cream)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Open</span>
        </a>

        {status === "not_requested" || status === "failed" ? (
          <form action={readDocumentAction}>
            <input name="documentId" type="hidden" value={document.id} />
            <PendingSubmitButton
              label={status === "failed" ? "Try again" : "Read it"}
              pendingLabel="Starting…"
              variant="outline"
            />
          </form>
        ) : null}

        <form action={deleteVaultDocument}>
          <input name="documentId" type="hidden" value={document.id} />
          <PendingSubmitButton label="Delete" pendingLabel="Deleting…" />
        </form>
      </div>
    </div>
  );
}

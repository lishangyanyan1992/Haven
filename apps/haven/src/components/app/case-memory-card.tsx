"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BrainCircuit, FileText, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RememberedFact } from "@/lib/advisor/memory";
import type { FactLine } from "@/lib/document-facts/describe";

export type DocumentExtractedFactSummary = {
  documentId: string;
  documentName: string;
  lines: FactLine[];
};

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CaseMemoryCard({
  initialFacts = [],
  documentFacts = [],
  showDocumentFacts = false,
  onFactForgotten,
  onFactAdded
}: {
  initialFacts: RememberedFact[];
  documentFacts?: DocumentExtractedFactSummary[];
  showDocumentFacts?: boolean;
  onFactForgotten?: (factId: string) => void;
  onFactAdded?: (fact: RememberedFact) => void;
}) {
  const [facts, setFacts] = useState<RememberedFact[]>(initialFacts);
  const [newNote, setNewNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendingAddedRef = useRef<Map<string, RememberedFact>>(new Map());
  const pendingRemovedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // If incoming initialFacts has caught up with our local additions, clean them from pending
    for (const [id] of pendingAddedRef.current) {
      if (initialFacts.some((f) => f.id === id)) {
        pendingAddedRef.current.delete(id);
      }
    }
    // If incoming initialFacts no longer includes our deleted facts, clean them from pending
    for (const id of pendingRemovedRef.current) {
      if (!initialFacts.some((f) => f.id === id)) {
        pendingRemovedRef.current.delete(id);
      }
    }

    // Filter out facts deleted locally that an older snapshot may still contain
    const filtered = initialFacts.filter((f) => !pendingRemovedRef.current.has(f.id));
    // Prepend local additions that are not yet in initialFacts
    const pendingAdditions = Array.from(pendingAddedRef.current.values()).filter(
      (p) => !filtered.some((f) => f.id === p.id)
    );
    setFacts([...pendingAdditions, ...filtered]);
  }, [initialFacts]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newNote.trim();
    if (!trimmed) return;
    if (trimmed.length > 240) {
      setError("Notes must be 240 characters or fewer.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/advisor/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote: trimmed })
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Could not save note.");
          return;
        }

        pendingAddedRef.current.set(data.fact.id, data.fact);
        pendingRemovedRef.current.delete(data.fact.id);
        setFacts((prev) => [data.fact, ...prev.filter((f) => f.id !== data.fact.id)]);
        setNewNote("");
        onFactAdded?.(data.fact);
      } catch {
        setError("Network error. Please try again.");
      }
    });
  };

  const handleRemove = (factId: string) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/advisor/memory", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factId })
        });
        if (res.ok) {
          pendingRemovedRef.current.add(factId);
          pendingAddedRef.current.delete(factId);
          setFacts((prev) => prev.filter((f) => f.id !== factId));
          onFactForgotten?.(factId);
        } else {
          const data = await res.json();
          setError(data.error || "Could not remove that item.");
        }
      } catch {
        setError("Network error. Could not remove that item.");
      }
    });
  };

  return (
    <Card id="case-memory">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-label">Permanent case memory</p>
            <CardTitle className="mt-2">What Haven remembers about your case</CardTitle>
            <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
              Durable facts and notes carried across conversations and shared with your lawyer. Remove anything out of date, or add additional case context.
            </p>
          </div>
          <Badge variant="community">
            {facts.length} active item{facts.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAddNote} className="space-y-2">
          <label htmlFor="manual-note-input" className="field-label">
            Add a note or fact to permanent memory
          </label>
          <div className="flex gap-2">
            <Input
              id="manual-note-input"
              value={newNote}
              onChange={(e) => {
                setNewNote(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Laid off 10 days ago; H-1B transfer receipt IOE09... arrived"
              maxLength={240}
              className="flex-1"
              disabled={isPending}
            />
            <Button type="submit" disabled={isPending || !newNote.trim()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add note
            </Button>
          </div>
          <div className="flex items-center justify-between text-caption text-[var(--color-text-secondary)]">
            <span>Up to 240 characters. Feeds into Advisor answers and your lawyer dashboard.</span>
            <span>{newNote.length}/240</span>
          </div>
          {error && <p className="text-caption text-[var(--haven-blush-ink)]">{error}</p>}
        </form>

        <div className="space-y-2">
          <p className="field-label">Remembered facts & client notes</p>
          {facts.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-4 text-center text-body-sm text-[var(--haven-ink-mid)]">
              No remembered facts or notes on file. Add one above or chat with Advisor.
            </p>
          ) : (
            <ul className="space-y-2">
              {facts.map((fact) => {
                const isNote = fact.kind === "note";
                return (
                  <li
                    key={fact.id}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-3 text-body-sm"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--haven-ink)]">&ldquo;{fact.quote}&rdquo;</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                              isNote
                                ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                                : "bg-[var(--haven-cream)] text-[var(--haven-ink-mid)]"
                            }`}
                          >
                            {isNote ? "Added by you" : "From chat"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-caption text-[var(--color-text-secondary)]">
                          Recorded {formatRelativeTime(fact.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove: ${fact.quote}`}
                      onClick={() => handleRemove(fact.id)}
                      disabled={isPending}
                      className="shrink-0 text-[var(--color-text-secondary)] hover:bg-[var(--haven-blush-light)] hover:text-[var(--haven-blush-ink)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {showDocumentFacts && documentFacts.length > 0 && (
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="field-label">Facts extracted from documents</p>
                <p className="text-caption text-[var(--color-text-secondary)]">
                  Details Haven automatically read from uploaded notices and forms in your Document Vault.
                </p>
              </div>
              <Link
                href="/documents"
                className="text-caption font-medium text-[var(--haven-ink)] underline underline-offset-2"
              >
                View all in Vault →
              </Link>
            </div>
            <div className="space-y-2.5">
              {documentFacts.map((doc) => (
                <div
                  key={doc.documentId}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-3"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--color-text-secondary)]" />
                    <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{doc.documentName}</p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {doc.lines.map((line, idx) => (
                      <li key={idx} className="flex flex-wrap items-center justify-between gap-2 text-caption">
                        <span className="text-[var(--haven-ink)]">
                          <strong>{line.label}:</strong> {line.value || "—"}
                          {line.page ? ` (page ${line.page})` : ""}
                        </span>
                        <span
                          className={
                            line.tone === "check"
                              ? "text-[var(--haven-blush-ink)] font-medium"
                              : "text-[var(--color-text-secondary)]"
                          }
                        >
                          {line.outcome}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

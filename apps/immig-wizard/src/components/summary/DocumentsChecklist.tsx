'use client';

import { useState } from 'react';
import { WizardState } from '@/types/wizard';
import { getRequiredDocuments } from '@/lib/documents';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, FileText } from 'lucide-react';

interface DocumentsChecklistProps {
  wizardState: WizardState;
}

export function DocumentsChecklist({ wizardState }: DocumentsChecklistProps) {
  const { always, conditional } = getRequiredDocuments(wizardState);
  const allDocs = [...always, ...conditional];
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleDoc = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const progress = allDocs.length > 0 ? Math.round((checked.size / allDocs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-xl-token)] border border-[color:rgb(42_101_184_/_0.18)] bg-[color:var(--info-tint)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-[color:var(--info-foreground)]">
            <FileText className="h-5 w-5" />
            Document Collection Progress
          </h3>
          <span className="font-mono text-sm font-bold text-[color:var(--info)]">
            {checked.size}/{allDocs.length}
          </span>
        </div>
        <div className="mb-2 h-2.5 w-full rounded-full bg-white/70">
          <div
            className="h-2.5 rounded-full bg-[color:var(--info)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-[color:var(--info-foreground)]">
          Check off documents as you gather them. This is saved in your browser.
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">Always Required</h3>
          <Badge className="border-transparent bg-[color:var(--destructive-subtle)] text-[color:var(--error-ink)]">
            {always.length} documents
          </Badge>
        </div>
        <div className="space-y-2">
          {always.map((doc) => (
            <div
              key={doc.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg-token)] border p-4 transition-[border-color,background-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] ${
                checked.has(doc.id)
                  ? 'border-[color:rgb(42_125_82_/_0.22)] bg-[color:var(--success-tint)] shadow-[var(--shadow-xs)]'
                  : 'border-border bg-white hover:border-[color:var(--border-strong)]'
              }`}
              onClick={() => toggleDoc(doc.id)}
            >
              <Checkbox
                checked={checked.has(doc.id)}
                onCheckedChange={() => toggleDoc(doc.id)}
                className="mt-0.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`text-sm font-medium ${
                      checked.has(doc.id) ? 'text-muted-foreground line-through' : 'text-[color:var(--neutral-800)]'
                    }`}
                  >
                    {doc.name}
                  </p>
                  {checked.has(doc.id) && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--success)]" />
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{doc.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {conditional.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">Required Based on Your Answers</h3>
            <Badge className="border-transparent bg-[color:var(--warning-tint)] text-[color:var(--warning-foreground)]">
              {conditional.length} additional
            </Badge>
          </div>
          <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-lg-token)] border border-[color:rgb(217_123_42_/_0.22)] bg-[color:var(--warning-tint)] p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
            <p className="text-xs leading-5 text-[color:var(--warning-foreground)]">
              These documents are required based on your specific situation (prior marriages, travel history, etc.)
            </p>
          </div>
          <div className="space-y-2">
            {conditional.map((doc) => (
              <div
                key={doc.id}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg-token)] border p-4 transition-[border-color,background-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] ${
                  checked.has(doc.id)
                    ? 'border-[color:rgb(42_125_82_/_0.22)] bg-[color:var(--success-tint)] shadow-[var(--shadow-xs)]'
                    : 'border-[color:rgb(217_123_42_/_0.14)] bg-white hover:border-[color:rgb(217_123_42_/_0.28)]'
                }`}
                onClick={() => toggleDoc(doc.id)}
              >
                <Checkbox
                  checked={checked.has(doc.id)}
                  onCheckedChange={() => toggleDoc(doc.id)}
                  className="mt-0.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-medium ${
                        checked.has(doc.id) ? 'text-muted-foreground line-through' : 'text-[color:var(--neutral-800)]'
                      }`}
                    >
                      {doc.name}
                    </p>
                    {checked.has(doc.id) && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--success)]" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{doc.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

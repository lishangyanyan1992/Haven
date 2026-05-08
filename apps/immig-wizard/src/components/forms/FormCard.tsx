'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FormDefinition, FormValidationIssue } from '@/lib/forms/types';
import { WizardState, FormSupplementAnswers } from '@/types/wizard';
import { Download, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { MissingFieldsPanel } from './MissingFieldsPanel';

interface Props {
  form: FormDefinition;
  wizardState: WizardState | null;
  supplements: FormSupplementAnswers;
  issues: FormValidationIssue[];
}

type Status = 'idle' | 'loading' | 'done' | 'error';

export function FormCard({ form, wizardState, supplements, issues }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const blockingIssues = issues.filter((issue) => issue.blocking);

  const handleDownload = async () => {
    if (blockingIssues.length > 0) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(`/api/generate-form/${form.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: wizardState?.answers ?? {},
          supplements,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.name.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  return (
    <div className="rounded-[var(--radius-xl-token)] border border-border bg-white p-5 shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-md)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md-token)] bg-primary-subtle">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[color:var(--neutral-800)]">{form.name}</h3>
          <p className="mt-0.5 text-xs leading-6 text-muted-foreground">{form.description}</p>
        </div>
      </div>

      {status === 'error' && (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md-token)] border border-[color:rgb(201_58_50_/_0.22)] bg-[color:var(--destructive-subtle)] p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-[color:var(--error-ink)]">{errorMsg}</p>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mb-3">
          <MissingFieldsPanel
            issues={issues}
            compact
            title={
              blockingIssues.length > 0
                ? 'This form is missing required fields'
                : 'Manual follow-up items for this form'
            }
          />
        </div>
      )}

      {blockingIssues.length > 0 && (
        <div className="mb-3">
          <Link
            href={`/wizard/${blockingIssues[0].stepId}`}
            className="text-xs font-medium text-primary hover:text-[color:var(--primary-hover)]"
          >
            Jump to the first missing step
          </Link>
        </div>
      )}

      <Button
        size="sm"
        variant={status === 'done' ? 'outline' : 'default'}
        className="w-full"
        onClick={handleDownload}
        disabled={status === 'loading' || blockingIssues.length > 0}
      >
        {status === 'loading' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {status === 'done' && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-[color:var(--success)]" />}
        {status === 'idle' || status === 'error' ? <Download className="mr-1.5 h-3.5 w-3.5" /> : null}
        {status === 'loading'
          ? 'Generating…'
          : status === 'done'
          ? 'Downloaded'
          : blockingIssues.length > 0
          ? 'Fix required fields first'
          : status === 'error'
          ? 'Retry Download'
          : 'Download PDF'}
      </Button>
    </div>
  );
}

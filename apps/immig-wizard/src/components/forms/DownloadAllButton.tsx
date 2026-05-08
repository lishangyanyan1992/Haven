'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WizardState, FormSupplementAnswers } from '@/types/wizard';
import { FormDefinition, FormId, FormValidationIssue } from '@/lib/forms/types';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
  wizardState: WizardState | null;
  supplements: FormSupplementAnswers;
  selectedForms: FormDefinition[];
  validationByForm: Partial<Record<FormId, FormValidationIssue[]>>;
}

export function DownloadAllButton({ wizardState, supplements, selectedForms, validationByForm }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const blockingIssues = Object.values(validationByForm)
    .flat()
    .filter((issue) => issue?.blocking);

  const handleDownload = async () => {
    if (blockingIssues.length > 0) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/generate-all-forms', {
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
      a.download = 'immig-forms.zip';
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
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        variant="outline"
        className="w-full max-w-sm"
        onClick={handleDownload}
        disabled={status === 'loading' || blockingIssues.length > 0}
      >
        {status === 'loading' ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : status === 'done' ? (
          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {status === 'loading'
          ? 'Generating all forms…'
          : status === 'done'
          ? 'Downloaded (immig-forms.zip)'
          : blockingIssues.length > 0
          ? 'Fix required fields before ZIP download'
          : status === 'error'
          ? 'Retry Download All'
          : `Download All ${selectedForms.length} Forms as ZIP`}
      </Button>
      {status === 'error' && (
        <p className="text-xs text-red-600 text-center">{errorMsg}</p>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Downloads a .zip containing the {selectedForms.length} selected pre-filled PDF form{selectedForms.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}

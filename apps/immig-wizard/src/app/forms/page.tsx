'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { HavenMark } from '@/components/branding/HavenMark';
import { DraftConflictDialog } from '@/components/draft/DraftConflictDialog';
import { Button } from '@/components/ui/button';
import { FormCard } from '@/components/forms/FormCard';
import { DownloadAllButton } from '@/components/forms/DownloadAllButton';
import { PaymentSupplementForm } from '@/components/forms/PaymentSupplementForm';
import { MissingFieldsPanel } from '@/components/forms/MissingFieldsPanel';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { createInitialState } from '@/lib/storage';
import { ArrowLeft, FileText, Info } from 'lucide-react';
import { getSelectedForms, validateSelectedForms } from '@/lib/forms/packet';
import { FormId, FormValidationIssue } from '@/lib/forms/types';

const HAVEN_HOME_URL = 'https://haven-h1b.com/';

export default function FormsPage() {
  const {
    wizardState,
    supplements,
    isHydrating,
    conflict,
    chooseLocalDraft,
    chooseRemoteDraft,
    updateSupplements
  } = useWizardDraft();

  const selectedForms = useMemo(
    () => (wizardState ? getSelectedForms(wizardState.answers) : []),
    [wizardState]
  );

  const validationByForm = useMemo(
    () =>
      (wizardState
        ? validateSelectedForms(wizardState.answers, supplements)
        : ({} as Record<FormId, FormValidationIssue[]>)),
    [wizardState, supplements]
  );

  const allIssues = useMemo(
    () => Object.values(validationByForm).flat() as FormValidationIssue[],
    [validationByForm]
  );

  const selectedFormCount = selectedForms.length;
  const needsCreditCardForm =
    wizardState?.answers['payment_method'] === 'Credit card (Form G-1450)';

  if (isHydrating || !wizardState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--neutral-25)_0%,var(--neutral-50)_38%,var(--neutral-25)_100%)]">
      <header className="border-b border-border bg-[color:rgb(250_249_247_/_0.88)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href={HAVEN_HOME_URL} prefetch={false}>
              <HavenMark labelClassName="text-[1.65rem]" />
            </Link>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <p className="hidden text-sm text-muted-foreground sm:block">Prepare Forms</p>
          </div>
          <Link href="/summary">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Back to summary
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="rounded-[var(--radius-xl-token)] border border-border bg-white px-6 py-6 shadow-[var(--shadow-sm)]">
          <h1 className="flex items-center gap-2 text-4xl font-light text-foreground">
            <FileText className="h-6 w-6 text-primary" />
            Pre-filled USCIS packet forms
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            Review missing data before downloading. The download buttons stay blocked until each selected form has all
            required applicant-provided fields.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-[var(--radius-xl-token)] border border-[color:rgb(42_101_184_/_0.18)] bg-[color:var(--info-tint)] p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" />
          <div>
            <p className="text-sm font-medium text-[color:var(--info-foreground)]">About these PDFs</p>
            <p className="mt-1 text-xs leading-6 text-[color:var(--info-foreground)]">
              The app now checks required packet data form-by-form before generation. Manual items like signatures and
              the sealed I-693 are shown as follow-ups, but applicant-provided data gaps must be fixed first.
            </p>
          </div>
        </div>

        {needsCreditCardForm && (
          <PaymentSupplementForm value={supplements} onChange={updateSupplements} />
        )}

        <MissingFieldsPanel issues={allIssues} title="Packet completeness check" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {selectedForms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              wizardState={wizardState}
              supplements={supplements}
              issues={validationByForm[form.id] ?? []}
            />
          ))}
        </div>

        <div className="border-t border-border pt-2">
          <DownloadAllButton
            wizardState={wizardState}
            supplements={supplements}
            selectedForms={selectedForms}
            validationByForm={validationByForm}
          />
        </div>

        <div className="rounded-[var(--radius-xl-token)] border border-[color:rgb(42_125_82_/_0.2)] bg-[color:var(--success-tint)] p-4">
          <p className="text-sm font-medium text-[color:var(--success-ink)]">Packet summary</p>
          <p className="mt-1 text-xs leading-6 text-[color:var(--success-ink)]">
            {selectedFormCount} downloadable form{selectedFormCount === 1 ? '' : 's'} selected for this packet.
            Form I-693 remains a manual sealed document and is not part of the download set.
          </p>
        </div>

        <p className="pb-4 text-center text-xs leading-6 text-muted-foreground">
          ImmigWizard is for informational purposes only and does not constitute legal advice.
          Always consult a licensed immigration attorney and verify current USCIS form editions and filing addresses.
        </p>

        <DraftConflictDialog
          open={Boolean(conflict)}
          localState={conflict?.localState ?? createInitialState()}
          localSupplements={conflict?.localSupplements ?? {}}
          remoteState={conflict?.remoteState ?? createInitialState()}
          remoteSupplements={conflict?.remoteSupplements ?? {}}
          onChooseLocal={chooseLocalDraft}
          onChooseRemote={chooseRemoteDraft}
        />
      </main>
    </div>
  );
}

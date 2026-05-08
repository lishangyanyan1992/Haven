"use client";

import { formatDraftTime } from "@/lib/draft-summary";
import type { WizardState, FormSupplementAnswers } from "@/types/wizard";

type DraftConflictDialogProps = {
  open: boolean;
  localState: WizardState;
  localSupplements: FormSupplementAnswers;
  remoteState: WizardState;
  remoteSupplements: FormSupplementAnswers;
  onChooseLocal: () => void;
  onChooseRemote: () => void;
};

function countFilledSupplements(value: FormSupplementAnswers) {
  return Object.values(value ?? {}).filter(Boolean).length;
}

function summarize(state: WizardState, supplements: FormSupplementAnswers) {
  return {
    step: state.currentStep,
    answers: Object.keys(state.answers).length,
    completed: state.completedSteps.length,
    supplements: countFilledSupplements(supplements),
    updated: formatDraftTime(state.lastUpdatedAt)
  };
}

export function DraftConflictDialog({
  open,
  localState,
  localSupplements,
  remoteState,
  remoteSupplements,
  onChooseLocal,
  onChooseRemote
}: DraftConflictDialogProps) {
  if (!open) return null;

  const local = summarize(localState, localSupplements);
  const remote = summarize(remoteState, remoteSupplements);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-4xl rounded-[1.75rem] border border-border bg-white p-6 shadow-[var(--shadow-xl)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Choose a draft
        </p>
        <h2 className="mt-3 text-3xl font-light text-foreground">
          We found both browser and cloud progress.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Pick which version you want to keep. Your choice will become the active draft for this filing.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-[1.25rem] border border-border bg-[color:var(--neutral-25)] p-5">
            <p className="text-sm font-medium text-foreground">This browser</p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>Current step: {local.step}</p>
              <p>Answered fields: {local.answers}</p>
              <p>Completed steps: {local.completed}</p>
              <p>Supplement fields: {local.supplements}</p>
              <p>Last updated: {local.updated}</p>
            </div>
            <button
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white"
              onClick={onChooseLocal}
              type="button"
            >
              Use browser draft
            </button>
          </section>

          <section className="rounded-[1.25rem] border border-border bg-[color:var(--neutral-25)] p-5">
            <p className="text-sm font-medium text-foreground">Saved to account</p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>Current step: {remote.step}</p>
              <p>Answered fields: {remote.answers}</p>
              <p>Completed steps: {remote.completed}</p>
              <p>Supplement fields: {remote.supplements}</p>
              <p>Last updated: {remote.updated}</p>
            </div>
            <button
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium text-foreground"
              onClick={onChooseRemote}
              type="button"
            >
              Use saved account draft
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

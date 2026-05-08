import type { FormSupplementAnswers, WizardState } from '@/types/wizard';

type DraftSummary = {
  currentStep: number;
  answeredCount: number;
  completedStepsCount: number;
  lastUpdatedAt: string;
};

export function countAnsweredFields(state: WizardState) {
  return Object.values(state.answers).filter((value) => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.values(value).some(Boolean);
    return false;
  }).length;
}

export function summarizeDraft(state: WizardState): DraftSummary {
  return {
    currentStep: state.currentStep,
    answeredCount: countAnsweredFields(state),
    completedStepsCount: state.completedSteps.length,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}

export function areSupplementsEqual(
  left: FormSupplementAnswers,
  right: FormSupplementAnswers
) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

export function areWizardStatesEquivalent(left: WizardState, right: WizardState) {
  return (
    left.currentStep === right.currentStep &&
    left.startedAt === right.startedAt &&
    JSON.stringify(left.answers) === JSON.stringify(right.answers) &&
    JSON.stringify([...left.completedSteps].sort((a, b) => a - b)) ===
      JSON.stringify([...right.completedSteps].sort((a, b) => a - b))
  );
}

export function formatDraftTime(value?: string | null) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

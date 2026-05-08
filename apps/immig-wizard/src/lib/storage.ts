import { WizardState, FormSupplementAnswers } from '@/types/wizard';

const STORAGE_KEY = 'immig_wizard_progress';

export function saveProgress(state: WizardState): void {
  try {
    const serialized = JSON.stringify({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    console.warn('Failed to save wizard progress to localStorage');
  }
}

export function loadProgress(): WizardState | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as WizardState;
  } catch {
    console.warn('Failed to load wizard progress from localStorage');
    return null;
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn('Failed to clear wizard progress from localStorage');
  }
}

export function createInitialState(): WizardState {
  return {
    currentStep: 1,
    answers: {},
    completedSteps: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };
}

const SUPPLEMENTS_KEY = 'immig_form_supplements';

export function saveSupplements(data: FormSupplementAnswers): void {
  try {
    localStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(data));
  } catch {
    console.warn('Failed to save supplements to localStorage');
  }
}

export function loadSupplements(): FormSupplementAnswers | null {
  try {
    const serialized = localStorage.getItem(SUPPLEMENTS_KEY);
    if (!serialized) return null;
    return JSON.parse(serialized) as FormSupplementAnswers;
  } catch {
    console.warn('Failed to load supplements from localStorage');
    return null;
  }
}

export function clearSupplements(): void {
  try {
    localStorage.removeItem(SUPPLEMENTS_KEY);
  } catch {
    console.warn('Failed to clear supplements from localStorage');
  }
}

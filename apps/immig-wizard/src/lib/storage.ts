import { WizardState, FormSupplementAnswers } from '@/types/wizard';

const STORAGE_KEY = 'immig_wizard_progress';
const SENSITIVE_SUPPLEMENT_KEYS: Array<keyof FormSupplementAnswers> = [
  'payment_cardholder_given_name',
  'payment_cardholder_middle_name',
  'payment_cardholder_family_name',
  'payment_billing_street',
  'payment_billing_unit_type',
  'payment_billing_unit_number',
  'payment_billing_city',
  'payment_billing_state',
  'payment_billing_zip',
  'payment_daytime_phone',
  'payment_email',
  'payment_card_type',
  'payment_card_number',
  'payment_expiration_date',
  'payment_cvv',
  'payment_authorized_amount'
];

export function stripSensitiveSupplements(data: FormSupplementAnswers): FormSupplementAnswers {
  const sanitized = { ...data };
  for (const key of SENSITIVE_SUPPLEMENT_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

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
    localStorage.setItem(SUPPLEMENTS_KEY, JSON.stringify(stripSensitiveSupplements(data)));
  } catch {
    console.warn('Failed to save supplements to localStorage');
  }
}

export function loadSupplements(): FormSupplementAnswers | null {
  try {
    const serialized = localStorage.getItem(SUPPLEMENTS_KEY);
    if (!serialized) return null;
    return stripSensitiveSupplements(JSON.parse(serialized) as FormSupplementAnswers);
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

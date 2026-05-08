import type { FormSupplementAnswers } from '@/types/wizard';
import { FORM_REGISTRY } from './form-registry';
import { resolveField } from './resolver';
import type { Answers, FormDefinition, FormId, FormValidationIssue } from './types';

export function getSelectedFormIds(answers: Answers): FormId[] {
  const formIds: FormId[] = ['g1145', 'i130', 'i130a', 'i485', 'i864'];

  if (answers['payment_method'] === 'Credit card (Form G-1450)') {
    formIds.push('g1450');
  }
  if (answers['include_i765'] === 'yes') {
    formIds.push('i765');
  }
  if (answers['include_i131'] === 'yes') {
    formIds.push('i131');
  }

  return formIds;
}

export function getSelectedForms(answers: Answers): FormDefinition[] {
  return getSelectedFormIds(answers).map((formId) => FORM_REGISTRY[formId]);
}

export function validateForm(
  form: FormDefinition,
  answers: Answers,
  supplements: FormSupplementAnswers
): FormValidationIssue[] {
  const issues: FormValidationIssue[] = [];

  for (const mapping of form.fieldMappings) {
    if (!mapping.required) continue;
    const requiredWhen = mapping.required.requiredWhen?.(answers, supplements) ?? true;
    if (!requiredWhen) continue;

    const value = resolveField(mapping, answers, supplements);
    if (value === undefined || value === null || value === '') {
      const stepId =
        typeof mapping.required.stepId === 'function'
          ? mapping.required.stepId(answers, supplements)
          : mapping.required.stepId;
      issues.push({
        formId: form.id,
        formName: form.name,
        label: mapping.required.label,
        stepId,
        formPage: mapping.required.formPage,
        blocking: mapping.required.blocking ?? true,
      });
    }
  }

  for (const requirement of form.manualRequirements ?? []) {
    issues.push({
      formId: form.id,
      formName: form.name,
      label: requirement.label,
      stepId: requirement.stepId ?? null,
      formPage: requirement.formPage,
      blocking: requirement.blocking ?? false,
    });
  }

  return issues;
}

export function validateSelectedForms(
  answers: Answers,
  supplements: FormSupplementAnswers
): Record<FormId, FormValidationIssue[]> {
  const result = {} as Record<FormId, FormValidationIssue[]>;

  for (const form of getSelectedForms(answers)) {
    result[form.id] = validateForm(form, answers, supplements);
  }

  return result;
}

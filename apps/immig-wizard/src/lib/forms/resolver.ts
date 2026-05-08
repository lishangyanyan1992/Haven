import type { FieldMapping, Answers } from './types';
import type { FormSupplementAnswers, AddressValue } from '@/types/wizard';

function normalizeAnswerValue(key: string, value: string): string {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes('ssn')) {
    return value.replace(/\D+/g, '');
  }
  if (normalizedKey.includes('anumber')) {
    return value.replace(/[^0-9]/g, '').slice(-9);
  }
  return value.trim();
}

/**
 * Resolves a single FieldMapping to a string value using wizard answers + supplement data.
 * Returns undefined if no value is available.
 */
export function resolveField(
  mapping: FieldMapping,
  answers: Answers,
  supplements: FormSupplementAnswers
): string | undefined {
  const { source } = mapping;

  switch (source.type) {
    case 'answer': {
      const val = answers[source.key];
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'boolean') return val ? 'Yes' : 'No';
      if (typeof val === 'string') {
        const normalized = normalizeAnswerValue(source.key, val);
        return normalized || undefined;
      }
      return undefined;
    }

    case 'address': {
      const val = answers[source.key];
      if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined;
      const addr = val as AddressValue;
      const part = addr[source.part];
      return typeof part === 'string' && part.trim() ? part.trim() : undefined;
    }

    case 'constant': {
      return source.value;
    }

    case 'supplement': {
      const val = supplements[source.key];
      return typeof val === 'string' && val.trim() ? val.trim() : undefined;
    }

    case 'derived': {
      return source.fn(answers, supplements);
    }
  }
}

/**
 * Builds a map of pdfField → value for all mappings in a form.
 */
export function buildFieldValues(
  mappings: FieldMapping[],
  answers: Answers,
  supplements: FormSupplementAnswers
): Map<string, string> {
  const result = new Map<string, string>();
  for (const mapping of mappings) {
    if (mapping.skipRender) {
      continue;
    }
    const value = resolveField(mapping, answers, supplements);
    if (value !== undefined) {
      result.set(mapping.pdfField, value);
    }
  }
  return result;
}

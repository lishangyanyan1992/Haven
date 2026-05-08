import test from 'node:test';
import assert from 'node:assert/strict';
import { FORM_REGISTRY } from '../src/lib/forms/form-registry';
import { fillForm } from '../src/lib/forms/fill-pdf';
import { createBaseAnswers, createPaymentSupplements } from './test-data';

test('fillForm smoke test for representative packet forms', async () => {
  const answers = createBaseAnswers();
  const supplements = createPaymentSupplements();

  for (const formId of ['g1145', 'g1450', 'i130', 'i485'] as const) {
    const pdfBytes = await fillForm(FORM_REGISTRY[formId], answers, supplements);
    assert.ok(pdfBytes.byteLength > 1000, `${formId} should produce a non-empty PDF`);
  }
});

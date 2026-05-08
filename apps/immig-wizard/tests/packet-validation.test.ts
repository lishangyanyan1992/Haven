import test from 'node:test';
import assert from 'node:assert/strict';
import { getSelectedFormIds, validateSelectedForms } from '../src/lib/forms/packet';
import { createBaseAnswers, createPaymentSupplements } from './test-data';

test('selected packet forms include optional I-765, I-131, and G-1450 when chosen', () => {
  const answers = createBaseAnswers();
  assert.deepEqual(getSelectedFormIds(answers), [
    'g1145',
    'i130',
    'i130a',
    'i485',
    'i864',
    'g1450',
    'i765',
    'i131',
  ]);
});

test('missing G-1450 payment fields block downloads and point to page 1', () => {
  const answers = createBaseAnswers();
  const issues = validateSelectedForms(answers, {});
  const g1450Issues = issues.g1450 ?? [];

  assert.ok(g1450Issues.some((issue) => issue.blocking));
  assert.ok(g1450Issues.every((issue) => issue.formPage === 1));
});

test('beneficiary can explicitly have no SSN without blocking I-485/I-765/I-131', () => {
  const answers = createBaseAnswers();
  answers.beneficiary_ssn_status = 'Does not have SSN yet';
  delete answers.beneficiary_ssn;

  const issues = validateSelectedForms(answers, createPaymentSupplements());
  const ssnIssues = Object.values(issues)
    .flat()
    .filter((issue) => issue.label.toLowerCase().includes('ssn'));

  assert.equal(ssnIssues.length, 0);
});

test('complete payment details clear all blocking issues for G-1450', () => {
  const answers = createBaseAnswers();
  const issues = validateSelectedForms(answers, createPaymentSupplements());
  const blockingIssues = (issues.g1450 ?? []).filter((issue) => issue.blocking);

  assert.deepEqual(blockingIssues, []);
  assert.ok((issues.g1450 ?? []).some((issue) => issue.blocking === false));
});

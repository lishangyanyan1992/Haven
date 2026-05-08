import type { FieldMapping } from '../types';

function usePetitionerContact(answers: import('../types').Answers): boolean {
  return answers['g1145_contact_preference'] !== 'Beneficiary';
}

export const g1145Fields: FieldMapping[] = [
  {
    pdfField: 'form1[0].#subform[0].LastName[0]',
    source: {
      type: 'derived',
      fn: (answers) =>
        usePetitionerContact(answers)
          ? (answers['petitioner_last_name'] as string | undefined)
          : (answers['beneficiary_last_name'] as string | undefined),
    },
    required: {
      label: 'G-1145 contact family name',
      stepId: (answers) => (usePetitionerContact(answers) ? 2 : 3),
      formPage: 1,
    },
  },
  {
    pdfField: 'form1[0].#subform[0].FirstName[0]',
    source: {
      type: 'derived',
      fn: (answers) =>
        usePetitionerContact(answers)
          ? (answers['petitioner_first_name'] as string | undefined)
          : (answers['beneficiary_first_name'] as string | undefined),
    },
    required: {
      label: 'G-1145 contact given name',
      stepId: (answers) => (usePetitionerContact(answers) ? 2 : 3),
      formPage: 1,
    },
  },
  {
    pdfField: 'form1[0].#subform[0].MiddleName[0]',
    source: {
      type: 'derived',
      fn: (answers) =>
        usePetitionerContact(answers)
          ? (answers['petitioner_middle_name'] as string | undefined)
          : (answers['beneficiary_middle_name'] as string | undefined),
    },
  },
  {
    pdfField: 'form1[0].#subform[0].Email[0]',
    source: {
      type: 'derived',
      fn: (answers) =>
        usePetitionerContact(answers)
          ? (answers['petitioner_email'] as string | undefined)
          : (answers['beneficiary_email'] as string | undefined),
    },
    required: {
      label: 'G-1145 email address',
      stepId: (answers) => (usePetitionerContact(answers) ? 2 : 3),
      formPage: 1,
    },
  },
  {
    pdfField: 'form1[0].#subform[0].MobilePhoneNumber[0]',
    source: {
      type: 'derived',
      fn: (answers) =>
        usePetitionerContact(answers)
          ? (answers['petitioner_phone'] as string | undefined)
          : (answers['beneficiary_phone'] as string | undefined),
    },
    required: {
      label: 'G-1145 mobile phone number',
      stepId: (answers) => (usePetitionerContact(answers) ? 2 : 3),
      formPage: 1,
    },
  },
];

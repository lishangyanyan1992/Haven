import type { FieldMapping } from '../types';

function countRepeaterItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export const i130Fields: FieldMapping[] = [
  // ── Part 2: Petitioner ──────────────────────────────────────────────────
  {
    pdfField: 'form1[0].#subform[0].Pt2Line4a_FamilyName[0]',
    source: { type: 'answer', key: 'petitioner_last_name' },
    required: { label: 'Petitioner family name', stepId: 2 },
  },
  {
    pdfField: 'form1[0].#subform[0].Pt2Line4b_GivenName[0]',
    source: { type: 'answer', key: 'petitioner_first_name' },
    required: { label: 'Petitioner given name', stepId: 2 },
  },
  { pdfField: 'form1[0].#subform[0].Pt2Line4c_MiddleName[0]',    source: { type: 'answer', key: 'petitioner_middle_name' } },
  {
    pdfField: 'form1[0].#subform[0].Pt2Line11_SSN[0]',
    source: { type: 'answer', key: 'petitioner_ssn' },
    required: { label: 'Petitioner SSN', stepId: 2 },
  },
  {
    pdfField: 'form1[0].#subform[1].Pt2Line8_DateofBirth[0]',
    source: { type: 'answer', key: 'petitioner_dob' },
    required: { label: 'Petitioner date of birth', stepId: 2 },
  },
  {
    pdfField: 'form1[0].#subform[1].Pt2Line7_CountryofBirth[0]',
    source: { type: 'answer', key: 'petitioner_country_birth' },
    required: { label: 'Petitioner country of birth', stepId: 2 },
  },
  // Petitioner current address
  {
    pdfField: 'form1[0].#subform[1].Pt2Line10_StreetNumberName[0]',
    source: { type: 'address', key: 'petitioner_mailing_address', part: 'street' },
    required: { label: 'Petitioner mailing street address', stepId: 2 },
  },
  {
    pdfField: 'form1[0].#subform[1].Pt2Line10_CityOrTown[0]',
    source: { type: 'address', key: 'petitioner_mailing_address', part: 'city' },
    required: { label: 'Petitioner mailing city', stepId: 2 },
  },
  { pdfField: 'form1[0].#subform[1].Pt2Line10_State[0]',            source: { type: 'address', key: 'petitioner_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line10_ZipCode[0]',          source: { type: 'address', key: 'petitioner_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line10_Country[0]',          source: { type: 'address', key: 'petitioner_mailing_address', part: 'country' } },
  // Number of prior marriages (1 = none, or actual count + 1 for current)
  {
    pdfField: 'form1[0].#subform[1].Pt2Line16_NumberofMarriages[0]',
    source: {
      type: 'derived',
      fn: (a) => {
        const prior = countRepeaterItems(a['petitioner_prior_marriages_list']);
        return String(prior + 1);
      },
    },
  },
  // ── Part 2: Marriage ────────────────────────────────────────────────────
  {
    pdfField: 'form1[0].#subform[2].Pt2Line18_DateOfMarriage[0]',
    source: { type: 'answer', key: 'marriage_date' },
    required: { label: 'Marriage date', stepId: 4 },
  },
  {
    pdfField: 'form1[0].#subform[2].Pt2Line19a_CityTown[0]',
    source: { type: 'answer', key: 'marriage_city' },
    required: { label: 'Marriage city', stepId: 4 },
  },
  {
    pdfField: 'form1[0].#subform[2].Pt2Line19b_State[0]',
    source: { type: 'answer', key: 'marriage_state' },
    required: { label: 'Marriage state or province', stepId: 4 },
  },
  {
    pdfField: 'form1[0].#subform[2].Pt2Line19d_Country[0]',
    source: { type: 'answer', key: 'marriage_country' },
    required: { label: 'Marriage country', stepId: 4 },
  },
  // Current spouse (beneficiary) name
  {
    pdfField: 'form1[0].#subform[2].Pt2Line22a_FamilyName[0]',
    source: { type: 'answer', key: 'beneficiary_last_name' },
    required: { label: 'Beneficiary family name', stepId: 3 },
  },
  {
    pdfField: 'form1[0].#subform[2].Pt2Line22b_GivenName[0]',
    source: { type: 'answer', key: 'beneficiary_first_name' },
    required: { label: 'Beneficiary given name', stepId: 3 },
  },
  { pdfField: 'form1[0].#subform[2].Pt2Line22c_MiddleName[0]',      source: { type: 'answer', key: 'beneficiary_middle_name' } },
  // Beneficiary DOB, country in marriage section
  {
    pdfField: 'form1[0].#subform[2].Pt2Line25_DateofBirth[0]',
    source: { type: 'answer', key: 'beneficiary_dob' },
    required: { label: 'Beneficiary date of birth', stepId: 3 },
  },
  {
    pdfField: 'form1[0].#subform[2].Pt2Line27_CountryofBirth[0]',
    source: { type: 'answer', key: 'beneficiary_country_birth' },
    required: { label: 'Beneficiary country of birth', stepId: 3 },
  },
  // ── Part 4: Beneficiary ─────────────────────────────────────────────────
  { pdfField: 'form1[0].#subform[4].Pt4Line4a_FamilyName[0]',   source: { type: 'answer', key: 'beneficiary_last_name' } },
  { pdfField: 'form1[0].#subform[4].Pt4Line4b_GivenName[0]',    source: { type: 'answer', key: 'beneficiary_first_name' } },
  { pdfField: 'form1[0].#subform[4].Pt4Line4c_MiddleName[0]',   source: { type: 'answer', key: 'beneficiary_middle_name' } },
  { pdfField: 'form1[0].#subform[4].Pt4Line8_CountryOfBirth[0]', source: { type: 'answer', key: 'beneficiary_country_birth' } },
  { pdfField: 'form1[0].#subform[4].Pt4Line14_DaytimePhoneNumber[0]', source: { type: 'answer', key: 'beneficiary_phone' } },
  { pdfField: 'form1[0].#subform[5].Pt4Line16_EmailAddress[0]', source: { type: 'answer', key: 'beneficiary_email' } },
  {
    pdfField: 'form1[0].#subform[5].Pt4Line17_NumberofMarriages[0]',
    source: {
      type: 'derived',
      fn: (a) => {
        const prior = countRepeaterItems(a['beneficiary_prior_marriages_list']);
        return String(prior + 1);
      },
    },
  },
  { pdfField: 'form1[0].#subform[5].Pt4Line19_DateOfMarriage[0]', source: { type: 'answer', key: 'marriage_date' } },
  { pdfField: 'form1[0].#subform[6].Pt4Line22_PassportNumber[0]', source: { type: 'answer', key: 'beneficiary_passport_number' } },
];

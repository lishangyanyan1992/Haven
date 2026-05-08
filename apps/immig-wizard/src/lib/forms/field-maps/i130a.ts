import type { FieldMapping } from '../types';

// I-130A: Supplemental Information for Spouse Beneficiary
// Part 1 = Beneficiary (the immigrant spouse)
// Part 2 = Petitioner's employer info
export const i130aFields: FieldMapping[] = [
  // ── Part 1: Beneficiary info ────────────────────────────────────────────
  {
    pdfField: 'form1[0].#subform[0].Pt1Line3a_FamilyName[0]',
    source: { type: 'answer', key: 'beneficiary_last_name' },
    required: { label: 'Beneficiary family name', stepId: 3 },
  },
  {
    pdfField: 'form1[0].#subform[0].Pt1Line3b_GivenName[0]',
    source: { type: 'answer', key: 'beneficiary_first_name' },
    required: { label: 'Beneficiary given name', stepId: 3 },
  },
  { pdfField: 'form1[0].#subform[0].Pt1Line3c_MiddleName[0]',  source: { type: 'answer', key: 'beneficiary_middle_name' } },
  { pdfField: 'form1[0].#subform[0].Pt1Line1_AlienNumber[0]',  source: { type: 'answer', key: 'beneficiary_anumber' } },
  // Beneficiary's US address
  {
    pdfField: 'form1[0].#subform[0].Pt1Line4a_StreetNumberName[0]',
    source: { type: 'address', key: 'beneficiary_mailing_address', part: 'street' },
    required: { label: 'Beneficiary mailing street address', stepId: 3 },
  },
  { pdfField: 'form1[0].#subform[0].Pt1Line4c_CityOrTown[0]',       source: { type: 'address', key: 'beneficiary_mailing_address', part: 'city' } },
  { pdfField: 'form1[0].#subform[0].Pt1Line4d_State[0]',            source: { type: 'address', key: 'beneficiary_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].#subform[0].Pt1Line4e_ZipCode[0]',          source: { type: 'address', key: 'beneficiary_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].#subform[0].Pt1Line4h_Country[0]',          source: { type: 'address', key: 'beneficiary_mailing_address', part: 'country' } },
  // DOB and country
  { pdfField: 'form1[0].#subform[1].Pt1Line11_DateofBirth[0]',       source: { type: 'answer', key: 'beneficiary_dob' }, required: { label: 'Beneficiary date of birth', stepId: 3 } },
  { pdfField: 'form1[0].#subform[1].Pt1Line14_CountryofBirth[0]',    source: { type: 'answer', key: 'beneficiary_country_birth' } },
  { pdfField: 'form1[0].#subform[1].Pt1Line13_CountryofBirth[0]',    source: { type: 'answer', key: 'beneficiary_country_citizenship' } },
  { pdfField: 'form1[0].#subform[1].Pt1Line15_CountryofResidence[0]', source: { type: 'answer', key: 'beneficiary_country_citizenship' } },
  // ── Part 2: Petitioner's employer ───────────────────────────────────────
  { pdfField: 'form1[0].#subform[1].Pt2Line1_EmployerOrCompName[0]', source: { type: 'answer', key: 'petitioner_employer' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line2a_StreetNumberName[0]',  source: { type: 'address', key: 'petitioner_employer_address', part: 'street' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line2c_CityOrTown[0]',        source: { type: 'address', key: 'petitioner_employer_address', part: 'city' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line2d_State[0]',             source: { type: 'address', key: 'petitioner_employer_address', part: 'state' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line2e_ZipCode[0]',           source: { type: 'address', key: 'petitioner_employer_address', part: 'zip' } },
  { pdfField: 'form1[0].#subform[1].Pt2Line2h_Country[0]',           source: { type: 'address', key: 'petitioner_employer_address', part: 'country' } },
];

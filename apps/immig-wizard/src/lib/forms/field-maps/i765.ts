import type { FieldMapping } from '../types';

// I-765: Application for Employment Authorization
// Applicant = beneficiary (pending AOS)
// Eligibility category for concurrent I-485 filer: (c)(9)
export const i765Fields: FieldMapping[] = [
  // ── Page 1: Applicant name ──────────────────────────────────────────────
  { pdfField: 'form1[0].Page1[0].Line1a_FamilyName[0]',  source: { type: 'answer', key: 'beneficiary_last_name' }, required: { label: 'Beneficiary family name', stepId: 3 } },
  { pdfField: 'form1[0].Page1[0].Line1b_GivenName[0]',   source: { type: 'answer', key: 'beneficiary_first_name' }, required: { label: 'Beneficiary given name', stepId: 3 } },
  { pdfField: 'form1[0].Page1[0].Line1c_MiddleName[0]',  source: { type: 'answer', key: 'beneficiary_middle_name' } },
  // ── Page 2: Address and personal info ──────────────────────────────────
  { pdfField: 'form1[0].Page2[0].Line4b_StreetNumberName[0]', source: { type: 'address', key: 'beneficiary_mailing_address', part: 'street' }, required: { label: 'Beneficiary mailing street address', stepId: 3 } },
  { pdfField: 'form1[0].Page2[0].Pt2Line5_CityOrTown[0]',    source: { type: 'address', key: 'beneficiary_mailing_address', part: 'city' } },
  { pdfField: 'form1[0].Page2[0].Pt2Line5_State[0]',         source: { type: 'address', key: 'beneficiary_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].Page2[0].Pt2Line5_ZipCode[0]',       source: { type: 'address', key: 'beneficiary_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].Page2[0].Pt2Line7_StreetNumberName[0]', source: { type: 'address', key: 'beneficiary_mailing_address', part: 'street' } },
  { pdfField: 'form1[0].Page2[0].Pt2Line7_CityOrTown[0]',       source: { type: 'address', key: 'beneficiary_mailing_address', part: 'city' } },
  { pdfField: 'form1[0].Page2[0].Pt2Line7_State[0]',            source: { type: 'address', key: 'beneficiary_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].Page2[0].Pt2Line7_ZipCode[0]',          source: { type: 'address', key: 'beneficiary_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].Page2[0].Line7_AlienNumber[0]',         source: { type: 'answer', key: 'beneficiary_anumber' } },
  { pdfField: 'form1[0].Page2[0].Line12b_SSN[0]',               source: { type: 'answer', key: 'beneficiary_ssn' }, required: { label: 'Beneficiary SSN or no-SSN answer', stepId: 3, requiredWhen: (answers) => answers['beneficiary_ssn_status'] === 'Has SSN' } },
  { pdfField: 'form1[0].Page2[0].Line17a_CountryOfBirth[0]',    source: { type: 'answer', key: 'beneficiary_country_birth' } },
  { pdfField: 'form1[0].Page2[0].Line17b_CountryOfBirth[0]',    source: { type: 'answer', key: 'beneficiary_country_citizenship' } },
  // ── Page 3: Immigration info ────────────────────────────────────────────
  { pdfField: 'form1[0].Page3[0].Line19_DOB[0]',              source: { type: 'answer', key: 'beneficiary_dob' }, required: { label: 'Beneficiary date of birth', stepId: 3 } },
  { pdfField: 'form1[0].Page3[0].Line18c_CountryOfBirth[0]',  source: { type: 'answer', key: 'beneficiary_country_birth' } },
  { pdfField: 'form1[0].Page3[0].Line20a_I94Number[0]',       source: { type: 'answer', key: 'i94_number' }, required: { label: 'I-94 number', stepId: 7 } },
  { pdfField: 'form1[0].Page3[0].Line20b_Passport[0]',        source: { type: 'answer', key: 'beneficiary_passport_number' }, required: { label: 'Beneficiary passport number', stepId: 3 } },
  { pdfField: 'form1[0].Page3[0].Line21_DateOfLastEntry[0]',  source: { type: 'answer', key: 'last_entry_date' }, required: { label: 'Last entry date', stepId: 7 } },
  { pdfField: 'form1[0].Page3[0].place_entry[0]',             source: { type: 'answer', key: 'last_entry_port' }, required: { label: 'Port of entry', stepId: 7 } },
  { pdfField: 'form1[0].Page3[0].Line23_StatusLastEntry[0]',  source: { type: 'answer', key: 'current_visa_type' } },
  { pdfField: 'form1[0].Page3[0].Line24_CurrentStatus[0]',    source: { type: 'answer', key: 'current_visa_type' } },
  // Eligibility category: (c)(9) for concurrent I-485 filer
  { pdfField: 'form1[0].Page3[0].#area[1].section_1[0]', source: { type: 'constant', value: 'c' } },
  { pdfField: 'form1[0].Page3[0].#area[1].section_2[0]', source: { type: 'constant', value: '9' } },
];

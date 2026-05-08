import type { FieldMapping } from '../types';

// I-131: Application for Travel Document (Advance Parole)
// Applicant = beneficiary (pending AOS)
export const i131Fields: FieldMapping[] = [
  // ── Part 2: Information About You (Applicant = Beneficiary) ────────────
  { pdfField: 'form1[0].P4[0].Part2_Line1_FamilyName[0]',  source: { type: 'answer', key: 'beneficiary_last_name' }, required: { label: 'Beneficiary family name', stepId: 3 } },
  { pdfField: 'form1[0].P4[0].Part2_Line1_GivenName[0]',   source: { type: 'answer', key: 'beneficiary_first_name' }, required: { label: 'Beneficiary given name', stepId: 3 } },
  { pdfField: 'form1[0].P4[0].Part2_Line1_MiddleName[0]',  source: { type: 'answer', key: 'beneficiary_middle_name' } },
  // Current address
  { pdfField: 'form1[0].P5[0].Part2_Line3_StreetNumberName[0]', source: { type: 'address', key: 'beneficiary_mailing_address', part: 'street' }, required: { label: 'Beneficiary mailing street address', stepId: 3 } },
  { pdfField: 'form1[0].P5[0].Part2_Line3_CityTown[0]',         source: { type: 'address', key: 'beneficiary_mailing_address', part: 'city' } },
  { pdfField: 'form1[0].P5[0].Part2_Line3_State[0]',            source: { type: 'address', key: 'beneficiary_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].P5[0].Part2_Line3_ZipCode[0]',          source: { type: 'address', key: 'beneficiary_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].P5[0].Part2_Line3_Country[0]',          source: { type: 'address', key: 'beneficiary_mailing_address', part: 'country' } },
  // Personal info
  { pdfField: 'form1[0].P5[0].#area[0].Part2_Line5_AlienNumber[0]',  source: { type: 'answer', key: 'beneficiary_anumber' } },
  { pdfField: 'form1[0].P5[0].#area[1].Part2_Line10_SSN[0]',         source: { type: 'answer', key: 'beneficiary_ssn' }, required: { label: 'Beneficiary SSN or no-SSN answer', stepId: 3, requiredWhen: (answers) => answers['beneficiary_ssn_status'] === 'Has SSN' } },
  { pdfField: 'form1[0].P5[0].Part2_Line9_DateOfBirth[0]',           source: { type: 'answer', key: 'beneficiary_dob' }, required: { label: 'Beneficiary date of birth', stepId: 3 } },
  { pdfField: 'form1[0].P5[0].Part2_Line6_CountryOfBirth[0]',        source: { type: 'answer', key: 'beneficiary_country_birth' } },
  { pdfField: 'form1[0].P5[0].Part2_Line7_CountryOfCitizenshiporNationality[0]', source: { type: 'answer', key: 'beneficiary_country_citizenship' } },
  { pdfField: 'form1[0].P5[0].Part2_Line12_ClassofAdmission[0]',     source: { type: 'answer', key: 'current_visa_type' }, required: { label: 'Class of admission', stepId: 7 } },
  { pdfField: 'form1[0].P5[0].Part2_Line13_I94RecordNo[0]',          source: { type: 'answer', key: 'i94_number' }, required: { label: 'I-94 number', stepId: 7 } },
  // Basis for travel document: pending AOS
  { pdfField: 'form1[0].P6[0].P2_Line16_FamilyName[0]', source: { type: 'answer', key: 'beneficiary_last_name' } },
  { pdfField: 'form1[0].P6[0].P2_Line16_GivenName[0]',  source: { type: 'answer', key: 'beneficiary_first_name' } },
  { pdfField: 'form1[0].P6[0].P2_Line16_MiddleName[0]', source: { type: 'answer', key: 'beneficiary_middle_name' } },
  { pdfField: 'form1[0].P6[0].P2_Line18_DateOfBirth[0]',            source: { type: 'answer', key: 'beneficiary_dob' } },
  { pdfField: 'form1[0].P6[0].P2_Line19_CountryOfBirth[0]',         source: { type: 'answer', key: 'beneficiary_country_birth' } },
  { pdfField: 'form1[0].P6[0].P2_Line20_CountryOfCitizenship[0]',   source: { type: 'answer', key: 'beneficiary_country_citizenship' } },
];

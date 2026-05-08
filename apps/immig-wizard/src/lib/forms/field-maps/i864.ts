import type { FieldMapping } from '../types';

// I-864: Affidavit of Support Under Section 213A of the INA
// Sponsor = petitioner (the US citizen)
// Immigrant = beneficiary
export const i864Fields: FieldMapping[] = [
  // ── Part 2: Information About the Sponsor ───────────────────────────────
  { pdfField: 'form1[0].#subform[2].P2_Line1a_FamilyName[0]', source: { type: 'answer', key: 'petitioner_last_name' }, required: { label: 'Sponsor family name', stepId: 2 } },
  { pdfField: 'form1[0].#subform[2].P2_Line1b_GivenName[0]',  source: { type: 'answer', key: 'petitioner_first_name' }, required: { label: 'Sponsor given name', stepId: 2 } },
  { pdfField: 'form1[0].#subform[2].P2_Line1c_MiddleName[0]', source: { type: 'answer', key: 'petitioner_middle_name' } },
  { pdfField: 'form1[0].#subform[2].P2_Line2_StreetNumberName[0]', source: { type: 'address', key: 'petitioner_mailing_address', part: 'street' }, required: { label: 'Sponsor mailing street address', stepId: 2 } },
  { pdfField: 'form1[0].#subform[2].P2_Line2_CityOrTown[0]',       source: { type: 'address', key: 'petitioner_mailing_address', part: 'city' } },
  { pdfField: 'form1[0].#subform[2].P2_Line2_State[0]',            source: { type: 'address', key: 'petitioner_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].#subform[2].P2_Line2_ZipCode[0]',          source: { type: 'address', key: 'petitioner_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].#subform[2].P2_Line2_Country[0]',          source: { type: 'address', key: 'petitioner_mailing_address', part: 'country' } },
  { pdfField: 'form1[0].#subform[2].P2_Line7_DaytimePhoneNumber[0]', source: { type: 'answer', key: 'petitioner_phone' }, required: { label: 'Sponsor phone number', stepId: 2 } },
  // SSN
  { pdfField: 'form1[0].Page2[0].Line12b_SSN[0]', source: { type: 'answer', key: 'petitioner_ssn' }, required: { label: 'Sponsor SSN', stepId: 2 } },
  // ── Part 3: Immigrant info ───────────────────────────────────────────────
  { pdfField: 'form1[0].#subform[2].P3_Line3a_FamilyName[0]', source: { type: 'answer', key: 'beneficiary_last_name' } },
  { pdfField: 'form1[0].#subform[2].P3_Line3b_GivenName[0]',  source: { type: 'answer', key: 'beneficiary_first_name' } },
  { pdfField: 'form1[0].#subform[2].P3_Line3c_MiddleName[0]', source: { type: 'answer', key: 'beneficiary_middle_name' } },
  // ── Part 4: The Immigrant's Principal Sponsor (for self-filing petitioners) ──
  { pdfField: 'form1[0].#subform[0].P4_Line1a_FamilyName[0]', source: { type: 'answer', key: 'petitioner_last_name' } },
  { pdfField: 'form1[0].#subform[0].P4_Line1b_GivenName[0]',  source: { type: 'answer', key: 'petitioner_first_name' } },
  { pdfField: 'form1[0].#subform[0].P4_Line1c_MiddleName[0]', source: { type: 'answer', key: 'petitioner_middle_name' } },
  { pdfField: 'form1[0].#subform[1].P4_Line2b_StreetNumberName[0]', source: { type: 'address', key: 'petitioner_mailing_address', part: 'street' } },
  { pdfField: 'form1[0].#subform[1].P4_Line2e_CityOrTown[0]',       source: { type: 'address', key: 'petitioner_mailing_address', part: 'city' } },
  { pdfField: 'form1[0].#subform[1].P4_Line2f_State[0]',            source: { type: 'address', key: 'petitioner_mailing_address', part: 'state' } },
  { pdfField: 'form1[0].#subform[1].P4_Line2g_ZipCode[0]',          source: { type: 'address', key: 'petitioner_mailing_address', part: 'zip' } },
  { pdfField: 'form1[0].#subform[1].P4_Line2j_Country[0]',          source: { type: 'address', key: 'petitioner_mailing_address', part: 'country' } },
  { pdfField: 'form1[0].#subform[1].P4_Line6_DateOfBirth[0]',       source: { type: 'answer', key: 'petitioner_dob' } },
  { pdfField: 'form1[0].#subform[2].P2_Line4_DateOfBirth[0]',       source: { type: 'answer', key: 'petitioner_dob' } },
  // ── Part 5: Household size ───────────────────────────────────────────────
  { pdfField: 'form1[0].#subform[4].P5_Line2_Yourself[0]',          source: { type: 'constant', value: '1' } },
  { pdfField: 'form1[0].#subform[4].P5_Line6_Sponsors[0]',          source: { type: 'answer', key: 'sponsor_household_size' }, required: { label: 'Sponsor household size', stepId: 6 } },
  // ── Part 6: Sponsor's income ─────────────────────────────────────────────
  { pdfField: 'form1[0].#subform[4].P6_Line1a_NameofEmployer[0]',   source: { type: 'answer', key: 'petitioner_employer' }, required: { label: 'Sponsor employer name', stepId: 6, requiredWhen: (answers) => answers['petitioner_employment_status'] === 'Employed' || answers['petitioner_employment_status'] === 'Self-employed' } },
  { pdfField: 'form1[0].#subform[4].P6_Line2_TotalIncome[0]',       source: { type: 'answer', key: 'sponsor_total_income' }, required: { label: 'Sponsor most recent tax return total income', stepId: 6 } },
  { pdfField: 'form1[0].#subform[5].P6_Line15_TotalHouseholdIncome[0]', source: { type: 'answer', key: 'petitioner_annual_income' }, required: { label: 'Sponsor current annual income', stepId: 6 } },
];

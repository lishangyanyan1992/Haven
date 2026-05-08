import type { FieldMapping } from '../types';

// I-485: Application to Register Permanent Residence or Adjust Status
// Applicant = beneficiary (the immigrant spouse)
export const i485Fields: FieldMapping[] = [
  // ── Part 1: Applicant info ──────────────────────────────────────────────
  {
    pdfField: 'form1[0].#subform[0].Pt1Line1_FamilyName[0]',
    source: { type: 'answer', key: 'beneficiary_last_name' },
    required: { label: 'Beneficiary family name', stepId: 3 },
  },
  {
    pdfField: 'form1[0].#subform[0].Pt1Line1_GivenName[0]',
    source: { type: 'answer', key: 'beneficiary_first_name' },
    required: { label: 'Beneficiary given name', stepId: 3 },
  },
  { pdfField: 'form1[0].#subform[0].Pt1Line1_MiddleName[0]',  source: { type: 'answer', key: 'beneficiary_middle_name' } },
  { pdfField: 'form1[0].#subform[0].AlienNumber[0]',          source: { type: 'answer', key: 'beneficiary_anumber' } },
  // Country of birth / citizenship
  {
    pdfField: 'form1[0].#subform[1].Pt1Line7_CountryOfBirth[0]',
    source: { type: 'answer', key: 'beneficiary_country_birth' },
    required: { label: 'Beneficiary country of birth', stepId: 3 },
  },
  // Passport
  {
    pdfField: 'form1[0].#subform[1].Pt1Line10_PassportNum[0]',
    source: { type: 'answer', key: 'beneficiary_passport_number' },
    required: { label: 'Beneficiary passport number', stepId: 3 },
  },
  // Beneficiary SSN (applicant on I-485)
  {
    pdfField: 'form1[0].#subform[3].Pt1Line19_SSN[0]',
    source: { type: 'answer', key: 'beneficiary_ssn' },
    required: {
      label: 'Beneficiary SSN or explicit no-SSN answer',
      stepId: 3,
      requiredWhen: (answers) => answers['beneficiary_ssn_status'] === 'Has SSN',
    },
  },
  // Current US address
  { pdfField: 'form1[0].#subform[2].Pt1Line18_CurrentStreetNumberName[0]', source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.street?.trim() : undefined;
  } }, required: { label: 'Beneficiary current street address', stepId: 3 } },
  { pdfField: 'form1[0].#subform[2].Pt1Line18_CurrentCityOrTown[0]',       source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.city?.trim() : undefined;
  } } },
  { pdfField: 'form1[0].#subform[2].Pt1Line18_CurrentState[0]',            source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.state?.trim() : undefined;
  } } },
  { pdfField: 'form1[0].#subform[2].Pt1Line18_CurrentZipCode[0]',          source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.zip?.trim() : undefined;
  } } },
  // Also fill the StreetNumberName variant
  { pdfField: 'form1[0].#subform[2].Pt1Line18_StreetNumberName[0]',        source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.street?.trim() : undefined;
  } } },
  { pdfField: 'form1[0].#subform[2].Pt1Line18_CityOrTown[0]',              source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.city?.trim() : undefined;
  } } },
  { pdfField: 'form1[0].#subform[2].Pt1Line18_State[0]',                   source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.state?.trim() : undefined;
  } } },
  { pdfField: 'form1[0].#subform[2].Pt1Line18_ZipCode[0]',                 source: { type: 'derived', fn: (a) => {
    const address = a['beneficiary_physical_same_as_mailing'] === 'no'
      ? a['beneficiary_physical_address']
      : a['beneficiary_mailing_address'];
    return typeof address === 'object' && address && !Array.isArray(address) ? address.zip?.trim() : undefined;
  } } },
  // ── Part 2: Basis for eligibility ───────────────────────────────────────
  // Petitioner name (who is sponsoring)
  { pdfField: 'form1[0].#subform[4].Pt2Line2_FamilyName[0]',  source: { type: 'answer', key: 'petitioner_last_name' } },
  { pdfField: 'form1[0].#subform[4].Pt2Line2_GivenName[0]',   source: { type: 'answer', key: 'petitioner_first_name' } },
  { pdfField: 'form1[0].#subform[4].Pt2Line2_MiddleName[0]',  source: { type: 'answer', key: 'petitioner_middle_name' } },
  // ── Part 3: Additional info ──────────────────────────────────────────────
  { pdfField: 'form1[0].#subform[22].Pt3Line3_DaytimePhoneNumber1[0]', source: { type: 'answer', key: 'beneficiary_phone' }, required: { label: 'Beneficiary phone number', stepId: 3 } },
  { pdfField: 'form1[0].#subform[22].Pt3Line5_Email[0]',               source: { type: 'answer', key: 'beneficiary_email' }, required: { label: 'Beneficiary email address', stepId: 3 } },
];

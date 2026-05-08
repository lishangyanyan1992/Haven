import { WizardState, DocumentRequirement } from '@/types/wizard';

const BASE_DOCUMENTS: DocumentRequirement[] = [
  {
    id: 'g1145',
    name: 'Form G-1145: E-Notification of Application/Petition Acceptance',
    description: 'Clip this on top of the packet if you want USCIS text/email acceptance notifications.',
    category: 'always',
    officialLink: 'https://www.uscis.gov/g-1145',
  },
  {
    id: 'i130',
    name: 'Form I-130: Petition for Alien Relative',
    description: 'The foundational petition filed by the US citizen petitioner to establish the qualifying relationship.',
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-130',
  },
  {
    id: 'i130a',
    name: 'Form I-130A: Supplemental Information for Spouse Beneficiary',
    description: 'Additional information form completed by the immigrant spouse (beneficiary).',
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-130a',
  },
  {
    id: 'i485',
    name: 'Form I-485: Application to Register Permanent Residence',
    description: "The main form for the immigrant spouse to adjust status and apply for a green card.",
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-485',
  },
  {
    id: 'i864',
    name: 'Form I-864: Affidavit of Support',
    description: 'Filed by the US citizen petitioner to prove they can financially support the immigrant spouse above the poverty line.',
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-864',
  },
  {
    id: 'i765',
    name: 'Form I-765: Application for Employment Authorization (EAD)',
    description: "Allows the immigrant spouse to work legally in the US while the green card application is pending. Can be filed concurrently with I-485.",
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-765',
  },
  {
    id: 'i131',
    name: 'Form I-131: Application for Travel Document (Advance Parole)',
    description: 'Allows the immigrant spouse to travel outside the US while the I-485 is pending without abandoning the application.',
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-131',
  },
  {
    id: 'i693',
    name: 'Form I-693: Medical Examination and Vaccination Record',
    description: 'Required medical examination completed by a USCIS-designated civil surgeon. Must be submitted in a sealed envelope.',
    category: 'always',
    officialLink: 'https://www.uscis.gov/i-693',
  },
  {
    id: 'marriage_certificate',
    name: 'Marriage Certificate (certified copy)',
    description: 'Official certified copy of your marriage certificate from the issuing government authority. If not in English, include a certified translation.',
    category: 'always',
  },
  {
    id: 'petitioner_citizenship',
    name: "Petitioner's Proof of US Citizenship",
    description: 'US passport, US birth certificate, Naturalization Certificate (N-550), or Certificate of Citizenship (N-560).',
    category: 'always',
  },
  {
    id: 'beneficiary_birth_cert',
    name: "Beneficiary's Birth Certificate (certified copy)",
    description: 'Official birth certificate from the country of birth. Include certified English translation if not in English.',
    category: 'always',
  },
  {
    id: 'petitioner_birth_cert',
    name: "Petitioner's Birth Certificate",
    description: "Certified copy of the petitioner's birth certificate.",
    category: 'always',
  },
  {
    id: 'beneficiary_passport',
    name: "Beneficiary's Passport Copies",
    description: "Copy of the beneficiary's passport bio page, US visa page, and all entry/exit stamps.",
    category: 'always',
  },
  {
    id: 'i94_record',
    name: "Beneficiary's I-94 Arrival/Departure Record",
    description: 'Printed copy from cbp.dhs.gov/i94 showing last entry and authorized stay.',
    category: 'always',
  },
  {
    id: 'passport_photos',
    name: 'Passport Photos (2 per applicant)',
    description: '2" x 2" color photos, white background, taken within the last 6 months. Write name and A-Number (if any) on back in pencil.',
    category: 'always',
  },
  {
    id: 'tax_returns',
    name: "Petitioner's Federal Tax Returns (last 1-3 years)",
    description: 'Required for Form I-864. Include W-2s and all schedules. IRS transcripts are also acceptable.',
    category: 'always',
  },
  {
    id: 'bona_fide_evidence',
    name: 'Evidence of Bona Fide Marriage',
    description: 'Multiple documents showing you share a genuine life together: joint bank accounts, joint lease or mortgage, insurance documents, shared bills, photos together, travel records, correspondence.',
    category: 'always',
  },
];

const CONDITIONAL_DOCUMENTS: Array<DocumentRequirement & { condition: (state: WizardState) => boolean }> = [
  {
    id: 'g1450',
    name: 'Form G-1450: Authorization for Credit Card Transactions',
    description: 'Required only if paying USCIS by credit card. Must be hand-signed after printing.',
    category: 'conditional',
    officialLink: 'https://www.uscis.gov/g-1450',
    condition: (state) => state.answers['payment_method'] === 'Credit card (Form G-1450)',
  },
  {
    id: 'divorce_decrees_petitioner',
    name: "Petitioner's Divorce Decree(s) or Death Certificate(s)",
    description: 'Required to prove all prior marriages have been legally terminated. Include for each prior marriage.',
    category: 'conditional',
    condition: (state) => state.answers['petitioner_prior_marriages'] === 'yes',
  },
  {
    id: 'divorce_decrees_beneficiary',
    name: "Beneficiary's Divorce Decree(s) or Death Certificate(s)",
    description: 'Required to prove all prior marriages have been legally terminated. Include for each prior marriage.',
    category: 'conditional',
    condition: (state) => state.answers['beneficiary_prior_marriages'] === 'yes',
  },
  {
    id: 'i601a',
    name: 'Form I-601A: Provisional Unlawful Presence Waiver (may be needed)',
    description: 'May be required if the beneficiary has accrued unlawful presence in the US. Consult an immigration attorney to determine if this applies.',
    category: 'conditional',
    condition: (state) => state.answers['overstayed'] === 'yes',
  },
  {
    id: 'court_records',
    name: 'Court Records / Police Clearance Certificates',
    description: 'Required for each arrest or charge. Include court disposition documents, official records of dropped charges, or expungement orders.',
    category: 'conditional',
    condition: (state) => state.answers['criminal_arrests'] === 'yes',
  },
  {
    id: 'employment_letter',
    name: "Petitioner's Employment Verification Letter",
    description: 'Letter from employer confirming current employment status and salary. Strengthens the I-864 Affidavit of Support.',
    category: 'conditional',
    condition: (state) => {
      const income = state.answers['petitioner_annual_income'];
      return typeof income === 'string' && parseInt(income) < 30000;
    },
  },
  {
    id: 'joint_sponsor_i864',
    name: 'Form I-864 from Joint Sponsor',
    description: 'If a joint sponsor is being used, that sponsor must complete and sign a separate Form I-864 with supporting evidence.',
    category: 'conditional',
    condition: (state) => state.answers['needs_joint_sponsor'] === 'yes',
  },
  {
    id: 'travel_records',
    name: 'Travel Records / Flight Itineraries',
    description: 'Documentation of trips outside the US in the past 5 years to support the travel history section of Form I-485.',
    category: 'conditional',
    condition: (state) => state.answers['travel_outside_us'] === 'yes',
  },
  {
    id: 'name_change_docs',
    name: "Beneficiary's Name Change Documentation",
    description: "Documents explaining any name changes or aliases used, such as court orders or marriage certificates.",
    category: 'conditional',
    condition: (state) => state.answers['beneficiary_has_aliases'] === 'yes',
  },
  {
    id: 'naturalization_cert',
    name: "Petitioner's Naturalization Certificate (N-550 or N-570)",
    description: 'If the petitioner became a citizen through naturalization, include the original certificate or a certified copy.',
    category: 'conditional',
    condition: (state) => state.answers['petitioner_citizenship_how'] === 'Naturalization',
  },
  {
    id: 'birth_abroad_citizenship',
    name: "Petitioner's FS-240 (Consular Report of Birth Abroad) or Certificate of Citizenship",
    description: 'If the petitioner was born abroad to US citizen parents, provide this document as proof of citizenship.',
    category: 'conditional',
    condition: (state) =>
      state.answers['petitioner_citizenship_how'] === 'Birth abroad to US citizen parent(s)',
  },
];

export function getRequiredDocuments(state: WizardState): {
  always: DocumentRequirement[];
  conditional: DocumentRequirement[];
} {
  const conditionalDocs = CONDITIONAL_DOCUMENTS.filter((doc) => doc.condition(state)).map(
    ({ condition: _condition, ...doc }) => doc
  );

  return {
    always: BASE_DOCUMENTS,
    conditional: conditionalDocs,
  };
}

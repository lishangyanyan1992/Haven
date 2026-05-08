import {
  AddressValue,
  Question,
  RepeaterField,
  RepeaterItemState,
  Step,
  WizardState,
} from '@/types/wizard';

const YES_NO_OPTIONS = ['yes', 'no'] as const;

function sameAddressQuestion(id: string, label: string): Question {
  return {
    id,
    label,
    type: 'yesno',
    required: true,
  };
}

function createHistoryAddressFields(): RepeaterField[] {
  return [
    { key: 'street', label: 'Street address', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'state', label: 'State / Province', type: 'text', required: true },
    { key: 'zip', label: 'ZIP / Postal code', type: 'text', required: false },
    { key: 'country', label: 'Country', type: 'text', required: true, placeholder: 'United States' },
    { key: 'from_date', label: 'From date', type: 'date', required: true },
    {
      key: 'to_date',
      label: 'To date',
      type: 'date',
      required: (item) => item['present'] !== 'yes',
      showIf: (item) => item['present'] !== 'yes',
    },
    { key: 'present', label: 'Do you currently live here?', type: 'yesno', required: true },
  ];
}

export const wizardSteps: Step[] = [
  {
    id: 1,
    title: 'Packet Setup & Eligibility',
    description:
      'Confirm the Adjustment of Status path, choose which packet items you want included, and tell us how you plan to submit the filing.',
    questions: [
      {
        id: 'petitioner_is_citizen',
        label: 'Is the petitioner (the U.S.-based spouse) a U.S. citizen?',
        type: 'yesno',
        required: true,
        hint:
          'This AOS flow is for immediate-relative spouse cases filed by a U.S. citizen petitioner.',
      },
      {
        id: 'currently_married',
        label: 'Are you currently legally married?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'beneficiary_in_us',
        label: 'Is the beneficiary currently inside the United States?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'entered_legally',
        label:
          'Did the beneficiary last enter the United States through inspection/admission or parole?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'g1145_contact_preference',
        label: 'Whose contact information should be used for Form G-1145 e-notifications?',
        type: 'radio',
        required: true,
        options: ['Petitioner', 'Beneficiary'],
      },
      {
        id: 'include_i765',
        label: 'Do you want to include Form I-765 for work authorization?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'include_i131',
        label: 'Do you want to include Form I-131 for advance parole travel permission?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'payment_method',
        label: 'How will you pay the USCIS filing fees?',
        type: 'radio',
        required: true,
        options: ['Credit card (Form G-1450)', 'Check or money order'],
        hint:
          'If you choose credit card, the forms page will require all Form G-1450 payment fields before download.',
      },
      {
        id: 'i693_submission_timing',
        label: 'What is the plan for Form I-693, the sealed medical exam packet?',
        type: 'radio',
        required: true,
        options: [
          'Include sealed I-693 with the initial filing',
          'Bring I-693 later if USCIS asks or at the interview',
          'Civil surgeon exam not scheduled yet',
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Petitioner Profile',
    description:
      'Collect the petitioner’s identity, contact, citizenship, and address information used across the petition and affidavit of support.',
    questions: [
      { id: 'petitioner_first_name', label: 'Petitioner given name (first name)', type: 'text', required: true },
      { id: 'petitioner_middle_name', label: 'Petitioner middle name', type: 'text', required: false },
      { id: 'petitioner_last_name', label: 'Petitioner family name (last name)', type: 'text', required: true },
      {
        id: 'petitioner_has_aliases',
        label: 'Has the petitioner used any other legal names?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'petitioner_aliases',
        label: 'Petitioner prior legal names',
        type: 'repeater',
        required: (state) => state.answers['petitioner_has_aliases'] === 'yes',
        showIf: (state) => state.answers['petitioner_has_aliases'] === 'yes',
        itemLabel: 'prior name',
        addButtonLabel: 'Add another name',
        minItems: 1,
        fields: [
          { key: 'given_name', label: 'Given name', type: 'text', required: true },
          { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
          { key: 'family_name', label: 'Family name', type: 'text', required: true },
          { key: 'used_until', label: 'Used until (optional)', type: 'date', required: false },
        ],
      },
      { id: 'petitioner_dob', label: 'Petitioner date of birth', type: 'date', required: true },
      {
        id: 'petitioner_sex',
        label: 'Petitioner sex',
        type: 'radio',
        required: true,
        options: ['Male', 'Female'],
      },
      { id: 'petitioner_city_birth', label: 'Petitioner city or town of birth', type: 'text', required: true },
      { id: 'petitioner_country_birth', label: 'Petitioner country of birth', type: 'text', required: true },
      {
        id: 'petitioner_citizenship_how',
        label: 'How did the petitioner become a U.S. citizen?',
        type: 'select',
        required: true,
        options: [
          'Birth in the United States',
          'Birth abroad to U.S. citizen parent(s)',
          'Naturalization',
          'Derived citizenship through parent',
        ],
      },
      {
        id: 'petitioner_ssn',
        label: 'Petitioner Social Security Number (SSN)',
        type: 'text',
        required: true,
        placeholder: 'XXX-XX-XXXX',
        hint: 'Required for the sponsoring spouse’s Form I-864.',
      },
      {
        id: 'petitioner_has_anumber',
        label: 'Does the petitioner have an A-Number?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'petitioner_anumber',
        label: 'Petitioner A-Number',
        type: 'text',
        required: (state) => state.answers['petitioner_has_anumber'] === 'yes',
        showIf: (state) => state.answers['petitioner_has_anumber'] === 'yes',
      },
      {
        id: 'petitioner_has_uscis_account',
        label: 'Does the petitioner have a USCIS online account number?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'petitioner_uscis_online_account_number',
        label: 'Petitioner USCIS online account number',
        type: 'text',
        required: (state) => state.answers['petitioner_has_uscis_account'] === 'yes',
        showIf: (state) => state.answers['petitioner_has_uscis_account'] === 'yes',
      },
      { id: 'petitioner_phone', label: 'Petitioner daytime phone number', type: 'text', required: true },
      { id: 'petitioner_email', label: 'Petitioner email address', type: 'text', required: true },
      {
        id: 'petitioner_mailing_address',
        label: 'Petitioner mailing address',
        type: 'address',
        required: true,
      },
      sameAddressQuestion(
        'petitioner_physical_same_as_mailing',
        'Is the petitioner’s physical address the same as the mailing address?'
      ),
      {
        id: 'petitioner_physical_address',
        label: 'Petitioner physical address',
        type: 'address',
        required: (state) => state.answers['petitioner_physical_same_as_mailing'] === 'no',
        showIf: (state) => state.answers['petitioner_physical_same_as_mailing'] === 'no',
      },
    ],
  },
  {
    id: 3,
    title: 'Beneficiary Profile',
    description:
      'Collect the beneficiary’s personal, passport, identifier, and address information used across the adjustment packet.',
    questions: [
      { id: 'beneficiary_first_name', label: 'Beneficiary given name (first name)', type: 'text', required: true },
      { id: 'beneficiary_middle_name', label: 'Beneficiary middle name', type: 'text', required: false },
      { id: 'beneficiary_last_name', label: 'Beneficiary family name (last name)', type: 'text', required: true },
      {
        id: 'beneficiary_has_aliases',
        label: 'Has the beneficiary used any other legal names?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'beneficiary_aliases',
        label: 'Beneficiary prior legal names',
        type: 'repeater',
        required: (state) => state.answers['beneficiary_has_aliases'] === 'yes',
        showIf: (state) => state.answers['beneficiary_has_aliases'] === 'yes',
        itemLabel: 'prior name',
        addButtonLabel: 'Add another name',
        minItems: 1,
        fields: [
          { key: 'given_name', label: 'Given name', type: 'text', required: true },
          { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
          { key: 'family_name', label: 'Family name', type: 'text', required: true },
          { key: 'used_until', label: 'Used until (optional)', type: 'date', required: false },
        ],
      },
      { id: 'beneficiary_dob', label: 'Beneficiary date of birth', type: 'date', required: true },
      {
        id: 'beneficiary_sex',
        label: 'Beneficiary sex',
        type: 'radio',
        required: true,
        options: ['Male', 'Female'],
      },
      { id: 'beneficiary_city_birth', label: 'Beneficiary city or town of birth', type: 'text', required: true },
      { id: 'beneficiary_country_birth', label: 'Beneficiary country of birth', type: 'text', required: true },
      {
        id: 'beneficiary_country_citizenship',
        label: 'Beneficiary country of citizenship / nationality',
        type: 'text',
        required: true,
      },
      {
        id: 'beneficiary_ssn_status',
        label: 'Does the beneficiary already have a Social Security Number?',
        type: 'radio',
        required: true,
        options: ['Has SSN', 'Does not have SSN yet'],
      },
      {
        id: 'beneficiary_ssn',
        label: 'Beneficiary Social Security Number (SSN)',
        type: 'text',
        required: (state) => state.answers['beneficiary_ssn_status'] === 'Has SSN',
        showIf: (state) => state.answers['beneficiary_ssn_status'] === 'Has SSN',
        placeholder: 'XXX-XX-XXXX',
      },
      {
        id: 'beneficiary_has_anumber',
        label: 'Does the beneficiary have an A-Number?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'beneficiary_anumber',
        label: 'Beneficiary A-Number',
        type: 'text',
        required: (state) => state.answers['beneficiary_has_anumber'] === 'yes',
        showIf: (state) => state.answers['beneficiary_has_anumber'] === 'yes',
      },
      {
        id: 'beneficiary_has_uscis_account',
        label: 'Does the beneficiary have a USCIS online account number?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'beneficiary_uscis_online_account_number',
        label: 'Beneficiary USCIS online account number',
        type: 'text',
        required: (state) => state.answers['beneficiary_has_uscis_account'] === 'yes',
        showIf: (state) => state.answers['beneficiary_has_uscis_account'] === 'yes',
      },
      { id: 'beneficiary_passport_number', label: 'Beneficiary passport number', type: 'text', required: true },
      { id: 'beneficiary_passport_country', label: 'Passport country of issuance', type: 'text', required: true },
      { id: 'beneficiary_passport_expiry', label: 'Passport expiration date', type: 'date', required: true },
      { id: 'beneficiary_phone', label: 'Beneficiary daytime phone number', type: 'text', required: true },
      { id: 'beneficiary_email', label: 'Beneficiary email address', type: 'text', required: true },
      {
        id: 'beneficiary_mailing_address',
        label: 'Beneficiary mailing address',
        type: 'address',
        required: true,
      },
      sameAddressQuestion(
        'beneficiary_physical_same_as_mailing',
        'Is the beneficiary’s physical address the same as the mailing address?'
      ),
      {
        id: 'beneficiary_physical_address',
        label: 'Beneficiary physical address',
        type: 'address',
        required: (state) => state.answers['beneficiary_physical_same_as_mailing'] === 'no',
        showIf: (state) => state.answers['beneficiary_physical_same_as_mailing'] === 'no',
      },
    ],
  },
  {
    id: 4,
    title: 'Relationship & Family',
    description:
      'Capture the marriage details, prior marriages, children, and beneficiary parent information used across the packet.',
    questions: [
      { id: 'marriage_date', label: 'Date of marriage', type: 'date', required: true },
      { id: 'marriage_city', label: 'City where you were married', type: 'text', required: true },
      { id: 'marriage_state', label: 'State or province where you were married', type: 'text', required: true },
      { id: 'marriage_country', label: 'Country where you were married', type: 'text', required: true },
      {
        id: 'petitioner_prior_marriages',
        label: 'Has the petitioner been previously married?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'petitioner_prior_marriages_list',
        label: 'Petitioner prior marriages',
        type: 'repeater',
        required: (state) => state.answers['petitioner_prior_marriages'] === 'yes',
        showIf: (state) => state.answers['petitioner_prior_marriages'] === 'yes',
        itemLabel: 'prior marriage',
        addButtonLabel: 'Add prior marriage',
        minItems: 1,
        fields: [
          { key: 'spouse_name', label: 'Prior spouse full name', type: 'text', required: true },
          { key: 'marriage_date', label: 'Marriage date', type: 'date', required: false },
          { key: 'ended_date', label: 'Date marriage ended', type: 'date', required: true },
          {
            key: 'ended_reason',
            label: 'How did this marriage end?',
            type: 'select',
            required: true,
            options: ['Divorce', 'Death of spouse', 'Annulment', 'Other'],
          },
        ],
      },
      {
        id: 'beneficiary_prior_marriages',
        label: 'Has the beneficiary been previously married?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'beneficiary_prior_marriages_list',
        label: 'Beneficiary prior marriages',
        type: 'repeater',
        required: (state) => state.answers['beneficiary_prior_marriages'] === 'yes',
        showIf: (state) => state.answers['beneficiary_prior_marriages'] === 'yes',
        itemLabel: 'prior marriage',
        addButtonLabel: 'Add prior marriage',
        minItems: 1,
        fields: [
          { key: 'spouse_name', label: 'Prior spouse full name', type: 'text', required: true },
          { key: 'marriage_date', label: 'Marriage date', type: 'date', required: false },
          { key: 'ended_date', label: 'Date marriage ended', type: 'date', required: true },
          {
            key: 'ended_reason',
            label: 'How did this marriage end?',
            type: 'select',
            required: true,
            options: ['Divorce', 'Death of spouse', 'Annulment', 'Other'],
          },
        ],
      },
      {
        id: 'has_children',
        label: 'Does either spouse have any children who must be disclosed on the packet?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'children_list',
        label: 'Children to list in the packet',
        type: 'repeater',
        required: (state) => state.answers['has_children'] === 'yes',
        showIf: (state) => state.answers['has_children'] === 'yes',
        itemLabel: 'child',
        addButtonLabel: 'Add child',
        minItems: 1,
        fields: [
          { key: 'given_name', label: 'Given name', type: 'text', required: true },
          { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
          { key: 'family_name', label: 'Family name', type: 'text', required: true },
          { key: 'dob', label: 'Date of birth', type: 'date', required: true },
          { key: 'country_birth', label: 'Country of birth', type: 'text', required: true },
          {
            key: 'relationship',
            label: 'Relationship to the couple',
            type: 'select',
            required: true,
            options: ['Child of petitioner', 'Child of beneficiary', 'Child of both spouses'],
          },
        ],
      },
      {
        id: 'beneficiary_parents_list',
        label: 'Beneficiary parents',
        type: 'repeater',
        required: true,
        itemLabel: 'parent',
        addButtonLabel: 'Add parent',
        minItems: 2,
        fields: [
          {
            key: 'relationship',
            label: 'Parent type',
            type: 'select',
            required: true,
            options: ['Mother', 'Father', 'Parent'],
          },
          { key: 'given_name', label: 'Given name', type: 'text', required: true },
          { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
          { key: 'family_name', label: 'Family name', type: 'text', required: true },
          { key: 'dob', label: 'Date of birth (if known)', type: 'date', required: false },
          { key: 'country_birth', label: 'Country of birth', type: 'text', required: false },
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'Beneficiary Address History',
    description:
      'List every address the beneficiary has used during the last five years, newest to oldest, without gaps.',
    questions: [
      {
        id: 'beneficiary_address_history',
        label: 'Beneficiary five-year address history',
        type: 'repeater',
        required: true,
        itemLabel: 'address history entry',
        addButtonLabel: 'Add address history entry',
        minItems: 1,
        hint: 'USCIS asks for five years of address history. Include the current address first.',
        fields: createHistoryAddressFields(),
      },
    ],
  },
  {
    id: 6,
    title: 'Employment & Sponsor Finances',
    description:
      'Collect the beneficiary’s five-year work history and the sponsoring spouse’s financial information for Form I-864.',
    questions: [
      {
        id: 'beneficiary_employment_history',
        label: 'Beneficiary five-year employment history',
        type: 'repeater',
        required: true,
        itemLabel: 'employment entry',
        addButtonLabel: 'Add employment entry',
        minItems: 1,
        hint:
          'Include employment, self-employment, unemployment, homemaker, student, or retired periods so there are no unexplained gaps.',
        fields: [
          { key: 'employer_name', label: 'Employer / school / status name', type: 'text', required: true },
          { key: 'occupation', label: 'Occupation or status', type: 'text', required: true },
          { key: 'city', label: 'City', type: 'text', required: true },
          { key: 'country', label: 'Country', type: 'text', required: true },
          { key: 'from_date', label: 'From date', type: 'date', required: true },
          {
            key: 'to_date',
            label: 'To date',
            type: 'date',
            required: (item) => item['present'] !== 'yes',
            showIf: (item) => item['present'] !== 'yes',
          },
          { key: 'present', label: 'Is this current?', type: 'yesno', required: true },
        ],
      },
      {
        id: 'petitioner_employment_status',
        label: 'Petitioner current employment status',
        type: 'select',
        required: true,
        options: ['Employed', 'Self-employed', 'Unemployed', 'Retired'],
      },
      {
        id: 'petitioner_employer',
        label: 'Petitioner current employer or business name',
        type: 'text',
        required: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
        showIf: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
      },
      {
        id: 'petitioner_job_title',
        label: 'Petitioner job title / occupation',
        type: 'text',
        required: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
        showIf: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
      },
      {
        id: 'petitioner_employment_start_date',
        label: 'Petitioner employment start date',
        type: 'date',
        required: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
        showIf: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
      },
      {
        id: 'petitioner_employer_address',
        label: 'Petitioner employer or business address',
        type: 'address',
        required: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
        showIf: (state) =>
          state.answers['petitioner_employment_status'] === 'Employed' ||
          state.answers['petitioner_employment_status'] === 'Self-employed',
      },
      {
        id: 'petitioner_annual_income',
        label: 'Petitioner current annual income in USD',
        type: 'text',
        required: true,
        placeholder: 'e.g. 68000',
      },
      {
        id: 'sponsor_household_size',
        label: 'Total household size for Form I-864',
        type: 'number',
        required: true,
        hint:
          'Include the petitioner, beneficiary, all dependents, and anyone else the sponsor must count on Form I-864.',
      },
      {
        id: 'sponsor_recent_tax_year',
        label: 'Most recent federal tax year available for the sponsor',
        type: 'text',
        required: true,
        placeholder: 'e.g. 2025',
      },
      {
        id: 'sponsor_total_income',
        label: 'Total income from the most recent tax return in USD',
        type: 'text',
        required: true,
      },
      {
        id: 'sponsor_tax_filed',
        label: 'Has the sponsor filed the most recent federal tax return?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'sponsor_has_assets',
        label: 'Will the sponsor rely on assets in addition to income?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'sponsor_assets_amount',
        label: 'Total cash value of sponsor assets in USD',
        type: 'text',
        required: (state) => state.answers['sponsor_has_assets'] === 'yes',
        showIf: (state) => state.answers['sponsor_has_assets'] === 'yes',
      },
      {
        id: 'needs_joint_sponsor',
        label: 'Will you use a joint sponsor for this packet?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'joint_sponsors',
        label: 'Joint sponsor details',
        type: 'repeater',
        required: (state) => state.answers['needs_joint_sponsor'] === 'yes',
        showIf: (state) => state.answers['needs_joint_sponsor'] === 'yes',
        itemLabel: 'joint sponsor',
        addButtonLabel: 'Add joint sponsor',
        minItems: 1,
        fields: [
          { key: 'given_name', label: 'Given name', type: 'text', required: true },
          { key: 'middle_name', label: 'Middle name', type: 'text', required: false },
          { key: 'family_name', label: 'Family name', type: 'text', required: true },
          { key: 'relationship', label: 'Relationship to petitioner/beneficiary', type: 'text', required: true },
          { key: 'ssn', label: 'SSN', type: 'text', required: true },
          { key: 'current_income', label: 'Current annual income in USD', type: 'text', required: true },
          { key: 'street', label: 'Street address', type: 'text', required: true },
          { key: 'city', label: 'City', type: 'text', required: true },
          { key: 'state', label: 'State', type: 'text', required: true },
          { key: 'zip', label: 'ZIP code', type: 'text', required: false },
          { key: 'country', label: 'Country', type: 'text', required: true },
        ],
      },
    ],
  },
  {
    id: 7,
    title: 'Immigration History',
    description:
      'Capture the beneficiary’s most recent admission, current status, prior filings, and any status issues that affect the adjustment packet.',
    questions: [
      {
        id: 'current_visa_type',
        label: 'Beneficiary current or last admitted class of admission',
        type: 'select',
        required: true,
        options: [
          'F-1 (Student)',
          'J-1 (Exchange Visitor)',
          'H-1B (Specialty Occupation)',
          'H-4 (Dependent of H-1B)',
          'L-1 (Intracompany Transfer)',
          'L-2 (Dependent of L-1)',
          'O-1 (Extraordinary Ability)',
          'B-1/B-2 (Visitor / Tourist)',
          'TN (USMCA Professional)',
          'E-2 (Treaty Investor)',
          'K-1 (Fiancé)',
          'Visa Waiver Program (ESTA)',
          'Paroled into the United States',
          'Other',
        ],
      },
      { id: 'i94_number', label: 'I-94 arrival/departure record number', type: 'text', required: true },
      { id: 'last_entry_date', label: 'Date of most recent entry to the United States', type: 'date', required: true },
      { id: 'last_entry_port', label: 'Port of entry', type: 'text', required: true },
      {
        id: 'authorized_until',
        label: 'Current authorized stay expiration date',
        type: 'date',
        required: (state) => state.answers['status_d_s'] !== 'yes',
        showIf: (state) => state.answers['status_d_s'] !== 'yes',
      },
      {
        id: 'status_d_s',
        label: 'Does the I-94 show D/S (duration of status) instead of a date?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'prior_entries',
        label: 'Other prior U.S. entries to disclose',
        type: 'repeater',
        required: false,
        itemLabel: 'entry',
        addButtonLabel: 'Add prior entry',
        fields: [
          { key: 'entry_date', label: 'Entry date', type: 'date', required: true },
          { key: 'port', label: 'Port of entry', type: 'text', required: true },
          { key: 'class_of_admission', label: 'Class of admission', type: 'text', required: true },
        ],
      },
      {
        id: 'overstayed',
        label: 'Has the beneficiary ever overstayed, violated status, or been out of status?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'overstay_details',
        label: 'Describe the out-of-status situation',
        type: 'textarea',
        required: (state) => state.answers['overstayed'] === 'yes',
        showIf: (state) => state.answers['overstayed'] === 'yes',
      },
      {
        id: 'unauthorized_employment',
        label: 'Has the beneficiary ever worked in the U.S. without authorization?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'unauthorized_employment_details',
        label: 'Describe the unauthorized employment',
        type: 'textarea',
        required: (state) => state.answers['unauthorized_employment'] === 'yes',
        showIf: (state) => state.answers['unauthorized_employment'] === 'yes',
      },
      {
        id: 'prior_uscis_filings',
        label: 'Has the beneficiary filed any prior USCIS applications or petitions?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'prior_uscis_filings_list',
        label: 'Prior USCIS filings',
        type: 'repeater',
        required: (state) => state.answers['prior_uscis_filings'] === 'yes',
        showIf: (state) => state.answers['prior_uscis_filings'] === 'yes',
        itemLabel: 'filing',
        addButtonLabel: 'Add prior filing',
        minItems: 1,
        fields: [
          { key: 'form_number', label: 'Form number', type: 'text', required: true },
          { key: 'filing_date', label: 'Filing date', type: 'date', required: false },
          { key: 'outcome', label: 'Outcome / current status', type: 'text', required: true },
        ],
      },
      {
        id: 'deported_or_removed',
        label: 'Has the beneficiary ever been removed, deported, or granted voluntary departure?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'deported_details',
        label: 'Describe the removal or voluntary departure history',
        type: 'textarea',
        required: (state) => state.answers['deported_or_removed'] === 'yes',
        showIf: (state) => state.answers['deported_or_removed'] === 'yes',
      },
      {
        id: 'removal_proceedings',
        label: 'Has the beneficiary ever been placed in immigration court proceedings?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'removal_proceedings_details',
        label: 'Describe the immigration court proceedings',
        type: 'textarea',
        required: (state) => state.answers['removal_proceedings'] === 'yes',
        showIf: (state) => state.answers['removal_proceedings'] === 'yes',
      },
    ],
  },
  {
    id: 8,
    title: 'Travel & Optional Benefits',
    description:
      'List trips outside the U.S. and capture any extra information needed only if you are filing Forms I-765 and I-131.',
    questions: [
      {
        id: 'travel_outside_us',
        label: 'Has the beneficiary traveled outside the United States during the last five years?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'travel_history',
        label: 'Trips outside the United States in the last five years',
        type: 'repeater',
        required: (state) => state.answers['travel_outside_us'] === 'yes',
        showIf: (state) => state.answers['travel_outside_us'] === 'yes',
        itemLabel: 'trip',
        addButtonLabel: 'Add trip',
        minItems: 1,
        fields: [
          { key: 'destination', label: 'Destination country', type: 'text', required: true },
          { key: 'departure_date', label: 'Departure date', type: 'date', required: true },
          { key: 'return_date', label: 'Return date', type: 'date', required: true },
        ],
      },
      {
        id: 'i765_has_prior_ead',
        label: 'Has the beneficiary ever had an employment authorization document (EAD)?',
        type: 'yesno',
        required: (state) => state.answers['include_i765'] === 'yes',
        showIf: (state) => state.answers['include_i765'] === 'yes',
      },
      {
        id: 'i765_prior_ead_details',
        label: 'Describe the prior EAD(s), if any',
        type: 'textarea',
        required: (state) =>
          state.answers['include_i765'] === 'yes' && state.answers['i765_has_prior_ead'] === 'yes',
        showIf: (state) =>
          state.answers['include_i765'] === 'yes' && state.answers['i765_has_prior_ead'] === 'yes',
      },
      {
        id: 'i765_wants_ssn_card',
        label: 'If approved for work authorization, should SSA issue or replace the beneficiary’s Social Security card?',
        type: 'yesno',
        required: (state) =>
          state.answers['include_i765'] === 'yes' &&
          state.answers['beneficiary_ssn_status'] === 'Does not have SSN yet',
        showIf: (state) =>
          state.answers['include_i765'] === 'yes' &&
          state.answers['beneficiary_ssn_status'] === 'Does not have SSN yet',
      },
      {
        id: 'i131_trip_purpose',
        label: 'What is the intended purpose of the advance parole travel?',
        type: 'textarea',
        required: (state) => state.answers['include_i131'] === 'yes',
        showIf: (state) => state.answers['include_i131'] === 'yes',
      },
      {
        id: 'i131_countries_to_visit',
        label: 'Which countries does the beneficiary expect to visit with advance parole?',
        type: 'text',
        required: (state) => state.answers['include_i131'] === 'yes',
        showIf: (state) => state.answers['include_i131'] === 'yes',
      },
      {
        id: 'i131_trip_length_days',
        label: 'Expected longest trip length in days',
        type: 'number',
        required: (state) => state.answers['include_i131'] === 'yes',
        showIf: (state) => state.answers['include_i131'] === 'yes',
      },
      {
        id: 'i131_expected_departure_date',
        label: 'Estimated first departure date',
        type: 'date',
        required: false,
        showIf: (state) => state.answers['include_i131'] === 'yes',
      },
      {
        id: 'i131_has_prior_travel_document',
        label: 'Has the beneficiary ever received advance parole or a re-entry/travel document before?',
        type: 'yesno',
        required: (state) => state.answers['include_i131'] === 'yes',
        showIf: (state) => state.answers['include_i131'] === 'yes',
      },
      {
        id: 'i131_prior_travel_document_details',
        label: 'Describe the prior travel document(s)',
        type: 'textarea',
        required: (state) =>
          state.answers['include_i131'] === 'yes' &&
          state.answers['i131_has_prior_travel_document'] === 'yes',
        showIf: (state) =>
          state.answers['include_i131'] === 'yes' &&
          state.answers['i131_has_prior_travel_document'] === 'yes',
      },
    ],
  },
  {
    id: 9,
    title: 'Background & Admissibility',
    description:
      'Answer the standard USCIS eligibility and inadmissibility questions used for Form I-485.',
    questions: [
      {
        id: 'criminal_arrests',
        label: 'Has the beneficiary ever been arrested, cited, charged, or convicted?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'criminal_details',
        label: 'Describe each arrest, charge, or conviction',
        type: 'textarea',
        required: (state) => state.answers['criminal_arrests'] === 'yes',
        showIf: (state) => state.answers['criminal_arrests'] === 'yes',
      },
      {
        id: 'drug_use',
        label: 'Has the beneficiary ever been a drug abuser or addict?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'health_conditions',
        label: 'Does the beneficiary have any communicable disease or medical issue that should be flagged for the civil surgeon exam?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'immigration_fraud',
        label: 'Has the beneficiary ever made a false claim to U.S. citizenship or committed immigration fraud/misrepresentation?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'polygamy',
        label: 'Is either spouse currently in a polygamous marriage?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'terrorist_activity',
        label: 'Has the beneficiary ever engaged in, assisted, or supported terrorist activity?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'public_charge_concern',
        label: 'Has the beneficiary received public benefits that may need explanation?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'public_benefits_details',
        label: 'Describe the public benefits history',
        type: 'textarea',
        required: (state) => state.answers['public_charge_concern'] === 'yes',
        showIf: (state) => state.answers['public_charge_concern'] === 'yes',
      },
    ],
  },
  {
    id: 10,
    title: 'Documents & Medical Packet',
    description:
      'Confirm which supporting documents you already have and the current status of the sealed medical packet.',
    questions: [
      {
        id: 'has_marriage_certificate',
        label: 'Do you already have the certified marriage certificate?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_birth_certificates',
        label: 'Do you have the birth certificates needed for the packet?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_passport_photos',
        label: 'Do you have the passport-style photos needed for the packet?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_beneficiary_passport',
        label: 'Do you have the beneficiary passport biographic page and visa/entry copies?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_i94',
        label: 'Do you have the beneficiary’s I-94 record?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_petitioner_citizenship_evidence',
        label: 'Do you have proof of the petitioner’s U.S. citizenship?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_tax_returns',
        label: 'Do you have the sponsor’s most recent federal tax return or IRS transcript?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'has_joint_evidence',
        label: 'Do you have bona fide marriage evidence to include with the filing?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'i693_exam_completed',
        label: 'Has the beneficiary completed the civil surgeon medical exam yet?',
        type: 'yesno',
        required: true,
      },
      {
        id: 'i693_exam_date',
        label: 'Date of civil surgeon exam',
        type: 'date',
        required: false,
        showIf: (state) => state.answers['i693_exam_completed'] === 'yes',
      },
      {
        id: 'i693_envelope_ready',
        label: 'Is the sealed I-693 envelope already in hand?',
        type: 'yesno',
        required: (state) => state.answers['i693_exam_completed'] === 'yes',
        showIf: (state) => state.answers['i693_exam_completed'] === 'yes',
      },
      {
        id: 'beneficiary_vaccination_records_available',
        label: 'Does the beneficiary have vaccination records ready for the civil surgeon?',
        type: 'yesno',
        required: true,
      },
    ],
  },
  {
    id: 11,
    title: 'Review & Notes',
    description:
      'Final notes before the summary. You can still go back and edit any section before downloading forms.',
    questions: [
      {
        id: 'attorney_confirmed',
        label: 'Have you consulted or do you plan to consult an immigration attorney?',
        type: 'yesno',
        required: false,
      },
      {
        id: 'ready_to_file',
        label: 'Are you ready to prepare the packet for filing?',
        type: 'yesno',
        required: false,
      },
      {
        id: 'additional_notes',
        label: 'Additional notes or unusual facts to remember',
        type: 'textarea',
        required: false,
      },
    ],
  },
];

export const TOTAL_STEPS = wizardSteps.length;

export function getStep(stepId: number): Step | undefined {
  return wizardSteps.find((s) => s.id === stepId);
}

export function getVisibleQuestions(step: Step, state: WizardState): Question[] {
  return step.questions.filter((q) => !q.showIf || q.showIf(state));
}

export function isQuestionRequired(question: Question, state: WizardState): boolean {
  if (typeof question.required === 'function') {
    return question.required(state);
  }
  return Boolean(question.required);
}

export function isRepeaterFieldVisible(
  field: RepeaterField,
  item: RepeaterItemState,
  state: WizardState
): boolean {
  return !field.showIf || field.showIf(item, state);
}

export function isRepeaterFieldRequired(
  field: RepeaterField,
  item: RepeaterItemState,
  state: WizardState
): boolean {
  if (!isRepeaterFieldVisible(field, item, state)) {
    return false;
  }
  if (typeof field.required === 'function') {
    return field.required(item, state);
  }
  return Boolean(field.required);
}

export function createEmptyAddress(): AddressValue {
  return {
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
  };
}

export function createEmptyRepeaterItem(question: Question): RepeaterItemState {
  const item: RepeaterItemState = {};
  for (const field of question.fields ?? []) {
    item[field.key] = field.type === 'address' ? createEmptyAddress() : '';
  }
  return item;
}

function hasAddressValue(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const address = value as AddressValue;
  return Boolean(address.street?.trim() && address.city?.trim() && address.state?.trim() && address.country?.trim());
}

function hasScalarValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  return false;
}

function repeaterQuestionHasRequiredValues(question: Question, items: RepeaterItemState[], state: WizardState): boolean {
  if (!Array.isArray(items)) return false;
  const minItems = question.minItems ?? 0;
  if (minItems > 0 && items.length < minItems) return false;
  if (items.length === 0 && isQuestionRequired(question, state)) return false;

  for (const item of items) {
    for (const field of question.fields ?? []) {
      if (!isRepeaterFieldRequired(field, item, state)) {
        continue;
      }
      const value = item[field.key];
      if (field.type === 'address') {
        if (!hasAddressValue(value)) return false;
      } else if (!hasScalarValue(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Returns IDs of required visible questions that have no answer.
 */
export function getMissingRequiredFields(step: Step, state: WizardState): string[] {
  const visible = getVisibleQuestions(step, state);
  const missing: string[] = [];

  for (const question of visible) {
    if (!isQuestionRequired(question, state)) continue;
    const value = state.answers[question.id];

    if (question.type === 'address') {
      if (!hasAddressValue(value)) missing.push(question.id);
      continue;
    }

    if (question.type === 'repeater') {
      if (!Array.isArray(value) || !repeaterQuestionHasRequiredValues(question, value, state)) {
        missing.push(question.id);
      }
      continue;
    }

    if (!hasScalarValue(value)) {
      missing.push(question.id);
    }
  }

  return missing;
}

export const YES_NO_VALUES = YES_NO_OPTIONS;

import type { FormDefinition } from './types';
import { g1145Fields } from './field-maps/g1145';
import { i130Fields } from './field-maps/i130';
import { i130aFields } from './field-maps/i130a';
import { g1450Fields } from './field-maps/g1450';
import { i485Fields } from './field-maps/i485';
import { i864Fields } from './field-maps/i864';
import { i765Fields } from './field-maps/i765';
import { i131Fields } from './field-maps/i131';

export const FORM_REGISTRY: Record<string, FormDefinition> = {
  g1145: {
    id: 'g1145',
    name: 'Form G-1145',
    description: 'E-Notification of Application/Petition Acceptance',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/g-1145.pdf',
    localPath: 'public/uscis-forms/g1145.pdf',
    fieldMappings: g1145Fields,
    fillStrategy: 'overlay',
  },
  i130: {
    id: 'i130',
    name: 'Form I-130',
    description: 'Petition for Alien Relative (filed by petitioner)',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf',
    localPath: 'public/uscis-forms/i130_filled_template.pdf',
    fieldMappings: i130Fields,
    manualRequirements: [{ label: 'Petitioner must sign Form I-130 after printing' }],
  },
  i130a: {
    id: 'i130a',
    name: 'Form I-130A',
    description: 'Supplemental Info for Spouse Beneficiary',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-130a.pdf',
    localPath: 'public/uscis-forms/i130a_filled_template.pdf',
    fieldMappings: i130aFields,
    manualRequirements: [{ label: 'Beneficiary must sign Form I-130A after printing when required' }],
  },
  g1450: {
    id: 'g1450',
    name: 'Form G-1450',
    description: 'Authorization for Credit Card Transactions',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/g-1450.pdf',
    localPath: 'public/uscis-forms/g1450.pdf',
    fieldMappings: g1450Fields,
    fillStrategy: 'overlay',
    manualRequirements: [
      {
        label: 'Credit card holder must hand-sign Form G-1450 after printing',
        formPage: 1,
      },
    ],
  },
  i485: {
    id: 'i485',
    name: 'Form I-485',
    description: 'Application to Register Permanent Residence (beneficiary)',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf',
    localPath: 'public/uscis-forms/i485_filled_template.pdf',
    fieldMappings: i485Fields,
    manualRequirements: [{ label: 'Beneficiary must sign Form I-485 after printing' }],
  },
  i864: {
    id: 'i864',
    name: 'Form I-864',
    description: 'Affidavit of Support (filed by petitioner)',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf',
    localPath: 'public/uscis-forms/i864_filled_template.pdf',
    fieldMappings: i864Fields,
    manualRequirements: [{ label: 'Sponsor must sign Form I-864 after printing' }],
  },
  i765: {
    id: 'i765',
    name: 'Form I-765',
    description: 'Application for Employment Authorization (beneficiary)',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf',
    localPath: 'public/uscis-forms/i765_filled_template.pdf',
    fieldMappings: i765Fields,
    manualRequirements: [{ label: 'Beneficiary must sign Form I-765 after printing' }],
  },
  i131: {
    id: 'i131',
    name: 'Form I-131',
    description: 'Application for Advance Parole (beneficiary)',
    uscisUrl: 'https://www.uscis.gov/sites/default/files/document/forms/i-131.pdf',
    localPath: 'public/uscis-forms/i131_filled_template.pdf',
    fieldMappings: i131Fields,
    manualRequirements: [{ label: 'Beneficiary must sign Form I-131 after printing' }],
  },
};

export const FORM_IDS = Object.keys(FORM_REGISTRY) as Array<keyof typeof FORM_REGISTRY>;

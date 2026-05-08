import type { FieldMapping } from '../types';

function digitsOnly(value: string | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

function cardNumberSegment(index: number) {
  return (_answers: import('../types').Answers, supplements: import('@/types/wizard').FormSupplementAnswers) => {
    const digits = digitsOnly(supplements.payment_card_number);
    return digits.slice(index * 4, index * 4 + 4) || undefined;
  };
}

function expirationToPdf(
  _answers: import('../types').Answers,
  supplements: import('@/types/wizard').FormSupplementAnswers
): string | undefined {
  const raw = supplements.payment_expiration_date?.trim();
  if (!raw) return undefined;
  if (/^\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split('-');
    return `${month}/${year}`;
  }
  return raw;
}

function cardTypeValue(
  cardType: import('@/types/wizard').FormSupplementAnswers['payment_card_type']
): string | undefined {
  switch (cardType) {
    case 'Visa':
      return 'V';
    case 'MasterCard':
      return 'MC';
    case 'American Express':
      return 'A';
    case 'Discover':
      return 'D';
    default:
      return undefined;
  }
}

export const g1450Fields: FieldMapping[] = [
  { pdfField: 'form1[0].#subform[0].FamilyName[0]', source: { type: 'answer', key: 'petitioner_last_name' }, required: { label: 'Applicant / petitioner family name for G-1450', stepId: 2, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].GivenName[0]', source: { type: 'answer', key: 'petitioner_first_name' }, required: { label: 'Applicant / petitioner given name for G-1450', stepId: 2, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].MiddleName[0]', source: { type: 'answer', key: 'petitioner_middle_name' } },
  { pdfField: 'form1[0].#subform[0].CCHolderGivenName[0]', source: { type: 'supplement', key: 'payment_cardholder_given_name' }, required: { label: 'Credit card holder given name', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].CCHolderMiddleName[0]', source: { type: 'supplement', key: 'payment_cardholder_middle_name' } },
  { pdfField: 'form1[0].#subform[0].CCHolderFamilyName[0]', source: { type: 'supplement', key: 'payment_cardholder_family_name' }, required: { label: 'Credit card holder family name', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].Pt1Line2b_StreetNumberName[0]', source: { type: 'supplement', key: 'payment_billing_street' }, required: { label: 'Credit card billing street address', stepId: 1, formPage: 1 } },
  {
    pdfField: 'form1[0].#subform[0].CCHolderAptSteFlr_Unit[0]',
    source: { type: 'derived', fn: (_a, s) => (s.payment_billing_unit_type === 'STE' ? 'Yes' : undefined) },
  },
  {
    pdfField: 'form1[0].#subform[0].CCHolderAptSteFlr_Unit[1]',
    source: { type: 'derived', fn: (_a, s) => (s.payment_billing_unit_type === 'APT' ? 'Yes' : undefined) },
  },
  {
    pdfField: 'form1[0].#subform[0].CCHolderAptSteFlr_Unit[2]',
    source: { type: 'derived', fn: (_a, s) => (s.payment_billing_unit_type === 'FLR' ? 'Yes' : undefined) },
  },
  { pdfField: 'form1[0].#subform[0].CCHolderAptSteFlrNumber[0]', source: { type: 'supplement', key: 'payment_billing_unit_number' } },
  { pdfField: 'form1[0].#subform[0].CityOrTown[0]', source: { type: 'supplement', key: 'payment_billing_city' }, required: { label: 'Credit card billing city', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].State[0]', source: { type: 'supplement', key: 'payment_billing_state' }, required: { label: 'Credit card billing state', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].ZipCode[0]', source: { type: 'supplement', key: 'payment_billing_zip' }, required: { label: 'Credit card billing ZIP code', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].DaytimeTelephoneNumber[0]', source: { type: 'supplement', key: 'payment_daytime_phone' }, required: { label: 'Credit card holder daytime phone number', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].Email[0]', source: { type: 'supplement', key: 'payment_email' }, required: { label: 'Credit card holder email address', stepId: 1, formPage: 1 } },
  {
    pdfField: 'form1[0].#subform[0].CreditCardTypeChBx[0]',
    source: { type: 'derived', fn: (_a, s) => (cardTypeValue(s.payment_card_type) === 'V' ? 'Yes' : undefined) },
  },
  {
    pdfField: 'form1[0].#subform[0].CreditCardTypeChBx[1]',
    source: { type: 'derived', fn: (_a, s) => (cardTypeValue(s.payment_card_type) === 'MC' ? 'Yes' : undefined) },
  },
  {
    pdfField: 'form1[0].#subform[0].CreditCardTypeChBx[2]',
    source: { type: 'derived', fn: (_a, s) => (cardTypeValue(s.payment_card_type) === 'A' ? 'Yes' : undefined) },
  },
  {
    pdfField: 'form1[0].#subform[0].CreditCardTypeChBx[3]',
    source: { type: 'derived', fn: (_a, s) => (cardTypeValue(s.payment_card_type) === 'D' ? 'Yes' : undefined) },
  },
  {
    pdfField: 'validation.credit_card_type',
    skipRender: true,
    source: { type: 'derived', fn: (_a, s) => cardTypeValue(s.payment_card_type) },
    required: { label: 'Credit card type', stepId: 1, formPage: 1 },
  },
  { pdfField: 'form1[0].#subform[0].CreditCardNumber_1[0]', source: { type: 'derived', fn: cardNumberSegment(0) }, required: { label: 'Credit card number', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].CreditCardNumber_2[0]', source: { type: 'derived', fn: cardNumberSegment(1) } },
  { pdfField: 'form1[0].#subform[0].CreditCardNumber_3[0]', source: { type: 'derived', fn: cardNumberSegment(2) } },
  { pdfField: 'form1[0].#subform[0].CreditCardNumber_4[0]', source: { type: 'derived', fn: cardNumberSegment(3) } },
  { pdfField: 'form1[0].#subform[0].ExpirationDate[0]', source: { type: 'derived', fn: expirationToPdf }, required: { label: 'Credit card expiration date', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].CreditCardNumber_4[1]', source: { type: 'supplement', key: 'payment_cvv' }, required: { label: 'Credit card CVV code', stepId: 1, formPage: 1 } },
  { pdfField: 'form1[0].#subform[0].AuthorizedPaymentAmt[0]', source: { type: 'supplement', key: 'payment_authorized_amount' }, required: { label: 'Authorized payment amount', stepId: 1, formPage: 1 } },
];

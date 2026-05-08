export type QuestionType =
  | 'text'
  | 'date'
  | 'select'
  | 'radio'
  | 'yesno'
  | 'address'
  | 'textarea'
  | 'number'
  | 'repeater';

export type ScalarQuestionType = Exclude<QuestionType, 'repeater'>;

export type RequiredRule<State = WizardState> = boolean | ((state: State) => boolean);

export interface RepeaterItemState {
  [key: string]: string | boolean | AddressValue | undefined;
}

export interface RepeaterField {
  key: string;
  label: string;
  type: ScalarQuestionType;
  options?: string[];
  required?: boolean | ((item: RepeaterItemState, state: WizardState) => boolean);
  hint?: string;
  placeholder?: string;
  showIf?: (item: RepeaterItemState, state: WizardState) => boolean;
}

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  required?: RequiredRule;
  hint?: string;
  placeholder?: string;
  showIf?: (state: WizardState) => boolean;
  itemLabel?: string;
  addButtonLabel?: string;
  minItems?: number;
  fields?: RepeaterField[];
}

export interface AddressValue {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export type AnswerValue = string | boolean | AddressValue | RepeaterItemState[] | undefined;

export interface WizardState {
  currentStep: number;
  answers: Record<string, AnswerValue>;
  completedSteps: number[];
  startedAt: string;
  lastUpdatedAt: string;
}

export interface Step {
  id: number;
  title: string;
  description?: string;
  questions: Question[];
}

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string;
  category: 'always' | 'conditional';
  officialLink?: string;
}

export interface FormSupplementAnswers {
  payment_cardholder_given_name?: string;
  payment_cardholder_middle_name?: string;
  payment_cardholder_family_name?: string;
  payment_billing_street?: string;
  payment_billing_unit_type?: 'APT' | 'STE' | 'FLR';
  payment_billing_unit_number?: string;
  payment_billing_city?: string;
  payment_billing_state?: string;
  payment_billing_zip?: string;
  payment_daytime_phone?: string;
  payment_email?: string;
  payment_card_type?: 'Visa' | 'MasterCard' | 'American Express' | 'Discover';
  payment_card_number?: string;
  payment_expiration_date?: string;
  payment_cvv?: string;
  payment_authorized_amount?: string;
}

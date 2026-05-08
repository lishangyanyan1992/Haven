import type {
  AddressValue,
  FormSupplementAnswers,
  RepeaterItemState,
} from '@/types/wizard';

export type Answers = Record<string, string | boolean | AddressValue | RepeaterItemState[] | undefined>;

export type FormId = 'g1145' | 'i130' | 'i130a' | 'g1450' | 'i485' | 'i864' | 'i765' | 'i131';

export interface RequiredFieldDescriptor {
  label: string;
  stepId: number | ((answers: Answers, supplements: FormSupplementAnswers) => number);
  formPage?: number;
  blocking?: boolean;
  requiredWhen?: (answers: Answers, supplements: FormSupplementAnswers) => boolean;
}

export interface FieldMapping {
  pdfField: string;
  skipRender?: boolean;
  source:
    | { type: 'answer'; key: string }
    | { type: 'address'; key: string; part: 'street' | 'city' | 'state' | 'zip' | 'country' }
    | { type: 'constant'; value: string }
    | { type: 'supplement'; key: keyof FormSupplementAnswers }
    | { type: 'derived'; fn: (a: Answers, s: FormSupplementAnswers) => string | undefined };
  required?: RequiredFieldDescriptor;
}

export interface ManualRequirement {
  label: string;
  stepId?: number;
  formPage?: number;
  blocking?: boolean;
}

export interface FormDefinition {
  id: FormId;
  name: string;
  description: string;
  uscisUrl: string;
  localPath: string;
  fieldMappings: FieldMapping[];
  fillStrategy?: 'acroform' | 'overlay';
  manualRequirements?: ManualRequirement[];
}

export interface FormValidationIssue {
  formId: FormId;
  formName: string;
  label: string;
  stepId: number | null;
  formPage?: number;
  blocking: boolean;
}

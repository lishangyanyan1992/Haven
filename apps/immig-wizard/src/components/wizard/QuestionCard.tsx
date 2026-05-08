'use client';

import {
  AddressValue,
  Question,
  RepeaterField,
  RepeaterItemState,
  WizardState,
} from '@/types/wizard';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Info, Plus, Trash2 } from 'lucide-react';
import {
  createEmptyAddress,
  createEmptyRepeaterItem,
  isQuestionRequired,
  isRepeaterFieldRequired,
  isRepeaterFieldVisible,
} from '@/lib/wizard-steps';

interface QuestionCardProps {
  question: Question;
  value: import('@/types/wizard').AnswerValue;
  onChange: (
    questionId: string,
    value:
      | string
      | boolean
      | AddressValue
      | RepeaterItemState[]
  ) => void;
  wizardState: WizardState;
  hasError?: boolean;
}

function getAddressValue(value: unknown): AddressValue {
  return (typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value
    : createEmptyAddress()) as AddressValue;
}

function renderScalarControl({
  id,
  type,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  type: Exclude<Question['type'], 'repeater'>;
  value: string | boolean | AddressValue | undefined;
  options?: string[];
  placeholder?: string;
  onChange: (value: string | boolean | AddressValue) => void;
}) {
  const stringValue = typeof value === 'string' ? value : '';
  const addressValue = getAddressValue(value);

  if (type === 'yesno') {
    return (
      <RadioGroup
        value={value === 'yes' ? 'yes' : value === 'no' ? 'no' : ''}
        onValueChange={(next) => onChange(next)}
        className="flex gap-4"
      >
        {['yes', 'no'].map((option) => (
          <div key={option} className="flex items-center space-x-2 rounded-full border border-border bg-background px-3 py-2">
            <RadioGroupItem value={option} id={`${id}-${option}`} />
            <Label htmlFor={`${id}-${option}`} className="cursor-pointer font-medium text-[color:var(--neutral-700)]">
              {option === 'yes' ? 'Yes' : 'No'}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (type === 'radio' && options) {
    return (
      <RadioGroup
        value={stringValue}
        onValueChange={(next) => onChange(next)}
        className="space-y-3"
      >
        {options.map((option) => (
          <div
            key={option}
            className={`flex items-center space-x-3 rounded-[var(--radius-md-token)] border p-4 transition-[border-color,background-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] ${
              stringValue === option
                ? 'border-[color:var(--primary)] bg-primary-subtle shadow-[var(--shadow-xs)]'
                : 'border-border bg-background hover:border-[color:var(--border-strong)] hover:bg-secondary'
            }`}
          >
            <RadioGroupItem value={option} id={`${id}-${option}`} />
            <Label htmlFor={`${id}-${option}`} className="cursor-pointer text-[color:var(--neutral-700)]">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (type === 'select' && options) {
    return (
      <Select value={stringValue} onValueChange={(next) => { if (next !== null) onChange(next); }}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an option..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (type === 'text' || type === 'number') {
    return (
      <Input
        type={type === 'number' ? 'number' : 'text'}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
    );
  }

  if (type === 'date') {
    return (
      <Input
        type="date"
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs"
      />
    );
  }

  if (type === 'textarea') {
    return (
      <Textarea
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full"
      />
    );
  }

  if (type === 'address') {
    return (
      <div className="space-y-3">
        <Input
          type="text"
          value={addressValue.street}
          onChange={(e) => onChange({ ...addressValue, street: e.target.value })}
          placeholder="Street address"
          className="w-full"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="text"
            value={addressValue.city}
            onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
            placeholder="City"
          />
          <Input
            type="text"
            value={addressValue.state}
            onChange={(e) => onChange({ ...addressValue, state: e.target.value })}
            placeholder="State / Province"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="text"
            value={addressValue.zip}
            onChange={(e) => onChange({ ...addressValue, zip: e.target.value })}
            placeholder="ZIP / Postal code"
          />
          <Input
            type="text"
            value={addressValue.country}
            onChange={(e) => onChange({ ...addressValue, country: e.target.value })}
            placeholder="Country"
          />
        </div>
      </div>
    );
  }

  return null;
}

function RepeaterFieldControl({
  questionId,
  field,
  item,
  itemIndex,
  wizardState,
  onItemChange,
}: {
  questionId: string;
  field: RepeaterField;
  item: RepeaterItemState;
  itemIndex: number;
  wizardState: WizardState;
  onItemChange: (fieldKey: string, value: string | boolean | AddressValue) => void;
}) {
  if (!isRepeaterFieldVisible(field, item, wizardState)) {
    return null;
  }

  const required = isRepeaterFieldRequired(field, item, wizardState);

  return (
    <div className={field.type === 'address' ? 'col-span-full' : ''}>
      <Label className="mb-2 block text-sm font-medium text-[color:var(--neutral-700)]">
        {field.label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {field.hint && <p className="mb-2 text-xs leading-5 text-muted-foreground">{field.hint}</p>}
      {renderScalarControl({
        id: `${questionId}-${itemIndex}-${field.key}`,
        type: field.type,
        value: item[field.key],
        options: field.options,
        placeholder: field.placeholder,
        onChange: (value) => onItemChange(field.key, value),
      })}
    </div>
  );
}

function RepeaterControl({
  question,
  items,
  onChange,
  wizardState,
}: {
  question: Question;
  items: RepeaterItemState[];
  onChange: (value: RepeaterItemState[]) => void;
  wizardState: WizardState;
}) {
  const nextItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...nextItems, createEmptyRepeaterItem(question)]);
  };

  const updateItem = (index: number, fieldKey: string, value: string | boolean | AddressValue) => {
    const updated = nextItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [fieldKey]: value } : item
    );
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(nextItems.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="space-y-4">
      {nextItems.map((item, index) => (
        <div
          key={`${question.id}-${index}`}
          className="rounded-[var(--radius-lg-token)] border border-border bg-secondary p-5 shadow-[var(--shadow-xs)]"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {(question.itemLabel ?? 'item').replace(/^\w/, (char) => char.toUpperCase())} {index + 1}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:bg-[color:rgb(201_58_50_/_0.08)] hover:text-destructive"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(question.fields ?? []).map((field) => (
              <RepeaterFieldControl
                key={field.key}
                questionId={question.id}
                field={field}
                item={item}
                itemIndex={index}
                wizardState={wizardState}
                onItemChange={(fieldKey, value) => updateItem(index, fieldKey, value)}
              />
            ))}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus className="mr-1.5 h-4 w-4" />
        {question.addButtonLabel ?? `Add ${question.itemLabel ?? 'item'}`}
      </Button>
    </div>
  );
}

export function QuestionCard({ question, value, onChange, wizardState, hasError }: QuestionCardProps) {
  const required = isQuestionRequired(question, wizardState);
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <div
      id={`question-${question.id}`}
      className={`rounded-[var(--radius-lg-token)] border p-6 shadow-[var(--shadow-sm)] ${hasError ? 'border-destructive bg-[color:var(--destructive-subtle)]' : 'border-border bg-card'}`}
    >
      <div className="mb-4">
        <Label className="text-base font-semibold leading-snug text-foreground">
          {question.label}
          {required && <span className="ml-1 text-red-500" aria-label="required">*</span>}
        </Label>
        {hasError && (
          <p className="mt-1 text-sm font-medium text-destructive">
            This section still has required information missing.
          </p>
        )}
        {question.hint && (
          <div className="mt-3 flex items-start gap-3 rounded-[var(--radius-md-token)] border border-[color:rgb(42_101_184_/_0.18)] bg-[color:var(--info-tint)] p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" />
            <p className="text-sm leading-6 text-[color:var(--info-foreground)]">{question.hint}</p>
          </div>
        )}
      </div>

      <div className="mt-3">
        {question.type === 'repeater' ? (
          <RepeaterControl
            question={question}
            items={Array.isArray(value) ? value : []}
            onChange={(next) => onChange(question.id, next)}
            wizardState={wizardState}
          />
        ) : (
          renderScalarControl({
            id: question.id,
            type: question.type,
            value:
              question.type === 'address'
                ? getAddressValue(value)
                : typeof value === 'string'
                  ? stringValue
                  : value as string | boolean | AddressValue | undefined,
            options: question.options,
            placeholder: question.placeholder,
            onChange: (next) => onChange(question.id, next),
          })
        )}
      </div>
    </div>
  );
}

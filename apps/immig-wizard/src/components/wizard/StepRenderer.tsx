'use client';

import { AddressValue, RepeaterItemState, Step, WizardState } from '@/types/wizard';
import { QuestionCard } from './QuestionCard';
import { getVisibleQuestions } from '@/lib/wizard-steps';

interface StepRendererProps {
  step: Step;
  wizardState: WizardState;
  onAnswerChange: (
    questionId: string,
    value: string | boolean | AddressValue | RepeaterItemState[]
  ) => void;
  validationErrors?: string[];
}

export function StepRenderer({ step, wizardState, onAnswerChange, validationErrors = [] }: StepRendererProps) {
  const visibleQuestions = getVisibleQuestions(step, wizardState);

  return (
    <div className="space-y-5">
      {step.description && (
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{step.description}</p>
      )}
      {visibleQuestions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          value={wizardState.answers[question.id]}
          onChange={onAnswerChange}
          wizardState={wizardState}
          hasError={validationErrors.includes(question.id)}
        />
      ))}
    </div>
  );
}

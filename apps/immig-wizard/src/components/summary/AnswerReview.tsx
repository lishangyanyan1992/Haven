'use client';

import { WizardState } from '@/types/wizard';
import { wizardSteps, getVisibleQuestions } from '@/lib/wizard-steps';
import { Badge } from '@/components/ui/badge';

interface AnswerReviewProps {
  wizardState: WizardState;
  onEdit?: (step: number) => void;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return `${value.length} entr${value.length === 1 ? 'y' : 'ies'} recorded`;
  }
  if (typeof value === 'object' && 'street' in (value as object)) {
    const addr = value as { street: string; city: string; state: string; zip: string; country: string };
    return [addr.street, addr.city, addr.state, addr.zip, addr.country]
      .filter(Boolean)
      .join(', ');
  }
  return String(value);
}

export function AnswerReview({ wizardState, onEdit }: AnswerReviewProps) {
  return (
    <div className="space-y-6">
      {wizardSteps.map((step) => {
        const visibleQuestions = getVisibleQuestions(step, wizardState);
        const answeredQuestions = visibleQuestions.filter(
          (q) => wizardState.answers[q.id] !== undefined && wizardState.answers[q.id] !== ''
        );

        return (
          <div
            key={step.id}
            className="overflow-hidden rounded-[var(--radius-xl-token)] border border-border bg-white shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-subtle text-xs font-bold text-primary">
                  {step.id}
                </span>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={answeredQuestions.length > 0 ? 'default' : 'secondary'} className="text-[9px]">
                  {answeredQuestions.length}/{visibleQuestions.length} answered
                </Badge>
                {onEdit && (
                  <button
                    onClick={() => onEdit(step.id)}
                    className="text-xs font-medium text-primary hover:text-[color:var(--primary-hover)]"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            {answeredQuestions.length > 0 ? (
              <div className="divide-y divide-border">
                {answeredQuestions.map((question) => (
                  <div key={question.id} className="flex gap-4 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="mb-0.5 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                        {question.label}
                      </p>
                      <p className="text-sm font-medium leading-6 text-[color:var(--neutral-800)]">
                        {formatValue(wizardState.answers[question.id])}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-4 text-sm italic text-muted-foreground">No answers recorded for this step.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

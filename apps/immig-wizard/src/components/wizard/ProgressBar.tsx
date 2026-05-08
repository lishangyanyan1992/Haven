'use client';

import { Progress } from '@/components/ui/progress';
import { TOTAL_STEPS } from '@/lib/wizard-steps';

interface ProgressBarProps {
  currentStep: number;
  completedSteps: number[];
}

export function ProgressBar({ currentStep, completedSteps }: ProgressBarProps) {
  const percentage = Math.round(((currentStep - 1) / (TOTAL_STEPS - 1)) * 100);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-[color:var(--neutral-700)]">
          Step {currentStep} of {TOTAL_STEPS}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{percentage}% complete</span>
      </div>
      <Progress value={percentage} className="gap-0" />
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              completedSteps.includes(step)
                ? 'bg-[color:var(--success)]'
                : step === currentStep
                ? 'bg-primary'
                : 'bg-secondary'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

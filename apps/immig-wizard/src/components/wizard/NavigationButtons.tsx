'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

interface NavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  isLastStep?: boolean;
}

export function NavigationButtons({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isLastStep,
}: NavigationButtonsProps) {
  return (
    <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={currentStep === 1}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Button>

      <Button
        type="button"
        onClick={onNext}
        className={`min-w-44 gap-2 ${isLastStep ? 'bg-[color:var(--success)] text-white hover:bg-[color:var(--success-ink)]' : ''}`}
      >
        {isLastStep ? (
          <>
            <CheckCircle className="w-4 h-4" />
            View My Summary
          </>
        ) : (
          <>
            Continue
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}

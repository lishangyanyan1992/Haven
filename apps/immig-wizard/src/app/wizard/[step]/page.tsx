'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { DraftConflictDialog } from '@/components/draft/DraftConflictDialog';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { StepRenderer } from '@/components/wizard/StepRenderer';
import { NavigationButtons } from '@/components/wizard/NavigationButtons';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { getStep, TOTAL_STEPS, getMissingRequiredFields } from '@/lib/wizard-steps';
import { createInitialState } from '@/lib/storage';
import { WizardState, AddressValue, RepeaterItemState } from '@/types/wizard';

interface Props {
  params: Promise<{ step: string }>;
}

export default function WizardStepPage({ params }: Props) {
  const { step: stepParam } = use(params);
  const stepId = parseInt(stepParam, 10);
  const router = useRouter();

  const [eligibilityBlocked, setEligibilityBlocked] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const {
    wizardState,
    isHydrating,
    conflict,
    chooseLocalDraft,
    chooseRemoteDraft,
    updateWizardState
  } = useWizardDraft();

  useEffect(() => {
    if (!wizardState) return;
    if (wizardState.currentStep === stepId) return;

    updateWizardState((prev) => ({
      ...prev,
      currentStep: stepId
    }));
  }, [stepId, updateWizardState, wizardState]);

  const handleAnswerChange = useCallback(
    (questionId: string, value: string | boolean | AddressValue | RepeaterItemState[]) => {
      updateWizardState((prev) => ({
        ...prev,
        answers: { ...prev.answers, [questionId]: value },
      }));
      setValidationErrors((prev) => prev.filter((id) => id !== questionId));
    },
    [updateWizardState]
  );

  const checkEligibility = useCallback((state: WizardState): string | null => {
    if (stepId !== 1) return null;
    if (state.answers['petitioner_is_citizen'] === 'no') {
      return 'The petitioner must be a US citizen to file for a marriage-based green card through Adjustment of Status. If the petitioner is a Lawful Permanent Resident (LPR/green card holder), they must use a different process (Immigrant Petition for Alien Relatives — Form I-130 only, with consular processing abroad, and subject to a waiting period).';
    }
    if (state.answers['currently_married'] === 'no') {
      return "You must be legally married before filing. If you are not yet married, you may want to explore the K-1 fiancé visa, which allows your partner to come to the US to get married.";
    }
    if (state.answers['beneficiary_in_us'] === 'no') {
      return "Adjustment of Status (I-485) is only available to applicants currently in the US. If the beneficiary is abroad, they must apply through consular processing at a US embassy or consulate in their home country.";
    }
    if (state.answers['entered_legally'] === 'no') {
      return "Generally, to adjust status, the beneficiary must have entered the US legally (inspected and admitted). If you entered without inspection (EWI), you may still qualify as an immediate relative of a US citizen under INA §245(i) if a petition was filed before April 30, 2001, or you may need to consult an attorney about a waiver.";
    }
    return null;
  }, [stepId]);

  const handleNext = useCallback(() => {
    if (!wizardState) return;

    // Check eligibility on step 1
    if (stepId === 1) {
      const blockReason = checkEligibility(wizardState);
      if (blockReason) {
        setEligibilityBlocked(true);
        return;
      }
    }

    // Validate required fields
    const step = getStep(stepId);
    if (step) {
      const missing = getMissingRequiredFields(step, wizardState);
      if (missing.length > 0) {
        setValidationErrors(missing);
        // Scroll to first error
        setTimeout(() => {
          document.getElementById(`question-${missing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return;
      }
    }
    setValidationErrors([]);

    const updatedState: WizardState = {
      ...wizardState,
      currentStep: stepId + 1,
      completedSteps: [...new Set([...wizardState.completedSteps, stepId])],
    };
    updateWizardState(updatedState);

    if (stepId >= TOTAL_STEPS) {
      router.push('/summary');
    } else {
      router.push(`/wizard/${stepId + 1}`);
    }
  }, [wizardState, stepId, checkEligibility, router]);

  const handleBack = useCallback(() => {
    if (stepId <= 1) {
      router.push('/');
      return;
    }
    router.push(`/wizard/${stepId - 1}`);
  }, [stepId, router]);

  const step = getStep(stepId);

  if (isHydrating || !wizardState || !step) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const eligibilityBlock = stepId === 1 ? checkEligibility(wizardState) : null;

  return (
    <WizardLayout
      currentStep={stepId}
      completedSteps={wizardState.completedSteps}
      stepTitle={step.title}
    >
      <StepRenderer
        step={step}
        wizardState={wizardState}
        onAnswerChange={handleAnswerChange}
        validationErrors={validationErrors}
      />

      {/* Eligibility warning */}
      {eligibilityBlocked && eligibilityBlock && (
        <div className="mt-6 rounded-[var(--radius-lg-token)] border border-[color:rgb(217_123_42_/_0.28)] bg-[color:var(--warning-tint)] p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]" />
            <div>
              <p className="mb-1 font-semibold text-[color:var(--warning-foreground)]">
                This pathway may not be available to you
              </p>
              <p className="text-sm leading-6 text-[color:var(--warning-foreground)]">{eligibilityBlock}</p>
              <button
                onClick={() => setEligibilityBlocked(false)}
                className="mt-3 text-sm font-medium text-[color:var(--warning-foreground)] underline underline-offset-4"
              >
                I understand — continue anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation error summary */}
      {validationErrors.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-lg-token)] border border-[color:rgb(201_58_50_/_0.28)] bg-[color:var(--destructive-subtle)] p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-[color:var(--error-ink)]">
            Please answer all required fields ({validationErrors.length} remaining) before continuing.
          </p>
        </div>
      )}

      <NavigationButtons
        currentStep={stepId}
        totalSteps={TOTAL_STEPS}
        onBack={handleBack}
        onNext={handleNext}
        isLastStep={stepId === TOTAL_STEPS}
      />

      <DraftConflictDialog
        open={Boolean(conflict)}
        localState={conflict?.localState ?? createInitialState()}
        localSupplements={conflict?.localSupplements ?? {}}
        remoteState={conflict?.remoteState ?? createInitialState()}
        remoteSupplements={conflict?.remoteSupplements ?? {}}
        onChooseLocal={chooseLocalDraft}
        onChooseRemote={chooseRemoteDraft}
      />
    </WizardLayout>
  );
}

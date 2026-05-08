'use client';

import Link from 'next/link';
import { HavenMark } from '@/components/branding/HavenMark';
import { ProgressBar } from './ProgressBar';
import { TOTAL_STEPS } from '@/lib/wizard-steps';

const HAVEN_HOME_URL = 'https://haven-h1b.com/';

interface WizardLayoutProps {
  currentStep: number;
  completedSteps: number[];
  stepTitle: string;
  children: React.ReactNode;
}

export function WizardLayout({
  currentStep,
  completedSteps,
  stepTitle,
  children,
}: WizardLayoutProps) {
  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <header className="sticky top-0 z-10 border-b border-border bg-[color:rgb(250_249_247_/_0.9)] backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href={HAVEN_HOME_URL} prefetch={false}>
                <HavenMark labelClassName="text-[1.6rem]" />
              </Link>
              <div className="hidden h-8 w-px bg-border sm:block" />
              <div className="hidden sm:block">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Guided intake
                </p>
                <p className="text-sm text-[color:var(--neutral-600)]">Marriage Green Card</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Step
              </p>
              <p className="font-mono text-xs text-[color:var(--neutral-600)]">
                {currentStep}/{TOTAL_STEPS}
              </p>
            </div>
          </div>
          <ProgressBar currentStep={currentStep} completedSteps={completedSteps} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 rounded-[var(--radius-xl-token)] border border-border bg-card px-6 py-6 shadow-[var(--shadow-sm)]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Step {currentStep} of {TOTAL_STEPS}
          </div>
          <h1 className="text-4xl font-light leading-none text-foreground sm:text-[2.8rem]">
            {stepTitle}
          </h1>
        </div>

        {children}
      </main>

      <footer className="mx-auto mt-4 max-w-3xl px-4 py-8 sm:px-6">
        <p className="text-center text-xs leading-6 text-muted-foreground">
          This tool is for informational purposes only and does not constitute legal advice.
          Consult an immigration attorney for your specific situation.
          All data is stored locally on your device only.
        </p>
      </footer>
    </div>
  );
}

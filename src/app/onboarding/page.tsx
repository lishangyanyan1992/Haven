import Link from "next/link";

import {
  saveOnboardingStepFourAction,
  saveOnboardingStepOneAction,
  saveOnboardingStepThreeAction,
  saveOnboardingStepTwoAction
} from "@/server/actions";
import { HavenBrand } from "@/components/app/haven-brand";
import { OnboardingFlow } from "./OnboardingFlow";

async function saveStepAction(step: number, data: FormData) {
  "use server";
  if (step === 1) {
    await saveOnboardingStepOneAction(data);
    return;
  }

  if (step === 2) {
    await saveOnboardingStepTwoAction(data);
    return;
  }

  if (step === 3) {
    await saveOnboardingStepThreeAction(data);
    return;
  }

  if (step === 4) {
    await saveOnboardingStepOneAction(data);
    await saveOnboardingStepTwoAction(data);
    await saveOnboardingStepThreeAction(data);
    await saveOnboardingStepFourAction(data);
  }
}

export default async function OnboardingPage({
  searchParams
}: {
  searchParams?: Promise<{ step?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedStep = Number(resolvedSearchParams?.step ?? "");
  const initialStep = Number.isFinite(requestedStep) && requestedStep >= 1 && requestedStep <= 4 ? requestedStep : 1;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between gap-4 py-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <p className="text-body-sm hidden md:block">Step by step. Value at every step.</p>
        </div>
      </header>
      <OnboardingFlow initialStep={initialStep} saveStepAction={saveStepAction} />
    </div>
  );
}

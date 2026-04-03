"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CalendarDays, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { activateCrisisMode } from "@/server/crisis-actions";

function getTodayValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().split("T")[0];
}

function formatDateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface CrisisActivationModalProps {
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "destructive";
  className?: string;
}

export function CrisisActivationModal({
  triggerLabel = "I was just laid off",
  triggerVariant = "destructive",
  className,
}: CrisisActivationModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [layoffDate, setLayoffDate] = useState(getTodayValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setStep(1);
      setError(null);
      setLayoffDate(getTodayValue());
    }
  }, [open]);

  function handleActivate() {
    setError(null);

    startTransition(async () => {
      try {
        await activateCrisisMode(layoffDate);
        setOpen(false);
        router.refresh();
      } catch (activationError) {
        setError(activationError instanceof Error ? activationError.message : "Unable to activate crisis mode.");
      }
    });
  }

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Trigger asChild>
        <button className={cn(buttonVariants({ size: "default", variant: triggerVariant }), className)} type="button">
          {triggerLabel}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(21,26,23,0.35)] backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-2xl)] border border-[var(--haven-blush)] bg-[var(--haven-white)] p-6 shadow-[0_24px_80px_rgba(21,26,23,0.18)] md:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-[var(--haven-blush-light)] p-2 text-[var(--haven-blush-ink)]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <Dialog.Title className="text-h2">
                {step === 1 ? "Activate crisis mode" : "Confirm the 60-day plan"}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
                {step === 1
                  ? "This switches Haven into a focused layoff response mode across the app."
                  : "Once activated, Haven keeps the countdown and checklist visible until you mark the event resolved."}
              </Dialog.Description>
            </div>
          </div>

          {step === 1 ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-cream)] p-4">
                <p className="text-label">Last day of employment</p>
                <p className="mt-2 text-body-sm">
                  Use your actual final day. Haven uses this for context, while the 60-day tracker starts when you activate crisis mode.
                </p>
              </div>

              <div>
                <label className="field-label" htmlFor="layoff-date">
                  Layoff date
                </label>
                <Input
                  id="layoff-date"
                  max={getTodayValue()}
                  onChange={(event) => setLayoffDate(event.target.value)}
                  type="date"
                  value={layoffDate}
                />
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <PreviewCard
                  detail={formatDateLabel(layoffDate)}
                  icon={<CalendarDays className="h-4 w-4" />}
                  title="Layoff date"
                />
                <PreviewCard
                  detail="Day 1 starts now"
                  icon={<Clock3 className="h-4 w-4" />}
                  title="Countdown"
                />
                <PreviewCard
                  detail="Checklist unlocks"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Planner"
                />
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] p-4">
                <p className="text-label text-[var(--haven-blush-ink)]">What changes immediately</p>
                <ul className="mt-3 space-y-2 text-body-sm text-[var(--haven-blush-ink)]">
                  <li>The crisis banner appears across dashboard, planner, and supporting pages.</li>
                  <li>Your planner checklist becomes interactive and persists in Supabase.</li>
                  <li>The dashboard shifts to a 60-day survival view with direct links back to the checklist.</li>
                </ul>
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3 text-body-sm text-[var(--haven-blush-ink)]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {step === 2 ? (
              <Button disabled={isPending} onClick={() => setStep(1)} type="button" variant="outline">
                Back
              </Button>
            ) : (
              <Dialog.Close asChild>
                <Button disabled={isPending} type="button" variant="outline">
                  Cancel
                </Button>
              </Dialog.Close>
            )}

            {step === 1 ? (
              <Button disabled={!layoffDate || isPending} onClick={() => setStep(2)} type="button">
                Continue
              </Button>
            ) : (
              <Button disabled={isPending} onClick={handleActivate} type="button" variant="destructive">
                {isPending ? "Activating..." : "Start crisis mode"}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewCard({
  title,
  detail,
  icon,
}: {
  title: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
      <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
        {icon}
        <p className="text-label">{title}</p>
      </div>
      <p className="mt-3 text-h3">{detail}</p>
    </div>
  );
}

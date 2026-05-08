"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Sparkles } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode
} from "react";

import { Button, buttonVariants, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitWaitlistAction } from "@/server/actions";

type WaitlistInterest = {
  key: string;
  label: string;
};

type WaitlistContextValue = {
  openWaitlist: (interest: WaitlistInterest) => void;
};

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function WaitlistModalProvider({
  children,
  sourcePath
}: {
  children: ReactNode;
  sourcePath: string;
}) {
  const [open, setOpen] = useState(false);
  const [interest, setInterest] = useState<WaitlistInterest | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setFullName("");
      setEmail("");
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const value = useMemo<WaitlistContextValue>(
    () => ({
      openWaitlist(nextInterest) {
        setInterest(nextInterest);
        setOpen(true);
      }
    }),
    []
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!interest) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await submitWaitlistAction({
        fullName,
        email,
        interestKey: interest.key,
        interestLabel: interest.label,
        sourcePath
      });

      if (result.status === "success") {
        setSuccess(result.message);
        setError(null);
        return;
      }

      setSuccess(null);
      setError(result.message);
    });
  }

  return (
    <WaitlistContext.Provider value={value}>
      {children}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(21,26,23,0.35)] backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-2xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-white)] p-6 shadow-[0_24px_80px_rgba(21,26,23,0.18)] md:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-[var(--haven-sky-light)] p-2 text-[var(--haven-sky-ink)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <Dialog.Title className="text-h2">Join the waitlist</Dialog.Title>
                <Dialog.Description className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
                  {interest
                    ? `Leave your name and email and Haven will let you know when ${interest.label.toLowerCase()} opens.`
                    : "Leave your name and email and Haven will keep you posted."}
                </Dialog.Description>
              </div>
            </div>

            {success ? (
              <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4">
                <p className="text-h3 text-[var(--haven-ink)]">{success}</p>
                <p className="mt-2 text-body-sm">
                  We&apos;ll reach out at <span className="font-medium text-[var(--haven-ink)]">{email}</span> when it&apos;s ready.
                </p>
              </div>
            ) : (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="field-label" htmlFor="waitlist-full-name">
                    Name
                  </label>
                  <Input
                    id="waitlist-full-name"
                    autoComplete="name"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    required
                    value={fullName}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="waitlist-email">
                    Email
                  </label>
                  <Input
                    id="waitlist-email"
                    autoComplete="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>

                {interest ? (
                  <div className="rounded-[var(--radius-lg)] bg-[var(--haven-cream)] px-4 py-3">
                    <p className="text-label">Feature</p>
                    <p className="mt-2 text-body-sm text-[var(--haven-ink)]">{interest.label}</p>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3 text-body-sm text-[var(--haven-blush-ink)]">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Dialog.Close asChild>
                    <Button disabled={isPending} type="button" variant="outline">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button disabled={isPending} type="submit">
                    {isPending ? "Joining..." : "Join the waitlist"}
                  </Button>
                </div>
              </form>
            )}

            {success ? (
              <div className="mt-6 flex justify-end">
                <Dialog.Close asChild>
                  <Button type="button">Close</Button>
                </Dialog.Close>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </WaitlistContext.Provider>
  );
}

export function WaitlistTrigger({
  children,
  className,
  interestKey,
  interestLabel,
  size,
  variant = "default"
}: {
  children: ReactNode;
  className?: string;
  interestKey: string;
  interestLabel: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const context = useContext(WaitlistContext);

  if (!context) {
    throw new Error("WaitlistTrigger must be used inside WaitlistModalProvider.");
  }

  return (
    <button
      className={cn(buttonVariants({ size, variant }), className)}
      onClick={() => context.openWaitlist({ key: interestKey, label: interestLabel })}
      type="button"
    >
      {children}
    </button>
  );
}

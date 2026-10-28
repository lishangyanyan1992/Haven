"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/server/actions";
import { grantFirmAccessAction } from "@/server/firm-actions";

export function GrantFirmAccessCard({
  firmName,
  token,
  userEmail,
  alreadyConnected
}: {
  firmName: string;
  token: string;
  userEmail: string;
  alreadyConnected: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (alreadyConnected) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5 text-[var(--haven-ink)]">
          <p className="flex items-center gap-2 text-h3 font-semibold">
            <CheckCircle2 className="h-5 w-5 text-[var(--haven-sage-strong)]" />
            Already connected to {firmName}
          </p>
          <p className="mt-2 text-body-sm leading-relaxed">
            Your Haven account (<strong>{userEmail}</strong>) is already connected to {firmName}. You can track your engagement timeline, milestone progress, and document checklist on your dashboard.
          </p>
        </div>

        <Link className={buttonVariants({ variant: "default", className: "w-full" })} href="/dashboard">
          Go to Case Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-sand-light)] px-4 py-3 text-body-sm">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--haven-ink-mid)]">Signed in as</p>
        <p className="font-semibold text-[var(--haven-ink)]">{userEmail}</p>
      </div>

      <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sky-light)] px-4 py-3 text-body-sm text-[var(--haven-ink)]">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--haven-sky-strong)]" />
          <span>
            Granting access allows <strong>{firmName}</strong> to view your profile setup answers and uploaded documents. Your chats with Haven remain strictly private.
          </span>
        </div>
      </div>

      {error ? (
        <p className="rounded-[var(--radius-md)] bg-[var(--haven-blush-light)] px-3 py-2 text-body-sm font-medium text-[var(--haven-blush-ink)]">
          {error}
        </p>
      ) : null}

      <Button
        className="w-full"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await grantFirmAccessAction(token);
            if (!result.ok) {
              if (result.status === "is_lawyer") {
                setError("Lawyer accounts cannot connect to firms as clients. Sign in with a client account.");
                return;
              }
              if (result.status === "inactive_link" || result.status === "invalid_link") {
                setError("This intake link is no longer active. Contact your law firm for an updated link.");
                return;
              }
              setError("Could not grant access right now. Please try again or refresh.");
              return;
            }
            router.push("/dashboard");
          });
        }}
        type="button"
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Granting access...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Grant access to {firmName}
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>

      <div className="text-center text-caption text-[var(--haven-ink-mid)]">
        <span>Not {userEmail}? </span>
        <form action={signOutAction} className="inline">
          <button className="font-medium text-[var(--haven-ink)] underline underline-offset-2" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

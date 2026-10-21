"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { buttonVariants } from "@/components/ui/button";

type Props = {
  label: string;
  pendingLabel: string;
  variant?: "outline" | "ghost";
};

/** A small form button that shows it is working, so a slow delete or read doesn't look ignored. */
export function PendingSubmitButton({ label, pendingLabel, variant = "ghost" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-disabled={pending}
      className={buttonVariants({ variant, size: "sm" })}
      disabled={pending}
      type="submit"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

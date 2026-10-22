"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestFirmIntakeAction } from "@/server/firm-actions";

export function FirmIntakeForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (sentTo) {
    return (
      <div className="mt-6 rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4">
        <p className="flex items-center gap-2 text-h3 text-[var(--haven-ink)]">
          <MailCheck className="h-5 w-5" />
          Check your email
        </p>
        <p className="mt-2 text-body-sm">
          We sent a link to <strong>{sentTo}</strong>. Open it to set your password and get started. No email in a few
          minutes? Check spam, or try again later.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending) return;
        setError(null);
        startTransition(async () => {
          const result = await requestFirmIntakeAction(token, email);
          if (result.status === "invalid_email") {
            setError("That doesn't look like an email address.");
            return;
          }
          if (result.status === "invalid_link" || result.status === "inactive_link") {
            setError("This link stopped working. Ask your lawyer for their current Haven link.");
            return;
          }
          setSentTo(email.trim());
        });
      }}
    >
      <label className="field-label" htmlFor="firm-intake-email">
        Your email
      </label>
      <div className="flex gap-2">
        <Input
          autoComplete="email"
          id="firm-intake-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <Button aria-label="Continue" disabled={isPending} type="submit">
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-body-sm text-[#7a3030]">{error}</p> : null}
    </form>
  );
}

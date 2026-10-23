"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestFirmIntakeAction } from "@/server/firm-actions";

export function FirmIntakeForm({ token }: { token: string }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      className="mt-6 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (isPending) return;
        if (!fullName.trim()) {
          setError("Please enter your full name.");
          return;
        }
        if (!phone.trim() || phone.replace(/\D/g, "").length < 7) {
          setError("Please enter a valid phone number (at least 7 digits).");
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await requestFirmIntakeAction(token, email, fullName, phone);
          if (result.status === "invalid_name") {
            setError("Please provide your name.");
            return;
          }
          if (result.status === "invalid_phone") {
            setError("Please enter a valid phone number.");
            return;
          }
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
      <div>
        <label className="field-label" htmlFor="firm-intake-name">
          Full name
        </label>
        <Input
          autoComplete="name"
          id="firm-intake-name"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="First and last name"
          required
          type="text"
          value={fullName}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="firm-intake-email">
          Your email
        </label>
        <Input
          autoComplete="email"
          id="firm-intake-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="firm-intake-phone">
          Phone number
        </label>
        <Input
          autoComplete="tel"
          id="firm-intake-phone"
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(555) 000-0000"
          required
          type="tel"
          value={phone}
        />
      </div>

      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? (
          <span className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Submitting...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Get started <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>

      {error ? <p className="text-body-sm text-[#7a3030]">{error}</p> : null}
    </form>
  );
}

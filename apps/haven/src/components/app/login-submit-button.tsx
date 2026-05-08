"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { rememberLoginAttempt, trackEvent } from "@/lib/mixpanel";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  function handleClick() {
    if (pending) return;
    rememberLoginAttempt("password");
    trackEvent("Sign In", {
      user_id: null,
      login_method: "password",
      success: false
    });
  }

  return (
    <div className="space-y-2">
      <Button aria-disabled={pending} className="w-full" disabled={pending} onClick={handleClick} size="lg" type="submit">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {pending ? "Signing you in..." : "Continue to Haven"}
      </Button>
      <p
        aria-live="polite"
        className="min-h-[1.25rem] text-center text-caption text-[var(--color-text-secondary)]"
      >
        {pending ? "Checking your account and loading your plan." : ""}
      </p>
    </div>
  );
}

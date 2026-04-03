"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/server/actions";
import { cn } from "@/lib/utils";

function getPasswordStrength(pw: string): { met: boolean; label: string }[] {
  return [
    { met: pw.length >= 8, label: "At least 8 characters" },
    { met: /[A-Za-z]/.test(pw), label: "At least one letter" },
    { met: /[0-9]/.test(pw), label: "At least one number" }
  ];
}

export function RegisterForm({ defaultEmail }: { defaultEmail?: string }) {
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const requirements = getPasswordStrength(password);
  const allMet = requirements.every((r) => r.met);
  const showWarning = (touched || submitAttempted) && !allMet && password.length > 0;
  const showEmpty = submitAttempted && password.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    setSubmitAttempted(true);
    if (!allMet || password.length === 0) {
      e.preventDefault();
      return;
    }
  };

  return (
    <form ref={formRef} action={signUpAction} className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="field-label">Full name</label>
        <Input autoComplete="name" name="fullName" placeholder="Your name" required />
      </div>
      <div>
        <label className="field-label">Email</label>
        <Input
          autoComplete="email"
          defaultValue={defaultEmail}
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>
      <div>
        <label className="field-label">Password</label>
        <Input
          autoComplete="new-password"
          name="password"
          placeholder="Create a password"
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          className={cn(showWarning || showEmpty ? "border-[#e8b4b4]" : "")}
        />

        {/* Requirements checklist — shown once user starts typing */}
        {(touched || submitAttempted || password.length > 0) && (
          <ul className="mt-2 space-y-1">
            {requirements.map((r) => (
              <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.met ? "text-[var(--haven-sage)]" : "text-[#7a3030]")}>
                <span className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", r.met ? "bg-[var(--haven-sage)]" : "bg-[#c94040]")} />
                {r.label}
              </li>
            ))}
          </ul>
        )}

        {/* Warning if unmet on blur or submit attempt */}
        {showWarning && (
          <p className="mt-2 text-xs text-[#7a3030]">
            Password doesn&apos;t meet all requirements yet.
          </p>
        )}
        {showEmpty && (
          <p className="mt-2 text-xs text-[#7a3030]">Please enter a password.</p>
        )}
      </div>

      <Button className="w-full" size="lg" type="submit">
        Create my Haven profile
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyAdminPasscodeAction, type VerifyAdminPasscodeState } from "@/server/admin-actions";

const initialState: VerifyAdminPasscodeState = {
  status: "idle"
};

export function AdminPasscodeForm() {
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState(verifyAdminPasscodeAction, initialState);

  return (
    <div className="min-h-screen bg-[var(--haven-cream,#fdfaf6)] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-[var(--color-border)] bg-[var(--haven-white,#ffffff)] p-8 shadow-sm text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[var(--haven-sky-light,#e0f2fe)] flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-[var(--haven-sky-ink,#0369a1)]" />
        </div>

        <h1 className="text-h3 font-semibold text-[var(--haven-ink)]">Haven Operations Admin</h1>
        <p className="text-body-sm text-[var(--haven-ink-mid)] mt-2">
          Enter the admin passcode to unlock the operations dashboard.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4 text-left">
          <input type="hidden" name="redirectTo" value={pathname || "/admin"} />

          <div>
            <label htmlFor="passcode" className="block text-label text-[var(--haven-ink-mid)] mb-1.5 font-medium">
              Admin Passcode
            </label>
            <Input
              id="passcode"
              name="passcode"
              type="password"
              autoFocus
              required
              autoComplete="current-password"
              placeholder="Enter passcode"
              className="text-center font-mono text-base"
            />
          </div>

          {state.error && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--haven-blush-light,#fff1f2)] border border-[var(--haven-blush-mid,#fecdd3)] p-3 text-body-sm text-[var(--haven-blush-ink,#9f1239)]">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full mt-1">
            {pending ? "Verifying..." : "Unlock Dashboard"}
          </Button>
        </form>

        <div className="mt-6 border-t border-[var(--color-border)] pt-4">
          <Link
            href="/dashboard"
            className="text-body-sm text-[var(--haven-ink-mid)] hover:text-[var(--haven-ink)] hover:underline"
          >
            ← Return to Client Portal
          </Link>
        </div>
      </div>
    </div>
  );
}

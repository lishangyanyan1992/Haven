"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { signInAction } from "@/server/auth-actions";

type LoginFormProps = {
  defaultEmail?: string;
  redirectTo: string;
};

export function LoginForm({ defaultEmail = "", redirectTo }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setErrorMessage(null);

        startTransition(async () => {
          const result = await signInAction({ email, password, redirectTo });

          if (result?.error) {
            setErrorMessage(result.error);
            return;
          }

          router.push(result?.redirectTo ?? "/account");
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
        <input
          className="h-12 w-full rounded-xl border border-border bg-white px-4 text-sm outline-none transition-colors focus:border-[color:var(--border-strong)]"
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Password</label>
        <input
          className="h-12 w-full rounded-xl border border-border bg-white px-4 text-sm outline-none transition-colors focus:border-[color:var(--border-strong)]"
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          required
          type="password"
          value={password}
        />
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <button
        className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in with Haven"}
      </button>
    </form>
  );
}

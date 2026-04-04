import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { GoogleSignInButton } from "@/components/app/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/server/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string; email?: string; message?: string; progress?: string }>;
}) {
  const { redirectTo = "/dashboard", email = "", message, progress } = await searchParams;
  const progressPct = Math.min(100, Math.max(0, parseInt(progress ?? "0", 10)));


  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <p className="text-body-sm">
            No account yet?{" "}
            <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/register">
              Start free
            </Link>
          </p>
        </div>
      </header>

      <main className="content-container-wide grid gap-8 py-12 lg:grid-cols-[0.95fr_0.85fr] lg:items-center lg:py-20">
        <section>
          <p className="text-label">Welcome back</p>
          <h1 className="text-display mt-5 max-w-[12ch]">
            A calmer place for your immigration <em>journey</em>.
          </h1>
          <p className="text-body mt-6 max-w-[60ch]">
            Sign in to your timeline, layoff plan, and the community examples that help you see what comes next.
          </p>
          <div className="mt-8 grid gap-3">
            {[
              "Your timeline, always visible",
              "Plain-English next actions",
              "Matched community stories",
              "A calmer 60-day plan when things change"
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)]" />
                <p className="text-body-sm">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 md:p-8">
          <div>
            <p className="text-label">Sign in</p>
            <h2 className="text-h1 mt-3">Pick up where you left off.</h2>
            <p className="text-body-sm mt-3">Your plan stays here, even when everything else feels uncertain.</p>
          </div>

          {message === "existing_account" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              An account already exists for that email. Sign in instead.
            </div>
          )}

          {message === "complete_onboarding" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              You already started an account. Sign in to complete your profile setup.
            </div>
          )}

          {message === "account_created" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Account created! Sign in below to set up your Haven profile.
            </div>
          )}

          {message === "confirm_email" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Check your email to confirm your account, then sign in here to continue.
            </div>
          )}

          {message === "incomplete_onboarding" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Welcome back!{" "}
              {progressPct > 0
                ? `You're ${progressPct}% done with your setup.`
                : "You haven't finished setting up your profile."}{" "}
              <Link className="font-medium underline underline-offset-2" href="/onboarding">
                Pick up where you left off →
              </Link>
            </div>
          )}

          {message === "invalid_credentials" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
              Incorrect password. Please try again or{" "}
              <Link className="underline underline-offset-2" href="/forgot-password">
                reset your password
              </Link>
              .
            </div>
          )}

          {message === "password_updated" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Password updated. Sign in with your new password.
            </div>
          )}

          <div className="mt-6">
            <GoogleSignInButton />
            <div className="relative my-5 flex items-center">
              <div className="flex-grow border-t border-[var(--color-border)]" />
              <span className="mx-3 shrink-0 text-caption text-[var(--color-text-secondary)]">or continue with email</span>
              <div className="flex-grow border-t border-[var(--color-border)]" />
            </div>
          </div>

          <form action={signInAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div>
              <label className="field-label">Email</label>
              <Input autoComplete="email" defaultValue={email} name="email" placeholder="you@example.com" required type="email" />
            </div>
            <div>
              <label className="field-label">Password</label>
              <Input autoComplete="current-password" name="password" placeholder="Your password" required type="password" />
            </div>
            <div className="flex justify-end">
              <Link className="text-caption hover:text-[var(--haven-ink)]" href="/forgot-password">
                Forgot password?
              </Link>
            </div>
            <Button className="w-full" size="lg" type="submit">
              Continue to Haven
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-caption mt-6">
            Haven provides information, not legal advice. By signing in, you agree to the product terms and privacy policy.
          </p>
        </section>
      </main>
    </div>
  );
}

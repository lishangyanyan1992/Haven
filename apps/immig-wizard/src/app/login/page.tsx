import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string; email?: string; message?: string }>;
}) {
  return <LoginPageContent searchParams={searchParams} />;
}

async function LoginPageContent({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string; email?: string; message?: string }>;
}) {
  const { redirectTo = "/account", email = "", message } = await searchParams;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--neutral-25)_0%,var(--neutral-50)_100%)] text-foreground">
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_480px] lg:items-center">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Haven Account
            </p>
            <h1 className="mt-4 text-5xl font-light leading-[0.95] text-foreground sm:text-6xl">
              Sign in to save your filing progress.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground">
              ImmigWizard can still work as a standalone tool, but signing in lets you keep progress tied
              to the same Haven account you already use elsewhere.
            </p>
            <div className="mt-8 text-sm text-muted-foreground">
              <Link href="/" className="underline underline-offset-4">
                Back to ImmigWizard
              </Link>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-border bg-white p-8 shadow-[var(--shadow-xl)]">
            <p className="text-sm font-medium text-primary">Sign in</p>
            <h2 className="mt-3 text-3xl font-light text-foreground">Use your Haven login.</h2>

            {message === "invalid_credentials" && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Incorrect email or password.
              </div>
            )}

            <div className="mt-6">
              <LoginForm defaultEmail={email} redirectTo={redirectTo} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

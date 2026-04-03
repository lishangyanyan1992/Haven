import Link from "next/link";
import { Clock3, ShieldAlert, Users } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { RegisterForm } from "./RegisterForm";

const benefits = [
  {
    icon: Clock3,
    title: "A timeline built for your case",
    description: "Deterministic dates where rules are clear, honest ranges where they aren’t."
  },
  {
    icon: ShieldAlert,
    title: "Layoff planning before you need it",
    description: "Know what matters in a 60-day window before panic takes over."
  },
  {
    icon: Users,
    title: "Community context that actually matches",
    description: "See what people in your same visa stage and country queue experienced."
  }
];

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; message?: string }>;
}) {
  const { email = "", message } = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href="/">
            <HavenBrand />
          </Link>
          <p className="text-body-sm">
            Already have an account?{" "}
            <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <main className="content-container-wide grid gap-8 py-12 lg:grid-cols-[0.95fr_0.85fr] lg:items-center lg:py-20">
        <section>
          <p className="text-label">Get started</p>
          <h1 className="text-display mt-5 max-w-[11ch]">
            Start with clarity, not another <em>spreadsheet</em>.
          </h1>
          <p className="text-body mt-6 max-w-[60ch]">
            Haven asks only what it needs, then gives you something useful right away: your timeline, your next step, and a cohort that gets it.
          </p>
          <div className="mt-8 grid gap-4">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-[var(--radius-xl)] bg-[var(--haven-sand)] p-5">
                <benefit.icon className="h-5 w-5 text-[var(--haven-ink)]" />
                <h2 className="text-h3 mt-4">{benefit.title}</h2>
                <p className="text-body-sm mt-2">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 md:p-8">
          <div>
            <p className="text-label">Create account</p>
            <h2 className="text-h1 mt-3">Build your Haven profile.</h2>
            <p className="text-body-sm mt-3">Free to start. No credit card. Under 10 minutes to your first useful view.</p>
          </div>

          {message === "no_account" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              No account found for that email. Create one below to get started.
            </div>
          )}

          {/* debug: {message} */}
          {(message === "rate_limited") && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Too many sign-up attempts right now. Please wait a few minutes and try again.
            </div>
          )}

          <RegisterForm defaultEmail={email} />

          <p className="text-caption mt-6">
            By creating an account, you agree to Haven&apos;s terms and privacy policy. Haven provides information, not legal advice.
          </p>
        </section>
      </main>
    </div>
  );
}

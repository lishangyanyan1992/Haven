import Link from "next/link";
import { Clock3, ShieldAlert, Users } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { PendingQuestionNote } from "@/components/app/pending-question-note";
import { noIndexMetadata } from "@/lib/seo";
import { RegisterForm } from "./RegisterForm";

export const metadata = noIndexMetadata;
const HAVEN_HOME_URL = "https://haven-h1b.com/";

const benefits = [
  {
    icon: Users,
    title: "Answers from people who have been there",
    description: "Real accounts from people on your visa path — not a page written for everyone."
  },
  {
    icon: ShieldAlert,
    title: "Built for the moments that hurt",
    description: "A missed lottery, a layoff, status running out — when a wrong answer costs the most."
  },
  {
    icon: Clock3,
    title: "Set up once, in about a minute",
    description: "Your visa, your dates, your employer. That is what makes the answer yours."
  }
];

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; fullName?: string; message?: string }>;
}) {
  const { email = "", fullName = "", message } = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href={HAVEN_HOME_URL} prefetch={false}>
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
          <h1 className="text-display mt-5 max-w-[13ch]">
            Ask once. Get an answer that knows your <em>case</em>.
          </h1>
          <p className="text-body mt-6 max-w-[60ch]">
            Haven asks only what it needs, then answers your question with what people in the same situation actually
            did.
          </p>
          <PendingQuestionNote />
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
            <h2 className="text-h1 mt-3">Create your account.</h2>
            <p className="text-body-sm mt-3">Free. No credit card. About a minute before your question gets answered.</p>
          </div>

          {message === "no_account" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              No account found for that email. Create one below to get started.
            </div>
          )}

          {/* debug: {message} */}
          {message === "waitlist" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-4 py-3 text-body-sm">
              Early-access request started. Finish creating your Haven profile and we&apos;ll keep you posted on the packet builder.
            </div>
          )}

          {(message === "rate_limited") && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Too many sign-up attempts right now. Please wait a few minutes and try again.
            </div>
          )}

          <div className="mt-6">
            <RegisterForm defaultEmail={email} defaultFullName={fullName} />
          </div>

          <p className="text-caption mt-6">
            By creating an account, you agree to Haven&apos;s{" "}
            <Link className="underline underline-offset-2" href="/terms">
              terms
            </Link>{" "}
            and{" "}
            <Link className="underline underline-offset-2" href="/privacy">
              privacy policy
            </Link>
            . Haven provides information, not legal advice.
          </p>
        </section>
      </main>
    </div>
  );
}

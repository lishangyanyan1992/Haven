import Link from "next/link";
import { Building2, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { LoginEventTracker } from "@/components/app/login-event-tracker";
import { LoginSubmitButton } from "@/components/app/login-submit-button";
import { Input } from "@/components/ui/input";
import { noIndexMetadata } from "@/lib/seo";
import { SIGNED_IN_HOME } from "@/lib/archived-routes";
import { signInAction } from "@/server/actions";
import { cn } from "@/lib/utils";

export const metadata = noIndexMetadata;
const HAVEN_HOME_URL = "https://haven-h1b.com/";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{
    redirectTo?: string;
    error?: string;
    email?: string;
    message?: string;
    progress?: string;
    role?: string;
  }>;
}) {
  const { redirectTo = SIGNED_IN_HOME, email = "", message, progress, role } = await searchParams;
  const isLawyer = role === "lawyer" || redirectTo.startsWith("/firm");
  const progressPct = Math.min(100, Math.max(0, parseInt(progress ?? "0", 10)));

  const buildRoleUrl = (targetRole: "client" | "lawyer") => {
    const params = new URLSearchParams();
    params.set("role", targetRole);
    if (email) params.set("email", email);
    if (targetRole === "lawyer" && redirectTo === SIGNED_IN_HOME) {
      params.set("redirectTo", "/firm");
    } else if (targetRole === "client" && redirectTo === "/firm") {
      params.set("redirectTo", SIGNED_IN_HOME);
    } else if (redirectTo) {
      params.set("redirectTo", redirectTo);
    }
    return `/login?${params.toString()}`;
  };

  return (
    <div className="min-h-screen">
      <LoginEventTracker message={message} />
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href={HAVEN_HOME_URL} prefetch={false}>
            <HavenBrand />
          </Link>
          <p className="text-body-sm">
            {isLawyer ? (
              <>
                Want Haven for your firm?{" "}
                <Link
                  className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline"
                  href="/register?role=lawyer"
                >
                  Contact founder for pilot
                </Link>
              </>
            ) : (
              <>
                No account yet?{" "}
                <Link
                  className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline"
                  href="/register"
                >
                  Request an invite
                </Link>
              </>
            )}
          </p>
        </div>
      </header>

      <main className="content-container-wide grid gap-8 py-10 lg:grid-cols-[0.95fr_0.85fr] lg:items-center lg:py-16">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--haven-cream)] px-3 py-1 text-caption font-medium text-[var(--haven-ink)]">
            {isLawyer ? <Building2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            <span>{isLawyer ? "Law firm portal" : "Invite-only client access"}</span>
          </div>

          <h1 className="text-display mt-5 max-w-[14ch]">
            {isLawyer ? (
              <>
                Urgency triage and intake for <em>law firms</em>.
              </>
            ) : (
              <>
                A calmer place for your immigration <em>journey</em>.
              </>
            )}
          </h1>
          <p className="text-body mt-6 max-w-[60ch]">
            {isLawyer
              ? "Sign in to your firm dashboard to review client intakes, deadline countdowns, and uploaded case documents."
              : "Sign in to your timeline, layoff plan, and the community examples that help you see what comes next."}
          </p>
          <div className="mt-8 grid gap-3">
            {(isLawyer
              ? [
                  "All client intakes in one clean triage list",
                  "Urgency countdowns anchored to filing deadlines",
                  "Instant preview of I-797, I-94, and RFE notices",
                  "Strict firm data isolation"
                ]
              : [
                  "Your timeline, always visible",
                  "Plain-English next actions",
                  "Matched community stories",
                  "A calmer 60-day plan when things change"
                ]
            ).map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)]" />
                <p className="text-body-sm">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-sm md:p-8">
          {/* Two-mode segmented role switcher */}
          <div className="mb-6 flex rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-1">
            <Link
              href={buildRoleUrl("client")}
              className={cn(
                "flex items-center justify-center gap-1.5 flex-1 rounded-[var(--radius-md)] py-2 text-center text-body-sm font-medium transition-colors",
                !isLawyer
                  ? "bg-[var(--haven-white)] text-[var(--haven-ink)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--haven-ink)]"
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Client (Invite-Only)</span>
            </Link>
            <Link
              href={buildRoleUrl("lawyer")}
              className={cn(
                "flex items-center justify-center gap-1.5 flex-1 rounded-[var(--radius-md)] py-2 text-center text-body-sm font-medium transition-colors",
                isLawyer
                  ? "bg-[var(--haven-white)] text-[var(--haven-ink)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--haven-ink)]"
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Law Firm Portal</span>
            </Link>
          </div>

          <div>
            <p className="text-label">{isLawyer ? "Law Firm Member Sign In" : "Invite-Only Client Sign In"}</p>
            <h2 className="text-h1 mt-2">
              {isLawyer ? "Sign in to your firm." : "Pick up where you left off."}
            </h2>
            <p className="text-body-sm mt-2">
              {isLawyer
                ? "Access your firm dashboard, client book, and urgency queue."
                : "Sign in with the email address your immigration lawyer invited."}
            </p>
          </div>

          {/* Role mismatch banners */}
          {message === "use_lawyer_login" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
              This email is registered to a law firm account. Please switch to{" "}
              <Link
                className="font-medium underline underline-offset-2"
                href={`/login?role=lawyer&email=${encodeURIComponent(email)}`}
              >
                Law Firm Sign In
              </Link>
              .
            </div>
          )}

          {message === "not_lawyer_account" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
              This email is not registered to an active law firm. If you are a client, use{" "}
              <Link
                className="font-medium underline underline-offset-2"
                href={`/login?role=client&email=${encodeURIComponent(email)}`}
              >
                Client Sign In
              </Link>
              . Want to try Haven for your firm?{" "}
              <Link
                className="font-medium underline underline-offset-2"
                href={`/register?role=lawyer&email=${encodeURIComponent(email)}`}
              >
                Contact the founder for a free pilot →
              </Link>
            </div>
          )}

          {message === "existing_account" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              An account already exists for that email. Sign in below.
            </div>
          )}

          {message === "complete_onboarding" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              You already started an account. Sign in to complete your profile setup.
            </div>
          )}

          {message === "account_created" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Account created! Sign in below to continue.
            </div>
          )}

          {message === "confirm_email" && (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
              Check your email to confirm your account, then sign in here.
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

          <form action={signInAction} className="mt-6 space-y-4">
            <input type="hidden" name="role" value={isLawyer ? "lawyer" : "client"} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div>
              <label className="field-label">{isLawyer ? "Firm work email" : "Email"}</label>
              <Input
                autoComplete="email"
                defaultValue={email}
                name="email"
                placeholder={isLawyer ? "attorney@lawfirm.com" : "you@example.com"}
                required
                type="email"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <Input
                autoComplete="current-password"
                name="password"
                placeholder="Your password"
                required
                type="password"
              />
            </div>
            <div className="flex justify-end">
              <Link className="text-caption hover:text-[var(--haven-ink)]" href="/forgot-password">
                Forgot password?
              </Link>
            </div>
            <LoginSubmitButton />
          </form>

          <div className="mt-6 border-t border-[var(--color-border)] pt-4 text-center">
            {isLawyer ? (
              <p className="text-caption">
                Want to pilot Haven with your immigration firm?{" "}
                <Link
                  className="font-medium text-[var(--haven-ink)] underline underline-offset-2"
                  href={`/register?role=lawyer${email ? `&email=${encodeURIComponent(email)}` : ""}`}
                >
                  Contact the founder for a free pilot →
                </Link>
              </p>
            ) : (
              <p className="text-caption">
                Haven is invitation-only. Invited by your lawyer?{" "}
                <Link
                  className="font-medium text-[var(--haven-ink)] underline underline-offset-2"
                  href={`/register${email ? `&email=${encodeURIComponent(email)}` : ""}`}
                >
                  Claim your invite or join the waitlist →
                </Link>
              </p>
            )}
          </div>

          <p className="text-caption mt-4">
            Haven provides information, not legal advice. By signing in, you agree to the{" "}
            <Link className="underline underline-offset-2" href="/terms">
              terms
            </Link>{" "}
            and{" "}
            <Link className="underline underline-offset-2" href="/privacy">
              privacy policy
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

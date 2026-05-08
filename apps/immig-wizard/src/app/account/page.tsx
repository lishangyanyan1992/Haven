import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@haven/auth/server";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/account");
  }

  const { data: sessions } = await supabase
    .from("wizard_sessions")
    .select("filing_slug, current_step, last_updated_at")
    .order("last_updated_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--neutral-25)_0%,var(--neutral-50)_100%)] px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Account
        </p>
        <h1 className="mt-4 text-4xl font-light text-foreground">Connected to your Haven login.</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Signed in as {user.email}
        </p>

        <div className="mt-8 space-y-4">
          {(sessions ?? []).map((session) => (
            <div key={session.filing_slug} className="rounded-xl border border-border bg-white p-5">
              <p className="text-sm font-medium text-foreground">{session.filing_slug}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Resume at step {session.current_step}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Last updated {new Date(session.last_updated_at).toLocaleString()}
              </p>
              <Link
                href={`/wizard/${session.current_step}`}
                className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white"
              >
                Resume draft
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
          >
            Back to wizard
          </Link>

          <form action="/logout" method="post">
            <button
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

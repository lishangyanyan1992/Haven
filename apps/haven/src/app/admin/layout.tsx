import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { isAdminEmail } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/server/actions";
import { AdminHeader } from "./AdminHeader";
import { AdminNavTabs } from "./AdminNavTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login?redirectTo=/admin");
  }

  if (!isAdminEmail(user.email)) {
    return (
      <div className="min-h-screen bg-[var(--haven-cream,#fdfaf6)] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[var(--haven-blush-mid,#fecdd3)] bg-[var(--haven-white)] p-8 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--haven-blush-light,#fff1f2)] flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-[var(--haven-blush-ink,#9f1239)]" />
          </div>
          <h1 className="text-h3 font-semibold text-[var(--haven-ink)]">Admin Access Required</h1>
          <p className="text-body-sm text-[var(--haven-ink-mid)] mt-2">
            You are signed in as <strong className="text-[var(--haven-ink)]">{user.email}</strong>, which does not have administrator privileges.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <form action={signOutAction}>
              <input type="hidden" name="redirectTo" value="/login?redirectTo=/admin" />
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--haven-sky-ink)] px-4 py-2.5 text-body-sm font-semibold text-[var(--haven-white)] transition hover:bg-[var(--haven-ink)]"
              >
                Sign Out & Log In as Admin
              </button>
            </form>
            <Link
              href="/dashboard"
              className="text-body-sm text-[var(--haven-ink-mid)] hover:underline"
            >
              Continue to Client Portal →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--haven-cream,#fdfaf6)] text-[var(--haven-ink)]">
      <AdminHeader email={user.email} />
      <div className="content-container-wide py-8">
        <div className="mb-6">
          <AdminNavTabs />
        </div>
        {children}
      </div>
    </div>
  );
}

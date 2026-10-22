import Link from "next/link";
import { redirect } from "next/navigation";

import { FirmSharingNote } from "@/components/app/firm-sharing-note";
import { HavenBrand } from "@/components/app/haven-brand";
import { getClientFirm } from "@/lib/firms/intake";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeadlinePromptForm } from "./DeadlinePromptForm";

export const metadata = noIndexMetadata;
export const dynamic = "force-dynamic";

/**
 * Asked once, at sign-in, of clients who finished setup before the
 * "Your deadlines" step existed. Answering or skipping ends it.
 */
export default async function DeadlinePromptPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/onboarding/deadlines");

  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from("user_profiles").select("deadline_answers").eq("id", user.id).maybeSingle();
  const firm = await getClientFirm(user.id);

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href="/advisor">
            <HavenBrand />
          </Link>
        </div>
      </header>
      <main className="content-container-wide flex flex-col items-center py-10">
        <div className="w-full max-w-[40rem] space-y-5">
          {firm ? <FirmSharingNote firmName={firm.firmName} /> : null}
          <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 md:p-8">
            <p className="text-label">One quick thing</p>
            <h1 className="text-h1 mt-3">Any dates coming up?</h1>
            <p className="text-body mt-3">
              All optional. These help {firm ? "your lawyer" : "Haven"} see what&apos;s urgent. You&apos;ll only be asked
              once, and you can skip.
            </p>
            {error === "save" ? (
              <p className="mt-4 rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
                Your dates couldn&apos;t be saved. Please try again.
              </p>
            ) : null}
            <DeadlinePromptForm initial={profile?.deadline_answers ?? {}} />
          </section>
        </div>
      </main>
    </div>
  );
}

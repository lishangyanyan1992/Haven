import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";

import { HavenBrand } from "@/components/app/haven-brand";
import { normalizeEmail } from "@/lib/access";
import { lookupIntakeToken } from "@/lib/firms/links";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FirmIntakeForm } from "./FirmIntakeForm";
import { GrantFirmAccessCard } from "./GrantFirmAccessCard";

export const metadata = noIndexMetadata;
export const dynamic = "force-dynamic";

/**
 * A firm's intake link. A working link names the firm and says what's
 * shared. A turned-off link says so. An unknown or replaced link never
 * reveals any firm.
 */
export default async function FirmIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await lookupIntakeToken(token);

  let signedInClient: { id: string; email: string; alreadyConnected: boolean } | null = null;
  if (link.state === "active") {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user && user.email) {
      const email = normalizeEmail(user.email);
      const admin = createSupabaseAdminClient() as any;
      const [lawyer, existing] = await Promise.all([
        admin.from("firm_members").select("user_id").or(`user_id.eq.${user.id},email.eq.${email}`).maybeSingle(),
        admin
          .from("firm_clients")
          .select("id, joined_at")
          .eq("firm_id", link.firmId)
          .or(`user_id.eq.${user.id},normalized_email.eq.${email}`)
          .maybeSingle()
      ]);

      if (!lawyer.data) {
        signedInClient = {
          id: user.id,
          email: user.email,
          alreadyConnected: Boolean(existing.data?.joined_at)
        };
      }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href="/" prefetch={false}>
            <HavenBrand />
          </Link>
          <p className="text-body-sm">
            {signedInClient ? (
              <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/dashboard">
                Dashboard
              </Link>
            ) : (
              <>
                Have an account?{" "}
                <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/login">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </header>

      <main className="content-container-wide flex flex-col items-center py-10 lg:py-16">
        <div className="w-full max-w-[34rem] rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_12px_48px_-16px_rgba(44,54,48,0.18)] sm:p-8">
          {link.state === "active" ? (
            <>
              <p className="inline-flex items-center gap-2 text-label">
                <Building2 className="h-4 w-4" />
                Invited by {link.firmName}
              </p>
              <h1 className="text-h1 mt-3">
                {signedInClient
                  ? signedInClient.alreadyConnected
                    ? `Connected to ${link.firmName}`
                    : `Connect with ${link.firmName}`
                  : "Set up your Haven account"}
              </h1>
              <p className="text-body mt-3">
                {link.firmName} uses Haven to collect your details and documents, and to answer your questions between
                appointments.
              </p>
              {!signedInClient ? (
                <>
                  <div className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-lg)] bg-[var(--haven-sky-light)] px-4 py-3 text-body-sm text-[var(--haven-ink)]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Your setup answers and the documents you upload will be shared with <strong>{link.firmName}</strong>.
                      Your chats with Haven stay private.
                    </span>
                  </div>
                  <FirmIntakeForm token={token} />
                </>
              ) : (
                <GrantFirmAccessCard
                  alreadyConnected={signedInClient.alreadyConnected}
                  firmName={link.firmName}
                  token={token}
                  userEmail={signedInClient.email}
                />
              )}
              <p className="text-caption mt-5">
                By continuing, you agree to Haven&apos;s{" "}
                <Link className="underline underline-offset-2" href="/terms">
                  terms
                </Link>{" "}
                and{" "}
                <Link className="underline underline-offset-2" href="/privacy">
                  privacy policy
                </Link>
                . Haven provides information, not legal advice.
              </p>
            </>
          ) : link.state === "inactive" ? (
            <>
              <h1 className="text-h1">This link isn&apos;t active right now</h1>
              <p className="text-body mt-3">Contact your lawyer for a working link.</p>
            </>
          ) : (
            <>
              <h1 className="text-h1">This link isn&apos;t valid</h1>
              <p className="text-body mt-3">
                It may have been replaced. Ask your lawyer for their current Haven link.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

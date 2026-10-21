import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { InviteChat } from "@/components/app/invite-chat";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;
const HAVEN_HOME_URL = "https://haven-h1b.com/";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <header className="border-b border-[var(--color-border)] bg-[rgba(253,250,246,0.94)]">
        <div className="content-container-wide flex items-center justify-between py-4">
          <Link href={HAVEN_HOME_URL} prefetch={false}>
            <HavenBrand />
          </Link>
          <p className="text-body-sm">
            Have an account?{" "}
            <Link className="font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </header>

      <main className="content-container-wide flex flex-col items-center py-10 lg:py-16">
        <p className="text-label">Invitation only</p>
        <h1 className="text-h1 mt-3 max-w-[22ch] text-center">Haven is invite-only for now.</h1>
        <p className="text-body mt-3 max-w-[52ch] text-center">
          Law firms invite their clients. Tell us who you are and we&apos;ll point you the right way.
        </p>
        <div className="mt-8 w-full max-w-[40rem]">
          <InviteChat notInvited={message === "not_invited"} />
        </div>
        <p className="text-caption mt-6 max-w-[52ch] text-center">
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
      </main>
    </div>
  );
}

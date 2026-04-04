import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { noIndexMetadata } from "@/lib/seo";
import { resetPasswordAction } from "@/server/actions";

export const metadata = noIndexMetadata;

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; message?: string }>;
}) {
  const { email = "", message } = await searchParams;

  return (
    <main className="min-h-screen">
      <div className="content-container py-8">
        <Link href="/">
          <HavenBrand />
        </Link>
      </div>
      <div className="content-container flex items-center justify-center py-10">
        <Card className="w-full max-w-[520px]">
          <CardHeader>
            <div>
              <p className="text-label">Password reset</p>
              <CardTitle className="mt-3 text-h1">Get back into Haven</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {message === "sent" ? (
              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
                  Reset link sent. Check your inbox (and spam folder) and follow the link to choose a new password.
                </div>
                <p className="text-body-sm">
                  Didn&apos;t get it?{" "}
                  <Link className="underline underline-offset-2" href="/forgot-password">
                    Try again
                  </Link>{" "}
                  or{" "}
                  <Link className="underline underline-offset-2" href="/login">
                    go back to sign in
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <>
                <p className="text-body-sm">Enter the email on your account and Haven will send you a reset link.</p>

                {message === "rate_limited" && (
                  <div className="rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
                    Too many reset attempts. Please wait a few minutes and try again.
                  </div>
                )}

                {message === "error" && (
                  <div className="rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
                    Something went wrong. Please try again.
                  </div>
                )}

                {message === "missing_email" && (
                  <div className="rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
                    Please enter your email address.
                  </div>
                )}

                <form action={resetPasswordAction} className="space-y-4">
                  <div>
                    <label className="field-label">Email</label>
                    <Input defaultValue={email} name="email" placeholder="you@example.com" required type="email" />
                  </div>
                  <Button className="w-full" size="lg" type="submit">
                    Send reset link
                  </Button>
                </form>

                <p className="text-caption">
                  <Link className="underline underline-offset-2" href="/login">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HavenBrand } from "@/components/app/haven-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function getPasswordRequirements(pw: string) {
  return [
    { met: pw.length >= 8, label: "At least 8 characters" },
    { met: /[A-Za-z]/.test(pw), label: "At least one letter" },
    { met: /[0-9]/.test(pw), label: "At least one number" }
  ];
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwTouched, setPwTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "invalid_link">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase puts the recovery token in the URL hash.
  // We need to let the client SDK exchange it for a session.
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Listen for the PASSWORD_RECOVERY event which fires when the link is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Also check if the user already has a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const reqs = getPasswordRequirements(password);
    if (!reqs.every((r) => r.met)) {
      setPwTouched(true);
      setStatus("error");
      setErrorMessage("Please meet all password requirements before continuing.");
      return;
    }

    if (password !== confirm) {
      setErrorMessage("Passwords do not match.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
      return;
    }

    setStatus("success");
    setTimeout(() => router.push("/login?message=password_updated"), 2000);
  };

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
              <p className="text-label">Choose a new password</p>
              <CardTitle className="mt-3 text-h1">Update your sign-in details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "success" ? (
              <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3 text-body-sm">
                Password updated. Redirecting you to sign in...
              </div>
            ) : !sessionReady ? (
              <div className="space-y-4">
                <p className="text-body-sm">
                  This page requires a valid reset link. If you arrived here from a password reset email, try clicking the link again.
                </p>
                <Link href="/forgot-password">
                  <Button className="w-full" size="lg" variant="outline">
                    Request a new reset link
                  </Button>
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {status === "error" && (
                  <div className="rounded-[var(--radius-lg)] border border-[#e8b4b4] bg-[#fdf0f0] px-4 py-3 text-body-sm text-[#7a3030]">
                    {errorMessage}
                  </div>
                )}
                <div>
                  <label className="field-label">New password</label>
                  <Input
                    onBlur={() => setPwTouched(true)}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    type="password"
                    value={password}
                  />
                  {(pwTouched || password.length > 0) && (
                    <ul className="mt-2 space-y-1">
                      {getPasswordRequirements(password).map((r) => (
                        <li key={r.label} className={cn("flex items-center gap-1.5 text-xs", r.met ? "text-[var(--haven-sage)]" : "text-[#7a3030]")}>
                          <span className={cn("inline-block h-1.5 w-1.5 rounded-full flex-shrink-0", r.met ? "bg-[var(--haven-sage)]" : "bg-[#c94040]")} />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="field-label">Confirm password</label>
                  <Input
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    type="password"
                    value={confirm}
                  />
                </div>
                <Button className="w-full" disabled={status === "loading"} size="lg" type="submit">
                  {status === "loading" ? "Updating..." : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

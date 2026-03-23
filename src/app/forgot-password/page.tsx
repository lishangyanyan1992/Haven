import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
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
            <p className="text-body-sm">Enter the email on your account and Haven will send you a reset link.</p>
            <div>
              <label className="field-label">Email</label>
              <Input placeholder="you@example.com" type="email" />
            </div>
            <Button className="w-full" size="lg">
              Send reset link
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
